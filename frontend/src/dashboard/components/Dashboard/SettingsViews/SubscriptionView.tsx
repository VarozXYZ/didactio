import {useEffect, useMemo, useState} from "react";
import {CreditCard, ExternalLink, Loader2} from "lucide-react";
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
		<div className={compact ? "flex flex-wrap justify-center gap-2" : "grid grid-cols-1 gap-3 sm:grid-cols-3"}>
			{WALLET_COINS.map((coin) => (
				<div
					key={coin.label}
					className={`rounded-[10px] border border-[#E5E5E7] bg-[#F5F5F7] ${
						compact ?
							"inline-flex min-w-[140px] items-center justify-between gap-3 px-3 py-2"
						:	"p-4"
					}`}
				>
					<div
						className={`font-semibold uppercase text-[#86868B] ${
							compact ? "text-[11px]" : "text-[12px]"
						}`}
					>
						<span className="inline-flex items-center gap-2 whitespace-nowrap">
							<CoinIcon type={coin.type} size={20} />
							{coin.label}
						</span>
					</div>
					<div
						className={`font-bold ${compact ? "text-[20px]" : "mt-2 text-[28px]"}`}
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

function ProductCard({
	product,
	action,
	busy,
}: {
	product: BackendBillingProduct;
	action: (productId: string) => void;
	busy: boolean;
}) {
	const isSubscription = product.kind === "subscription";

	return (
		<div
			className={`relative rounded-[10px] border p-4 ${
				product.recommended ?
					"border-[#1D1D1F] bg-[#F5F5F7]"
				:	"border-[#E5E5E7] bg-white"
			}`}
		>
			{product.recommended && (
				<span className="absolute right-3 top-3 rounded-full bg-[#1D1D1F] px-2.5 py-1 text-[10px] font-bold uppercase text-white">
					Recommended
				</span>
			)}
			<div className="pr-28">
				<h3 className="text-[16px] font-bold text-[#1D1D1F]">
					{product.name}
				</h3>
				<p
					className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
						isSubscription ?
							"bg-[#E8F3FF] text-[#0066CC]"
						:	"bg-[#ECFDF5] text-[#047857]"
					}`}
				>
					{isSubscription ? "Monthly" : "One-time"}
				</p>
			</div>
			<div className="mt-3 flex items-end gap-1">
				<span className="text-[26px] font-bold text-[#1D1D1F]">
					{product.priceLabel.replace(" + VAT", "")}
				</span>
				<span className="pb-1 text-[12px] font-semibold text-[#86868B]">
					+ VAT {product.interval ?? ""}
				</span>
			</div>
			<div className="mt-3 grid grid-cols-3 gap-2">
				{(["bronze", "silver", "gold"] as const).map((type) => (
					<div
						key={type}
						className="rounded-[8px] border border-[#E5E5E7] bg-white px-2 py-1.5"
					>
						<div className="flex min-h-[22px] items-center justify-center gap-1">
							{product.unlimitedBronze && type === "bronze" ?
								<>
									<CoinIcon type={type} size={16} />
									<span className="text-[12px] font-semibold text-[#1D1D1F]">
										Unlimited*
									</span>
								</>
							:	<>
									<span className="bg-gradient-to-br from-[#34D399] to-[#0EA5E9] bg-clip-text text-[15px] font-bold text-transparent">
										+
									</span>
									<CoinIcon type={type} size={16} />
									<span className="text-[12px] font-semibold text-[#1D1D1F]">
										{product.credits[type]}
									</span>
								</>}
						</div>
						<div className="mt-0.5 text-center text-[9px] font-semibold uppercase text-[#86868B]">
							{type}
						</div>
					</div>
				))}
			</div>
			<button
				type="button"
				disabled={busy || !product.stripeConfigured}
				onClick={() => action(product.id)}
				className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-[#1D1D1F] px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-[#333333] disabled:cursor-not-allowed disabled:bg-[#86868B]"
			>
				{busy && <Loader2 size={15} className="animate-spin" />}
				{!product.stripeConfigured ?
					"Stripe price missing"
				: isSubscription ?
					"Subscribe"
				:	"Buy pack"}
				{product.stripeConfigured && <ExternalLink size={14} />}
			</button>
		</div>
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
		<div className="flex min-w-0 flex-1 flex-col">
			<header className="flex h-[80px] shrink-0 items-center border-b border-[#E5E5E7] bg-white/80 px-8 backdrop-blur-md">
				<div>
					<h1 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
						Subscription & Credits
					</h1>
					<p className="mt-0.5 text-[13px] text-[#86868B]">
						Manage your plan, wallet, and Stripe billing
					</p>
				</div>
			</header>

			<div className="p-8">
				<div className="max-w-[1100px] space-y-6">
					{error && (
						<div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
							{error}
						</div>
					)}

					<div className="relative rounded-[12px] border border-[#E5E5E7] bg-white p-8">
						<div className="flex flex-col gap-6">
							<div className="flex flex-col items-center gap-5 text-center">
								<div className="max-w-[560px]">
								<h2 className="text-[20px] font-bold text-[#1D1D1F]">
									Current Plan
								</h2>
								<p className="mt-1 text-[13px] text-[#86868B]">
									{activePlan ?
										`${activePlan.name} plan`
									:	"Use free credits, buy packs, or subscribe when you are ready."}
								</p>
								<div className="mx-auto mt-4 grid max-w-[360px] gap-3 sm:grid-cols-2">
									<div className="rounded-[8px] bg-[#F5F5F7] p-4">
										<div className="text-[11px] font-bold uppercase text-[#86868B]">
											Status
										</div>
										<div className="mt-1 text-[16px] font-bold capitalize text-[#1D1D1F]">
											{status.replaceAll("_", " ")}
										</div>
									</div>
									<div className="rounded-[8px] bg-[#F5F5F7] p-4">
										<div className="text-[11px] font-bold uppercase text-[#86868B]">
											Renews
										</div>
										<div className="mt-1 text-[16px] font-bold text-[#1D1D1F]">
											{formatDate(billing?.billing?.currentPeriodEnd)}
										</div>
									</div>
								</div>
							</div>
							<button
								type="button"
								onClick={openPortal}
								disabled={portalBusy}
								className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-[#1D1D1F] px-5 py-2.5 text-[14px] font-semibold text-[#1D1D1F] transition-all hover:bg-[#F5F5F7] disabled:cursor-not-allowed disabled:opacity-50 lg:absolute lg:right-8 lg:top-8"
							>
								{portalBusy ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
								Manage billing
							</button>
						</div>
							<div>
								<h2 className="mb-3 text-center text-[16px] font-bold text-[#1D1D1F]">
									Coins Available
								</h2>
								<WalletCoinCards credits={credits} compact />
							</div>
						</div>
					</div>

					<div className="rounded-[12px] border border-[#E5E5E7] bg-white p-6">
						<div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<h2 className="text-[18px] font-bold text-[#1D1D1F]">
									Plans & Credit Packs
								</h2>
								<p className="mt-1 text-[13px] text-[#86868B]">
									Subscribe monthly or add one-off credits.
								</p>
							</div>
							<p className="text-[12px] font-medium text-[#86868B]">
								*Bronze unlimited includes fair use.
							</p>
						</div>
						<div className="mt-4 grid gap-4 lg:grid-cols-2">
							<div className="rounded-[10px] bg-[#F5FAFF] p-3">
								<div className="mb-3 flex items-center justify-between">
									<div>
										<h3 className="text-[13px] font-bold uppercase text-[#0066CC]">
											Monthly Plans
										</h3>
										<p className="text-[12px] text-[#5E6A77]">
											Renew every month.
										</p>
									</div>
								</div>
								<div className="grid gap-3">
									{subscriptions.map((product) => (
										<ProductCard
											key={product.id}
											product={product}
											action={beginCheckout}
											busy={busyProductId === product.id}
										/>
									))}
								</div>
							</div>
							<div className="rounded-[10px] bg-[#F3FBF7] p-3">
								<div className="mb-3 flex items-center justify-between">
									<div>
										<h3 className="text-[13px] font-bold uppercase text-[#047857]">
											One-Time Credit Packs
										</h3>
										<p className="text-[12px] text-[#647067]">
											Pay once. Credits never expire.
										</p>
									</div>
								</div>
								<div className="grid gap-3">
									{packs.map((product) => (
										<ProductCard
											key={product.id}
											product={product}
											action={beginCheckout}
											busy={busyProductId === product.id}
										/>
									))}
								</div>
							</div>
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
