import {useEffect, useState} from "react";
import {Sparkles} from "lucide-react";
import {useAuth} from "../../../../auth/AuthProvider";
import {authClient, type CreditTransaction} from "../../../../auth/authClient";
import {CoinAmount, CoinIcon} from "@/components/Coin";

export function SubscriptionView() {
	const {user} = useAuth();
	const credits = user?.credits ?? {bronze: 0, silver: 0, gold: 0};
	const totalCredits = credits.bronze + credits.silver + credits.gold;
	const [transactions, setTransactions] = useState<CreditTransaction[]>([]);

	useEffect(() => {
		void authClient
			.listCreditTransactions()
			.then((response) => setTransactions(response.transactions))
			.catch(() => setTransactions([]));
	}, []);

	return (
		<div className="flex min-w-0 flex-1 flex-col">
			<header className="flex h-[80px] shrink-0 items-center border-b border-[#E5E5E7] bg-white/80 px-8 backdrop-blur-md">
				<div>
					<h1 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
						Subscription & Credits
					</h1>
					<p className="mt-0.5 text-[13px] text-[#86868B]">
						Manage your plan and AI credits
					</p>
				</div>
			</header>

			<div className="p-8">
				<div className="max-w-[900px] space-y-6">
					<div className="rounded-[12px] border border-[#E5E5E7] bg-white p-8">
						<div className="mb-6 flex items-start justify-between">
							<div>
								<h2 className="mb-1 text-[20px] font-bold text-[#1D1D1F]">
									Coin Wallet
								</h2>
								<p className="text-[13px] text-[#86868B]">
									Coins power syllabus creation, unit generation, and regeneration
								</p>
							</div>
							<button
								type="button"
								className="rounded-[8px] bg-[#1D1D1F] px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-[#333333]"
							>
								Managed by admins
							</button>
						</div>

						<div className="grid grid-cols-3 gap-4">
							{[
								"Unlimited didactic units",
								"Coin-backed content generation",
								"Advanced analytics",
								"Priority support",
								"Export to PDF, SCORM",
								"Team collaboration",
							].map((feature) => (
								<div
									key={feature}
									className="flex items-center gap-2"
								>
									<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#4ADE80]/10">
										<Sparkles
											size={12}
											className="text-[#4ADE80]"
										/>
									</div>
									<span className="text-[13px] text-[#1D1D1F]">
										{feature}
									</span>
								</div>
							))}
						</div>
					</div>

					<div className="rounded-[12px] border border-[#E5E5E7] bg-white p-8">
						<h2 className="mb-6 text-[18px] font-bold text-[#1D1D1F]">
							AI Credits
						</h2>
						<div className="mb-4 flex items-center justify-between">
							<div>
								<div className="text-[32px] font-bold text-[#1D1D1F]">
									{totalCredits}
								</div>
								<div className="text-[13px] text-[#86868B]">
									Total coins available
								</div>
							</div>
							<div className="rounded-[8px] border border-[#E5E5E7] px-5 py-2.5 text-[14px] font-semibold text-[#86868B]">
								Managed by admins
							</div>
						</div>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
							{[
								{label: "Bronze", type: "bronze" as const, value: credits.bronze, color: "#9A6B3D"},
								{label: "Silver", type: "silver" as const, value: credits.silver, color: "#8B98A7"},
								{label: "Gold", type: "gold" as const, value: credits.gold, color: "#D4A72C"},
							].map((coin) => (
								<div
									key={coin.label}
									className="rounded-[10px] border border-[#E5E5E7] bg-[#F5F5F7] p-4"
								>
									<div className="text-[12px] font-semibold uppercase tracking-wide text-[#86868B]">
										<span className="inline-flex items-center gap-2">
											<CoinIcon type={coin.type} size={20} />
											{coin.label}
										</span>
									</div>
									<div
										className="mt-2 text-[28px] font-bold"
										style={{color: coin.color}}
									>
										<CoinAmount
											type={coin.type}
											amount={coin.value}
											size={28}
										/>
									</div>
								</div>
							))}
						</div>
						<p className="mt-3 text-[12px] text-[#86868B]">
							Balances are synced from your authenticated account.
						</p>
					</div>

					<div className="overflow-hidden rounded-[12px] border border-[#E5E5E7] bg-white">
						<div className="border-b border-[#E5E5E7] p-6">
							<h2 className="text-[18px] font-bold text-[#1D1D1F]">
								Billing History
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
										Invoice
									</th>
								</tr>
							</thead>
							<tbody>
								{transactions.slice(0, 8).map((item) => (
									<tr
										key={item.id}
										className="border-b border-[#E5E5E7]"
									>
										<td className="px-6 py-4 text-[13px] text-[#1D1D1F]">
											{new Date(
												item.createdAt,
											).toLocaleDateString()}
										</td>
										<td className="px-6 py-4 text-[13px] text-[#86868B]">
											{item.reason.replaceAll("_", " ")}
										</td>
										<td className="px-6 py-4 text-[13px] font-semibold text-[#1D1D1F]">
											<span className="inline-flex items-center gap-1">
												{item.direction === "debit" ? "-" : "+"}
												<CoinAmount
													type={item.coinType}
													amount={item.amount}
													size={18}
												/>
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
