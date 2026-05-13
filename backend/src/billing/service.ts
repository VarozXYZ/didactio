import Stripe from "stripe";
import {AuthError} from "../auth/core/errors.js";
import type {AuthService} from "../auth/core/service.js";
import type {
	AuthUser,
	CreditBalances,
	UserBillingProfile,
	UserStore,
} from "../auth/core/types.js";
import type {BillingEventStore} from "./billing-event-store.js";
import {
	BILLING_PRODUCTS,
	getBillingProduct,
	getBillingProductByStripePriceId,
	isActiveBillingStatus,
	type BillingProduct,
	type BillingSubscriptionTier,
} from "./pricing.js";

export interface BillingConfig {
	stripeSecretKey: string | null;
	stripeWebhookSecret: string | null;
	appPublicUrl: string;
	stripePriceIds: Record<string, string | null>;
}

export type StripeClientLike = {
	checkout: {
		sessions: {
			create(input: Record<string, unknown>): Promise<{id: string; url: string | null}>;
		};
	};
	billingPortal: {
		sessions: {
			create(input: Record<string, unknown>): Promise<{url: string}>;
		};
	};
	customers: {
		create(input: Record<string, unknown>): Promise<{id: string}>;
	};
	subscriptions: {
		retrieve(id: string): Promise<unknown>;
	};
	webhooks: {
		constructEvent(payload: Buffer, signature: string, secret: string): Stripe.Event;
	};
};

export interface PublicBillingProduct extends BillingProduct {
	stripeConfigured: boolean;
}

function hasAnyCredits(credits: CreditBalances): boolean {
	return credits.bronze > 0 || credits.silver > 0 || credits.gold > 0;
}

function unixToDate(value: unknown): Date | undefined {
	return typeof value === "number" ? new Date(value * 1000) : undefined;
}

function getSubscriptionIdFromInvoice(invoice: Record<string, unknown>): string | undefined {
	const direct = invoice.subscription;
	if (typeof direct === "string") {
		return direct;
	}

	const parent = invoice.parent as
		| {subscription_details?: {subscription?: unknown}}
		| undefined;
	const nested = parent?.subscription_details?.subscription;
	return typeof nested === "string" ? nested : undefined;
}

function getInvoicePriceId(invoice: Record<string, unknown>): string | undefined {
	const lines = invoice.lines as {data?: Array<{price?: {id?: string}}>};
	return lines?.data?.[0]?.price?.id;
}

function getSubscriptionPriceId(subscription: Record<string, unknown>): string | undefined {
	const items = subscription.items as {data?: Array<{price?: {id?: string}}>};
	return items?.data?.[0]?.price?.id;
}

export class BillingService {
	private readonly stripe: StripeClientLike | null;

	constructor(
		private readonly authService: AuthService,
		private readonly userStore: UserStore,
		private readonly eventStore: BillingEventStore,
		private readonly config: BillingConfig,
		stripeClient?: StripeClientLike | null,
	) {
		this.stripe =
			stripeClient ??
			(config.stripeSecretKey ?
				new Stripe(config.stripeSecretKey) as unknown as StripeClientLike
			:	null);
	}

	getPricing(): {products: PublicBillingProduct[]} {
		return {
			products: BILLING_PRODUCTS.map((product) => ({
				...product,
				stripeConfigured:
					Boolean(this.config.stripeSecretKey) &&
					Boolean(this.config.stripePriceIds[product.stripePriceEnvKey]),
			})),
		};
	}

	async getBillingSummary(userId: string) {
		const user = await this.requireUser(userId);
		return {
			billing: this.toPublicBilling(user),
			pricing: this.getPricing(),
		};
	}

	async createCheckoutSession(input: {
		userId: string;
		productId: string;
	}): Promise<{url: string}> {
		const stripe = this.requireStripe();
		const product = getBillingProduct(input.productId);
		if (!product) {
			throw new AuthError("unknown_billing_product", 404, "Billing product was not found.");
		}

		const priceId = this.config.stripePriceIds[product.stripePriceEnvKey];
		if (!priceId) {
			throw new AuthError("billing_not_configured", 503, "Stripe price is not configured.");
		}

		const user = await this.requireUser(input.userId);
		const customerId = await this.ensureStripeCustomer(user);
		const session = await stripe.checkout.sessions.create({
			mode: product.kind === "subscription" ? "subscription" : "payment",
			customer: customerId,
			client_reference_id: user.id,
			line_items: [{price: priceId, quantity: 1}],
			success_url: `${this.config.appPublicUrl}/dashboard?billing=success`,
			cancel_url: `${this.config.appPublicUrl}/dashboard?billing=cancelled`,
			automatic_tax: {enabled: true},
			customer_update: {
				address: "auto",
				name: "auto",
			},
			metadata: {
				userId: user.id,
				productId: product.id,
			},
			subscription_data:
				product.kind === "subscription" ?
					{
						metadata: {
							userId: user.id,
							productId: product.id,
							subscriptionTier: product.subscriptionTier,
						},
					}
				:	undefined,
			payment_intent_data:
				product.kind === "credit_pack" ?
					{
						metadata: {
							userId: user.id,
							productId: product.id,
						},
					}
				:	undefined,
		});

		if (!session.url) {
			throw new AuthError("checkout_session_failed", 502, "Stripe did not return a Checkout URL.");
		}

		return {url: session.url};
	}

	async createPortalSession(userId: string): Promise<{url: string}> {
		const stripe = this.requireStripe();
		const user = await this.requireUser(userId);
		const customerId = await this.ensureStripeCustomer(user);
		const session = await stripe.billingPortal.sessions.create({
			customer: customerId,
			return_url: `${this.config.appPublicUrl}/dashboard`,
		});
		return {url: session.url};
	}

	async handleWebhook(payload: Buffer, signature: string | undefined): Promise<{received: true}> {
		if (!signature) {
			throw new AuthError("missing_stripe_signature", 400, "Stripe signature header is required.");
		}
		if (!this.config.stripeWebhookSecret) {
			throw new AuthError("billing_not_configured", 503, "Stripe webhook secret is not configured.");
		}

		const event = this.requireStripe().webhooks.constructEvent(
			payload,
			signature,
			this.config.stripeWebhookSecret,
		);

		if (await this.eventStore.hasProcessed(event.id)) {
			return {received: true};
		}

		await this.processStripeEvent(event);
		await this.eventStore.markProcessed({
			id: event.id,
			type: event.type,
			createdAt: new Date(),
		});

		return {received: true};
	}

	private async processStripeEvent(event: Stripe.Event): Promise<void> {
		if (event.type === "checkout.session.completed") {
			await this.handleCheckoutCompleted(
				event.data.object as unknown as Record<string, unknown>,
			);
			return;
		}

		if (event.type === "invoice.paid") {
			await this.handleInvoicePaid(
				event.data.object as unknown as Record<string, unknown>,
			);
			return;
		}

		if (
			event.type === "customer.subscription.updated" ||
			event.type === "customer.subscription.deleted"
		) {
			await this.updateSubscriptionProfile(
				event.data.object as unknown as Record<string, unknown>,
			);
		}
	}

	private async handleCheckoutCompleted(session: Record<string, unknown>): Promise<void> {
		const metadata = session.metadata as {userId?: string; productId?: string} | undefined;
		const userId =
			metadata?.userId ??
			(typeof session.client_reference_id === "string" ?
				session.client_reference_id
			:	undefined);
		const product = metadata?.productId ? getBillingProduct(metadata.productId) : undefined;
		if (!userId || !product) {
			return;
		}

		const customerId = typeof session.customer === "string" ? session.customer : undefined;
		if (customerId) {
			await this.userStore.updateBillingProfile(userId, {stripeCustomerId: customerId});
		}

		if (product.kind === "credit_pack" && session.payment_status === "paid") {
			await this.grantCredits(userId, product.credits, "stripe_credit_pack", {
				productId: product.id,
				checkoutSessionId: session.id,
			});
			return;
		}

		if (product.kind === "subscription") {
			await this.userStore.updateBillingProfile(userId, {
				stripeCustomerId: customerId,
				stripeSubscriptionId:
					typeof session.subscription === "string" ? session.subscription : undefined,
				subscriptionTier: product.subscriptionTier,
				subscriptionStatus: "active",
			});
		}
	}

	private async handleInvoicePaid(invoice: Record<string, unknown>): Promise<void> {
		const subscriptionId = getSubscriptionIdFromInvoice(invoice);
		const customerId = typeof invoice.customer === "string" ? invoice.customer : undefined;
		const priceId = getInvoicePriceId(invoice);
		const product = getBillingProductByStripePriceId(priceId, this.config.stripePriceIds);

		if (!subscriptionId || !customerId || product?.kind !== "subscription") {
			return;
		}

		const user = await this.userStore.findByStripeCustomerId(customerId);
		if (!user) {
			return;
		}

		await this.syncSubscriptionFromStripe(subscriptionId, user.id);
		await this.grantCredits(user.id, product.credits, "stripe_subscription_renewal", {
			productId: product.id,
			invoiceId: invoice.id,
			subscriptionId,
		});
	}

	private async syncSubscriptionFromStripe(subscriptionId: string, userId: string): Promise<void> {
		const subscription = (await this.requireStripe().subscriptions.retrieve(
			subscriptionId,
		)) as Record<string, unknown>;
		await this.updateSubscriptionProfile(subscription, userId);
	}

	private async updateSubscriptionProfile(
		subscription: Record<string, unknown>,
		userId?: string,
	): Promise<void> {
		const customerId = typeof subscription.customer === "string" ? subscription.customer : undefined;
		const user =
			userId ? await this.userStore.findById(userId)
			: customerId ? await this.userStore.findByStripeCustomerId(customerId)
			: null;
		if (!user) {
			return;
		}

		const priceId = getSubscriptionPriceId(subscription);
		const product = getBillingProductByStripePriceId(priceId, this.config.stripePriceIds);
		const status = typeof subscription.status === "string" ? subscription.status : undefined;
		const active = isActiveBillingStatus(status);
		const profile: UserBillingProfile = {
			stripeCustomerId: customerId ?? user.billing?.stripeCustomerId,
			stripeSubscriptionId:
				typeof subscription.id === "string" ? subscription.id : user.billing?.stripeSubscriptionId,
			subscriptionStatus: status,
			subscriptionTier:
				active && product?.kind === "subscription" ?
					product.subscriptionTier as BillingSubscriptionTier
				:	user.billing?.subscriptionTier,
			currentPeriodStart: unixToDate(subscription.current_period_start),
			currentPeriodEnd: unixToDate(subscription.current_period_end),
			cancelAtPeriodEnd:
				typeof subscription.cancel_at_period_end === "boolean" ?
					subscription.cancel_at_period_end
				:	user.billing?.cancelAtPeriodEnd,
		};

		if (!active && subscription.id === user.billing?.stripeSubscriptionId) {
			profile.subscriptionTier = undefined;
		}

		await this.userStore.updateBillingProfile(user.id, profile);
	}

	private async grantCredits(
		userId: string,
		credits: CreditBalances,
		reason: string,
		metadata: Record<string, unknown>,
	): Promise<void> {
		if (!hasAnyCredits(credits)) {
			return;
		}

		for (const coinType of ["bronze", "silver", "gold"] as const) {
			const amount = credits[coinType];
			if (amount <= 0) {
				continue;
			}

			await this.authService.adjustUserCredits({
				userId,
				actorUserId: userId,
				coinType,
				direction: "credit",
				amount,
				reason,
				metadata,
			});
		}
	}

	private async ensureStripeCustomer(user: AuthUser): Promise<string> {
		if (user.billing?.stripeCustomerId) {
			return user.billing.stripeCustomerId;
		}

		const customer = await this.requireStripe().customers.create({
			email: user.email ?? undefined,
			name: user.displayName,
			metadata: {userId: user.id},
		});
		await this.userStore.updateBillingProfile(user.id, {
			stripeCustomerId: customer.id,
		});
		return customer.id;
	}

	private async requireUser(userId: string): Promise<AuthUser> {
		const user = await this.authService.getUserById(userId);
		if (!user) {
			throw new AuthError("user_not_found", 404, "User not found.");
		}
		return user;
	}

	private requireStripe(): StripeClientLike {
		if (!this.stripe) {
			throw new AuthError("billing_not_configured", 503, "Stripe is not configured.");
		}
		return this.stripe;
	}

	private toPublicBilling(user: AuthUser) {
		return {
			...user.billing,
			currentPeriodStart: user.billing?.currentPeriodStart?.toISOString(),
			currentPeriodEnd: user.billing?.currentPeriodEnd?.toISOString(),
			bronzeFairUseActive:
				isActiveBillingStatus(user.billing?.subscriptionStatus) &&
				user.billing?.subscriptionTier === "teacher_pro",
		};
	}
}
