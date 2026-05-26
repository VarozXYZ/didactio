import {useEffect, useMemo, useState} from "react";
import {
	CalendarDays,
	CreditCard,
	ExternalLink,
	Loader2,
	ShoppingBag,
	Wallet,
} from "lucide-react";
import {useAuth} from "../../../../auth/AuthProvider";
import {authClient, type CreditTransaction} from "../../../../auth/authClient";
import {
	dashboardApi,
	type BackendBillingProduct,
	type BackendBillingSummary,
} from "../../../api/dashboardApi";
import {CoinAmount, CoinIcon} from "@/components/Coin";

function formatDate(value?: string) {
	if (!value) {
		return "Not scheduled";
	}
	return new Date(value).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

const WALLET_COINS = [
	{label: "Bronze", type: "bronze" as const, color: "#9A6B3D"},
	{label: "Silver", type: "silver" as const, color: "#8B98A7"},
	{label: "Gold", type: "gold" as const, color: "#D4A72C"},
];

function WalletCoinCards({
	credits,
	compact = false,
}: {
	credits: Record<(typeof WALLET_COINS)[number]["type"], number>;
	compact?: boolean;
}) {
	return (
		<div className={compact ? "grid gap-3" : "grid grid-cols-1 gap-3 sm:grid-cols-3"}>
			{WALLET_COINS.map((coin) => (
				<div
					key={coin.label}
					className={`rounded-[10px] border bg-white shadow-[0_8px_18px_rgba(17,24,39,0.04)] ${
						coin.type === "bronze" || coin.type === "gold" ?
							"border-[#E9DCCB]"
						:	"border-[#E5E5E7]"
					} ${
						compact ?
							"flex min-h-[54px] items-center justify-between gap-4 px-4 py-2.5"
						:	"p-4"
					}`}
				>
					<div className="flex items-center gap-3">
						<CoinIcon type={coin.type} size={compact ? 30 : 20} />
						<div
							className={`font-bold uppercase text-[#667085] ${
								compact ? "text-[11px]" : "text-[12px]"
							}`}
						>
							{coin.label}
						</div>
					</div>
					<div
						className={`font-bold ${compact ? "text-[26px]" : "mt-2 text-[28px]"}`}
						style={{color: coin.color}}
					>
						{compact ?
							credits[coin.type]
						:	<CoinAmount type={coin.type} amount={credits[coin.type]} size={28} />}
					</div>
				</div>
			))}
		</div>
	);
}

function PlanIllustration() {
	return (
		<div className="relative hidden min-h-[210px] w-[210px] shrink-0 items-center justify-center md:flex">
			<div className="absolute left-3 top-7 h-2 w-2 rounded-full bg-[#D1FAE5]" />
			<div className="absolute right-6 top-3 h-1.5 w-1.5 rounded-full bg-[#BBF7D0]" />
			<div className="absolute bottom-8 left-0 h-1.5 w-1.5 rounded-full bg-[#D1D5DB]" />
			<div className="absolute bottom-5 right-8 text-[#D1D5DB]">✦</div>
			<div className="absolute left-8 top-[112px] h-16 w-32 rounded-[50%] border border-dashed border-[#D1D5DB]" />
			<div className="relative h-28 w-32 rounded-[22px] border border-[#D1D5DB] bg-gradient-to-br from-white to-[#F3F4F6] shadow-[0_18px_35px_rgba(17,24,39,0.08)]">
				<div className="absolute -left-5 top-7 h-14 w-16 -rotate-12 rounded-[14px] border border-[#E5E7EB] bg-white shadow-sm" />
				<div className="absolute -right-5 top-7 h-14 w-16 rotate-12 rounded-[14px] border border-[#BBF7D0] bg-[#ECFDF3] shadow-sm" />
				<div className="absolute left-1/2 top-[-18px] flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-[16px] border border-[#BBF7D0] bg-white text-[#15803D] shadow-[0_12px_22px_rgba(21,128,61,0.12)]">
					<Wallet size={25} />
				</div>
				<div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
					<CoinIcon type="bronze" size={20} />
					<CoinIcon type="silver" size={20} />
					<CoinIcon type="gold" size={20} />
				</div>
			</div>
		</div>
	);
}

function PurchasePanel({
	products,
	kind,
	action,
	busyProductId,
}: {
	products: BackendBillingProduct[];
	kind: "subscription" | "credit_pack";
	action: (productId: string) => void;
	busyProductId: string | null;
}) {
	const [selectedProductId, setSelectedProductId] = useState<string>();
	const isSubscription = kind === "subscription";
	const fallbackProduct = products.find((product) => product.recommended) ?? products[0];
	const selectedProduct =
		products.find((product) => product.id === selectedProductId) ?? fallbackProduct;

	return (
		<section>
			{selectedProduct && (
				<div className="rounded-[12px] border border-[#E5E5E7] bg-white p-5 shadow-[0_8px_18px_rgba(17,24,39,0.04)]">
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0">
							<div className="flex items-center gap-3">
								<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#ECFDF3] text-[#15803D]">
									{isSubscription ?
										<CalendarDays size={18} />
									:	<ShoppingBag size={18} />}
								</div>
								<div>
									<div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#15803D]">
										{isSubscription ? "Monthly" : "One time"}
									</div>
									<h3 className="text-[20px] font-bold leading-tight text-[#0F0F12]">
										{selectedProduct.name}
									</h3>
								</div>
							</div>
						</div>
						<div className="app-purchase-price-toggle grid min-w-[190px] grid-cols-2 gap-1 rounded-[10px] bg-[#F5F5F7] p-1">
							{products.map((product) => {
								const selected = selectedProduct.id === product.id;
								return (
									<button
										key={product.id}
										type="button"
										aria-pressed={selected}
										onClick={() => setSelectedProductId(product.id)}
										className={`app-purchase-price-option rounded-[8px] px-3 py-2 text-center text-[18px] font-bold leading-none transition-colors ${
											selected ?
												"app-purchase-price-option-selected bg-white text-[#0F0F12] shadow-sm"
											:	"text-[#667085] hover:bg-white/70"
										}`}
									>
										{product.priceLabel.replace(" + VAT", "").replace(" EUR", "€")}
									</button>
								);
							})}
						</div>
					</div>
					<div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
						{(["bronze", "silver", "gold"] as const).map((type) => (
							<div key={type} className="flex items-center gap-2 text-[15px] font-bold text-[#1D1D1F]">
								<CoinIcon type={type} size={24} />
								<span className="capitalize text-[#667085]">{type}</span>
								<span className="text-[#0F0F12]">
									{selectedProduct.unlimitedBronze && type === "bronze" ?
										"Unlimited*"
									:	`+${selectedProduct.credits[type]}`}
								</span>
							</div>
						))}
					</div>
					<div className="mt-6 flex justify-center">
						<button
							type="button"
							disabled={busyProductId === selectedProduct.id || !selectedProduct.stripeConfigured}
							onClick={() => action(selectedProduct.id)}
							className="inline-flex min-w-[170px] items-center justify-center gap-1.5 rounded-[8px] bg-[#0F0F12] px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-[#15803D] disabled:cursor-not-allowed disabled:bg-[#86868B]"
						>
							{busyProductId === selectedProduct.id && <Loader2 size={13} className="animate-spin" />}
							{!selectedProduct.stripeConfigured ?
								"Stripe price missing"
							: isSubscription ?
								"Subscribe"
							:	"Buy pack"}
							{selectedProduct.stripeConfigured && <ExternalLink size={12} />}
						</button>
					</div>
				</div>
			)}
		</section>
	);
}

export function SubscriptionView() {
	const {user} = useAuth();
	const credits = user?.credits ?? {bronze: 0, silver: 0, gold: 0};
	const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
	const [billing, setBilling] = useState<BackendBillingSummary | null>(null);
	const [busyProductId, setBusyProductId] = useState<string | null>(null);
	const [portalBusy, setPortalBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		void authClient
			.listCreditTransactions()
			.then((response) => setTransactions(response.transactions))
			.catch(() => setTransactions([]));

		void dashboardApi
			.getBillingSummary()
			.then(setBilling)
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : "Billing failed to load."),
			);
	}, []);

	const products = billing?.pricing.products ?? [];
	const packs = products.filter((product) => product.kind === "credit_pack");
	const subscriptions = products.filter(
		(product) => product.kind === "subscription",
	);
	const activePlan = useMemo(() => {
		const tier = billing?.billing?.subscriptionTier;
		return subscriptions.find((product) => product.subscriptionTier === tier);
	}, [billing?.billing?.subscriptionTier, subscriptions]);
	const status = billing?.billing?.subscriptionStatus ?? "No active plan";

	async function beginCheckout(productId: string) {
		try {
			setError(null);
			setBusyProductId(productId);
			const {url} = await dashboardApi.createBillingCheckoutSession(productId);
			window.location.assign(url);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Checkout could not start.");
		} finally {
			setBusyProductId(null);
		}
	}

	async function openPortal() {
		try {
			setError(null);
			setPortalBusy(true);
			const {url} = await dashboardApi.createBillingPortalSession();
			window.location.assign(url);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Billing portal could not open.");
		} finally {
			setPortalBusy(false);
		}
	}

	return (
		<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
			<header className="app-dashboard-header hidden h-[80px] shrink-0 items-center border-b border-[#E5E5E7] bg-white/80 px-8 backdrop-blur-md md:flex">
				<div>
					<h1 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
						Subscription & Credits
					</h1>
					<p className="mt-0.5 text-[13px] text-[#86868B]">
						Manage your plan, wallet, and Stripe billing
					</p>
				</div>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto bg-[#F7F8FA] p-8">
				<div className="mx-auto max-w-[1180px] space-y-4">
					{error && (
						<div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
							{error}
						</div>
					)}

					<div>
						<div className="mb-7">
							<div>
								<h2 className="text-[30px] font-bold tracking-tight text-[#0F0F12]">
									Current Plan
								</h2>
								<p className="mt-1 text-[14px] text-[#667085]">
									Use free credits, buy packs, or subscribe when you are ready.
								</p>
							</div>
						</div>

						<div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section className="app-plan-status-panel flex min-h-[255px] gap-7 rounded-[12px] border border-[#E9DCCB] bg-white p-6">
								<PlanIllustration />
								<div className="flex min-w-0 flex-1 flex-col justify-center">
									<div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#667085]">
										Plan Status
									</div>
									<div className="mt-2 text-[30px] font-bold capitalize leading-tight text-[#0F0F12]">
										{status.replaceAll("_", " ")}
									</div>
									<p className="mt-2 text-[14px] text-[#667085]">
										{activePlan ?
											`${activePlan.name} is currently active.`
										:	"Choose a plan or buy credits to get started."}
									</p>
									<div className="my-3 h-px bg-[#E5E5E7]" />
									<div className="mb-5 flex items-center gap-3">
										<div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#E5E5E7] bg-white text-[#667085]">
											<CalendarDays size={18} />
										</div>
										<div>
											<div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#667085]">
												Renews
											</div>
											<div className="text-[14px] font-bold text-[#0F0F12]">
												{formatDate(billing?.billing?.currentPeriodEnd)}
											</div>
										</div>
									</div>
									<button
										type="button"
										onClick={openPortal}
										disabled={portalBusy}
										className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-[#0F0F12] px-4 py-3 text-[14px] font-bold text-white transition-all hover:bg-[#15803D] disabled:cursor-not-allowed disabled:bg-[#86868B]"
									>
										{portalBusy ?
											<Loader2 size={16} className="animate-spin" />
										:	<CreditCard size={16} />}
										Manage billing
									</button>
								</div>
							</section>

							<section className="rounded-[12px] border border-[#E5E5E7] bg-white p-5">
								<h2 className="text-[18px] font-bold text-[#0F0F12]">
									Credit Wallet
								</h2>
								<p className="mt-1 text-[13px] text-[#667085]">
									Your available credits at a glance.
								</p>
								<div className="mt-4">
									<WalletCoinCards credits={credits} compact />
								</div>
							</section>
						</div>
					</div>

					<div id="plans-and-credit-packs">
						<div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<h2 className="text-[24px] font-bold tracking-tight text-[#0F0F12]">
									Plans & Credit Packs
								</h2>
								<p className="mt-1 text-[13px] text-[#667085]">
									Subscribe monthly or add one-off credits.
								</p>
							</div>
							<p className="text-[12px] font-medium text-[#86868B]">
								*Bronze unlimited includes fair use.
							</p>
						</div>
						<div className="mt-5 grid gap-5 lg:grid-cols-2">
							<PurchasePanel
								products={subscriptions}
								kind="subscription"
								action={beginCheckout}
								busyProductId={busyProductId}
							/>
							<PurchasePanel
								products={packs}
								kind="credit_pack"
								action={beginCheckout}
								busyProductId={busyProductId}
							/>
						</div>
					</div>

					<div className="overflow-hidden rounded-[12px] border border-[#E5E5E7] bg-white">
						<div className="border-b border-[#E5E5E7] p-6">
							<h2 className="text-[18px] font-bold text-[#1D1D1F]">
								Credit Activity
							</h2>
						</div>
						<table className="w-full">
							<thead className="border-b border-[#E5E5E7] bg-[#F5F5F7]">
								<tr>
									<th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#86868B]">
										Date
									</th>
									<th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#86868B]">
										Description
									</th>
									<th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#86868B]">
										Amount
									</th>
									<th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#86868B]">
										Type
									</th>
								</tr>
							</thead>
							<tbody>
								{transactions.slice(0, 8).map((item) => (
									<tr key={item.id} className="border-b border-[#E5E5E7]">
										<td className="px-6 py-4 text-[13px] text-[#1D1D1F]">
											{new Date(item.createdAt).toLocaleDateString()}
										</td>
										<td className="px-6 py-4 text-[13px] capitalize text-[#86868B]">
											{item.reason.replaceAll("_", " ")}
										</td>
										<td className="px-6 py-4 text-[13px] font-semibold text-[#1D1D1F]">
											<span className="inline-flex items-center gap-1">
												{item.direction === "debit" ? "-" : "+"}
												<CoinAmount type={item.coinType} amount={item.amount} size={18} />
											</span>
										</td>
										<td className="px-6 py-4">
											<span className="text-[13px] font-medium text-[#86868B]">
												{item.direction}
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}
