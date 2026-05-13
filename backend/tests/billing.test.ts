import request from "supertest";
import {describe, expect, it} from "vitest";
import type {AuthService} from "../src/auth/core/service.js";
import type {StripeClientLike} from "../src/billing/service.js";
import type {UserStore} from "../src/auth/core/types.js";
import {createTestApp} from "./helpers/create-test-app.js";

const billingConfig = {
	stripeSecretKey: "sk_test_123",
	stripeWebhookSecret: "whsec_123",
	appPublicUrl: "http://localhost:5173",
	stripePriceIds: {
		STRIPE_PRICE_STARTER_PACK: "price_starter",
		STRIPE_PRICE_CREATOR_PACK: "price_creator",
		STRIPE_PRICE_TEACHER_MONTHLY: "price_teacher",
		STRIPE_PRICE_TEACHER_PRO_MONTHLY: "price_teacher_pro",
	},
};

function createFakeStripe(): StripeClientLike {
	return {
		checkout: {
			sessions: {
				async create(input) {
					return {
						id: "cs_test",
						url: `https://checkout.stripe.test/${String(input.mode)}`,
					};
				},
			},
		},
		billingPortal: {
			sessions: {
				async create() {
					return {url: "https://billing.stripe.test/session"};
				},
			},
		},
		customers: {
			async create() {
				return {id: "cus_test"};
			},
		},
		subscriptions: {
			async retrieve(id) {
				return {
					id,
					customer: "cus_test",
					status: "active",
					current_period_start: 1770000000,
					current_period_end: 1772600000,
					cancel_at_period_end: false,
					items: {data: [{price: {id: "price_teacher_pro"}}]},
				};
			},
		},
		webhooks: {
			constructEvent(payload) {
				return JSON.parse(payload.toString());
			},
		},
	};
}

describe("billing", () => {
	it("exposes pricing publicly and protects checkout", async () => {
		const publicApp = createTestApp({
			disableAuthBypass: true,
			billingConfig,
			stripeClient: createFakeStripe(),
		});

		const pricing = await request(publicApp).get("/api/billing/pricing");
		expect(pricing.status).toBe(200);
		expect(pricing.body.products).toHaveLength(4);
		expect(pricing.body.products[0]).toMatchObject({
			id: "starter_pack",
			priceLabel: "5€ + VAT",
			stripeConfigured: true,
		});

		const checkout = await request(publicApp)
			.post("/api/billing/checkout-session")
			.send({productId: "starter_pack"});
		expect(checkout.status).toBe(401);

		const app = createTestApp({billingConfig, stripeClient: createFakeStripe()});
		const unknown = await request(app)
			.post("/api/billing/checkout-session")
			.send({productId: "does_not_exist"});
		expect(unknown.status).toBe(404);
	});

	it("creates Checkout and Portal sessions", async () => {
		const app = createTestApp({billingConfig, stripeClient: createFakeStripe()});

		const checkout = await request(app)
			.post("/api/billing/checkout-session")
			.send({productId: "teacher_pro_monthly"});
		expect(checkout.status).toBe(200);
		expect(checkout.body.url).toBe("https://checkout.stripe.test/subscription");

		const portal = await request(app).post("/api/billing/portal-session").send({});
		expect(portal.status).toBe(200);
		expect(portal.body.url).toBe("https://billing.stripe.test/session");
	});

	it("grants a one-off credit pack exactly once for duplicate webhooks", async () => {
		const app = createTestApp({billingConfig, stripeClient: createFakeStripe()});
		const event = {
			id: "evt_pack",
			type: "checkout.session.completed",
			data: {
				object: {
					id: "cs_pack",
					payment_status: "paid",
					customer: "cus_test",
					client_reference_id: "mock-user",
					metadata: {userId: "mock-user", productId: "starter_pack"},
				},
			},
		};

		for (let i = 0; i < 2; i += 1) {
			const response = await request(app)
				.post("/api/billing/webhook")
				.set("stripe-signature", "test-signature")
				.set("Content-Type", "application/json")
				.send(JSON.stringify(event));
			expect(response.status).toBe(200);
		}

		const authService = app.locals.authService as AuthService;
		const user = await authService.getUserById("mock-user");
		expect(user?.credits).toEqual({bronze: 80, silver: 40, gold: 6});
	});

	it("grants subscription renewal credits once per invoice event", async () => {
		const app = createTestApp({billingConfig, stripeClient: createFakeStripe()});
		await request(app)
			.post("/api/billing/checkout-session")
			.send({productId: "teacher_pro_monthly"});

		const event = {
			id: "evt_invoice",
			type: "invoice.paid",
			data: {
				object: {
					id: "in_test",
					customer: "cus_test",
					subscription: "sub_test",
					lines: {data: [{price: {id: "price_teacher_pro"}}]},
				},
			},
		};

		for (let i = 0; i < 2; i += 1) {
			const response = await request(app)
				.post("/api/billing/webhook")
				.set("stripe-signature", "test-signature")
				.set("Content-Type", "application/json")
				.send(JSON.stringify(event));
			expect(response.status).toBe(200);
		}

		const authService = app.locals.authService as AuthService;
		const user = await authService.getUserById("mock-user");
		expect(user?.credits).toEqual({bronze: 30, silver: 115, gold: 21});
		expect(user?.billing).toMatchObject({
			stripeSubscriptionId: "sub_test",
			subscriptionStatus: "active",
			subscriptionTier: "teacher_pro",
		});
	});

	it("covers bronze debits for active Teacher Pro subscribers without reducing wallet balance", async () => {
		const app = createTestApp({billingConfig, stripeClient: createFakeStripe()});
		const authService = app.locals.authService as AuthService;
		const userStore = app.locals.userStore as UserStore;
		await authService.getUserById("mock-user");
		await authService.adjustUserCredits({
			userId: "mock-user",
			actorUserId: "mock-user",
			coinType: "bronze",
			direction: "debit",
			amount: 30,
			reason: "test_exhaustion",
		});
		await userStore.updateBillingProfile("mock-user", {
			subscriptionStatus: "active",
			subscriptionTier: "teacher_pro",
		});

		const reservation = await authService.reserveUserCredits({
			userId: "mock-user",
			coinType: "bronze",
			amount: 1,
			reason: "syllabus_generation",
		});

		expect(reservation.user.credits.bronze).toBe(0);
		expect(reservation.transaction.metadata).toMatchObject({
			subscriptionCovered: true,
		});
	});
});
