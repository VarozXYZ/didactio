import type {CreditBalances} from "../auth/core/types.js";

export type BillingProductKind = "credit_pack" | "subscription";
export type BillingSubscriptionTier = "teacher" | "teacher_pro";

export interface BillingProduct {
	id: string;
	kind: BillingProductKind;
	name: string;
	description: string;
	priceLabel: string;
	interval?: "/month";
	stripePriceEnvKey: string;
	credits: CreditBalances;
	subscriptionTier?: BillingSubscriptionTier;
	recommended?: boolean;
	unlimitedBronze?: boolean;
	features: string[];
}

export const BRONZE_FAIR_USE_MONTHLY_LIMIT = 10000;

export const BILLING_PRODUCTS: BillingProduct[] = [
	{
		id: "starter_pack",
		kind: "credit_pack",
		name: "Starter Pack",
		description: "A focused top-up for trying richer generations.",
		priceLabel: "5€ + VAT",
		stripePriceEnvKey: "STRIPE_PRICE_STARTER_PACK",
		credits: {bronze: 50, silver: 25, gold: 5},
		features: ["50 bronze", "25 silver", "5 gold", "Credits never expire"],
	},
	{
		id: "creator_pack",
		kind: "credit_pack",
		name: "Creator Pack",
		description: "Better value for regular lesson planning bursts.",
		priceLabel: "15€ + VAT",
		stripePriceEnvKey: "STRIPE_PRICE_CREATOR_PACK",
		credits: {bronze: 100, silver: 50, gold: 15},
		features: ["100 bronze", "50 silver", "15 gold", "Credits never expire"],
	},
	{
		id: "teacher_monthly",
		kind: "subscription",
		name: "Teacher",
		description: "Monthly credits for consistent classroom preparation.",
		priceLabel: "10€ + VAT",
		interval: "/month",
		stripePriceEnvKey: "STRIPE_PRICE_TEACHER_MONTHLY",
		credits: {bronze: 100, silver: 50, gold: 10},
		subscriptionTier: "teacher",
		features: [
			"100 bronze every month",
			"50 silver every month",
			"10 gold every month",
			"Unused silver and gold never expire",
		],
	},
	{
		id: "teacher_pro_monthly",
		kind: "subscription",
		name: "Teacher Pro",
		description: "More premium generations for demanding authoring work.",
		priceLabel: "20€ + VAT",
		interval: "/month",
		stripePriceEnvKey: "STRIPE_PRICE_TEACHER_PRO_MONTHLY",
		credits: {bronze: 0, silver: 100, gold: 20},
		subscriptionTier: "teacher_pro",
		recommended: true,
		unlimitedBronze: true,
		features: [
			"Unlimited bronze with fair use",
			"100 silver every month",
			"20 gold every month",
			"Unused silver and gold never expire",
		],
	},
];

export function getBillingProduct(productId: string): BillingProduct | undefined {
	return BILLING_PRODUCTS.find((product) => product.id === productId);
}

export function getBillingProductByStripePriceId(
	priceId: string | undefined,
	stripePriceIds: Record<string, string | null>,
): BillingProduct | undefined {
	if (!priceId) {
		return undefined;
	}

	return BILLING_PRODUCTS.find(
		(product) => stripePriceIds[product.stripePriceEnvKey] === priceId,
	);
}

export function isActiveBillingStatus(status: unknown): boolean {
	return status === "active" || status === "trialing";
}
