import type {ReactNode} from "react";
import {useState} from "react";
import {Link} from "react-router-dom";
import {useAuth} from "@/auth/useAuth";

const checkIcon = "/assets/icons/check-mark.png";
const coinIcons = {
	bronze: "/assets/props/bronce-coin.png",
	silver: "/assets/props/silver-coin.png",
	gold: "/assets/props/gold-coin.png",
};

type SubscriptionMode = "pro" | "plus";
type PackMode = "start" | "creator";
type CreditAmount = number | "unlimited";

type PlanBadge =
	| {type: "single"; text: string}
	| {type: "subscriptionToggle"}
	| {type: "packToggle"};

type CreditBundle = {
	bronze: CreditAmount;
	silver: CreditAmount;
	gold: CreditAmount;
};

type Plan = {
	name: string;
	price?: string;
	prices?: Record<SubscriptionMode, string>;
	packPrices?: Record<PackMode, string>;
	credits?: CreditBundle;
	subscriptionCredits?: Record<SubscriptionMode, CreditBundle>;
	packCredits?: Record<PackMode, CreditBundle>;
	interval: string;
	badge: PlanBadge;
	features: ReactNode[];
	cta: string;
	variant: "solid" | "outline";
	featured?: boolean;
};

const plans: Plan[] = [
	{
		name: "Free",
		price: "0 EUR",
		interval: "",
		badge: {type: "single", text: "Free Plan"},
		credits: {bronze: 30, silver: 15, gold: 0},
		features: [
			"Get free sign-up credits to try the platform",
			"Generations and models available are limited",
			"Advanced customization",
			"Full editor and PDF export",
		],
		cta: "Start now, free",
		variant: "outline",
	},
	{
		name: "Subscription",
		prices: {pro: "20 EUR", plus: "10 EUR"},
		interval: "/month",
		badge: {type: "subscriptionToggle"},
		subscriptionCredits: {
			pro: {bronze: 100, silver: 50, gold: 10},
			plus: {bronze: "unlimited", silver: 100, gold: 20},
		},
		features: [
			"Access to state of the art models",
			"Monthly credit allowance for generations and exports",
			"Dedicated support in various forms",
			"Infinite generations for exercises and practice *",
		],
		cta: "Subscribe",
		variant: "solid",
		featured: true,
	},
	{
		name: "Packs",
		packPrices: {start: "5 EUR", creator: "15 EUR"},
		interval: "",
		badge: {type: "packToggle"},
		packCredits: {
			start: {bronze: 50, silver: 25, gold: 5},
			creator: {bronze: 100, silver: 50, gold: 15},
		},
		features: [
			"One time credit pack purchase, no recurring payments",
			"Access to state of the art models",
			"Dedicated support in various forms",
			"Credits do not expire",
		],
		cta: "Buy Credits",
		variant: "outline",
	},
];

function ToggleButton({
	active,
	children,
	onClick,
}: {
	active: boolean;
	children: ReactNode;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={`px-4 py-1.5 rounded-full font-sora text-sm font-semibold transition-colors ${
				active ? "bg-accent text-dark" : "text-white/70 hover:text-white"
			}`}
		>
			{children}
		</button>
	);
}

function PlanBadge({
	badge,
	subscription,
	onSubscriptionChange,
	pack,
	onPackChange,
}: {
	badge: PlanBadge;
	subscription: SubscriptionMode;
	onSubscriptionChange: (mode: SubscriptionMode) => void;
	pack: PackMode;
	onPackChange: (mode: PackMode) => void;
}) {
	if (badge.type === "subscriptionToggle") {
		return (
			<div className="flex items-center gap-1 rounded-full bg-white/15 p-1">
				<ToggleButton
					active={subscription === "pro"}
					onClick={() => onSubscriptionChange("pro")}
				>
					Pro
				</ToggleButton>
				<ToggleButton
					active={subscription === "plus"}
					onClick={() => onSubscriptionChange("plus")}
				>
					Plus
				</ToggleButton>
			</div>
		);
	}

	if (badge.type === "packToggle") {
		return (
			<div className="flex items-center gap-1 rounded-full bg-white/15 p-1">
				<ToggleButton
					active={pack === "start"}
					onClick={() => onPackChange("start")}
				>
					Start
				</ToggleButton>
				<ToggleButton
					active={pack === "creator"}
					onClick={() => onPackChange("creator")}
				>
					Creator
				</ToggleButton>
			</div>
		);
	}

	return (
		<span className="rounded-full bg-white/15 px-5 py-1.5 font-sora text-sm font-semibold text-white whitespace-nowrap">
			{badge.text}
		</span>
	);
}

function InfinityMark() {
	return (
		<span className="inline-flex w-8 items-center justify-center gap-0.5 text-white">
			<svg
				viewBox="0 0 32 16"
				aria-hidden="true"
				className="h-3.5 w-6"
				fill="none"
			>
				<path
					d="M8.2 2.5C4.8 2.5 2.5 5 2.5 8s2.3 5.5 5.7 5.5c2.4 0 4.2-1.2 7.8-5.5 3.6 4.3 5.4 5.5 7.8 5.5 3.4 0 5.7-2.5 5.7-5.5s-2.3-5.5-5.7-5.5c-2.4 0-4.2 1.2-7.8 5.5-3.6-4.3-5.4-5.5-7.8-5.5Z"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="2.6"
				/>
			</svg>
			<span className="font-sora text-xs font-bold leading-none">*</span>
		</span>
	);
}

function CreditAmountValue({amount}: {amount: CreditAmount}) {
	return (
		<span className="font-sora text-base font-bold text-white">
			{amount === "unlimited" ? <InfinityMark /> : amount}
		</span>
	);
}

function CreditAmountRow({credits}: {credits?: CreditBundle}) {
	if (!credits) {
		return null;
	}

	const visibleCredits = (["bronze", "silver", "gold"] as const)
		.map((coinType) => ({
			coinType,
			amount: credits[coinType],
		}))
		.filter(({amount}) => amount === "unlimited" || amount > 0);

	if (visibleCredits.length === 0) {
		return null;
	}

	return (
		<div className="mx-auto mt-5 flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-md bg-white/10 px-4 py-3">
			{visibleCredits.map(({coinType, amount}, index) => (
				<div key={coinType} className="flex items-center gap-2">
					{index > 0 && (
						<span className="font-sora text-base font-semibold text-white/45">
							+
						</span>
					)}
					<span className="inline-flex items-center gap-1.5">
						<img
							src={coinIcons[coinType]}
							alt=""
							className="h-6 w-6 object-contain"
						/>
						<CreditAmountValue amount={amount} />
					</span>
				</div>
			))}
		</div>
	);
}

function PlanCard({
	plan,
	subscription,
	onSubscriptionChange,
	pack,
	onPackChange,
	isAuthenticated,
}: {
	plan: Plan;
	subscription: SubscriptionMode;
	onSubscriptionChange: (mode: SubscriptionMode) => void;
	pack: PackMode;
	onPackChange: (mode: PackMode) => void;
	isAuthenticated: boolean;
}) {
	const cardStyle =
		plan.featured ?
			"border-2 border-accent shadow-elevated min-h-[580px] lg:-mt-6 lg:-mb-6"
		:	"border border-accent shadow-card min-h-[520px]";

	const buttonStyle =
		plan.variant === "solid" ?
			"bg-accent text-dark hover:bg-accent/90"
		:	"border border-accent text-white hover:bg-accent/10";

	const price =
		plan.prices ?
			plan.prices[subscription]
		: plan.packPrices ?
			plan.packPrices[pack]
		:	plan.price;
	const credits =
		plan.subscriptionCredits ? plan.subscriptionCredits[subscription]
		: plan.packCredits ? plan.packCredits[pack]
		: plan.credits;
	const ctaTarget =
		isAuthenticated &&
		(plan.badge.type === "subscriptionToggle" ||
			plan.badge.type === "packToggle") ?
			"/dashboard?section=subscription"
		:	"/dashboard";

	return (
		<div
			className={`bg-dark rounded-sm px-6 py-7 flex flex-col sm:px-8 ${cardStyle}`}
		>
			<div>
				<h3 className="font-sora text-2xl font-semibold text-white">
					{plan.name}
				</h3>
				<div className="mt-3 flex items-end gap-3">
					<span className="font-sora text-4xl font-bold text-accent sm:text-5xl">
						{price}
					</span>
					<span className="font-inter text-lg text-white/50">
						{plan.interval}
					</span>
				</div>

				<div className="mt-6 flex items-center gap-4">
					<div className="h-px flex-1 bg-white/10" />
					<PlanBadge
						badge={plan.badge}
						subscription={subscription}
						onSubscriptionChange={onSubscriptionChange}
						pack={pack}
						onPackChange={onPackChange}
					/>
					<div className="h-px flex-1 bg-white/10" />
				</div>
				<CreditAmountRow credits={credits} />
			</div>

			<ul className="mt-7 flex flex-col gap-4">
				{plan.features.map((feature, index) => (
					<li key={index} className="flex gap-3">
						<img
							src={checkIcon}
							alt=""
							className="h-6 w-6 mt-0.5"
						/>
						<span className="font-inter text-base text-white/80 leading-relaxed">
							{feature}
						</span>
					</li>
				))}
			</ul>

			<Link
				to={ctaTarget}
				className={`mt-10 self-center rounded-full px-12 py-3 text-base font-sora font-semibold transition-colors ${buttonStyle}`}
			>
				{plan.cta}
			</Link>
		</div>
	);
}

function PricingPlans() {
	const {status} = useAuth();
	const [subscription, setSubscription] =
		useState<SubscriptionMode>("plus");
	const [pack, setPack] = useState<PackMode>("start");
	const isAuthenticated = status === "authenticated";

	return (
		<section className="flex w-full flex-col items-center py-10 md:py-16">
			<div className="w-[1120px] max-w-[calc(100%_-_2rem)]">
				<h1 className="text-center font-sora text-[2rem] font-bold leading-tight text-dark md:text-5xl">
					Flexible Plans for Every Need
				</h1>

				<div className="mt-9 grid grid-cols-1 items-start gap-6 md:mt-14 lg:grid-cols-3">
					{plans.map((plan) => (
						<PlanCard
							key={plan.name}
							plan={plan}
							subscription={subscription}
							onSubscriptionChange={setSubscription}
							pack={pack}
							onPackChange={setPack}
							isAuthenticated={isAuthenticated}
						/>
					))}
				</div>
			</div>
		</section>
	);
}

export default PricingPlans;
