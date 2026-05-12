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
		credits: {bronze: 100, silver: 30, gold: 3},
		features: ["100 bronze", "30 silver", "3 gold", "Credits never expire"],
	},
	{
		id: "creator_pack",
		kind: "credit_pack",
		name: "Creator Pack",
		description: "Better value for regular lesson planning bursts.",
		priceLabel: "15€ + VAT",
		stripePriceEnvKey: "STRIPE_PRICE_CREATOR_PACK",
		credits: {bronze: 400, silver: 110, gold: 12},
		features: ["400 bronze", "110 silver", "12 gold", "Credits never expire"],
	},
	{
		id: "teacher_monthly",
		kind: "subscription",
		name: "Teacher",
		description: "Monthly credits for consistent classroom preparation.",
		priceLabel: "10€ + VAT",
		interval: "/month",
		stripePriceEnvKey: "STRIPE_PRICE_TEACHER_MONTHLY",
		credits: {bronze: 0, silver: 50, gold: 5},
		subscriptionTier: "teacher",
		features: [
			"Unlimited bronze with fair use",
			"50 silver every month",
			"5 gold every month",
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
		credits: {bronze: 0, silver: 120, gold: 15},
		subscriptionTier: "teacher_pro",
		recommended: true,
		features: [
			"Unlimited bronze with fair use",
			"120 silver every month",
			"15 gold every month",
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
