import {Sparkles} from "lucide-react";
import {useAuth} from "../../../../auth/AuthProvider";

export function SubscriptionView() {
	const {user} = useAuth();
	const credits = user?.credits ?? {bronze: 0, silver: 0, gold: 0};
	const totalCredits = credits.bronze + credits.silver + credits.gold;

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
									Pro Plan
								</h2>
								<p className="text-[13px] text-[#86868B]">
									Unlimited AI generations and exports
								</p>
							</div>
							<button
								type="button"
								className="rounded-[8px] bg-[#1D1D1F] px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-[#333333]"
							>
								Manage Plan
							</button>
						</div>

						<div className="grid grid-cols-3 gap-4">
							{[
								"Unlimited didactic units",
								"AI-powered content generation",
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
								{label: "Bronze", value: credits.bronze, color: "#9A6B3D"},
								{label: "Silver", value: credits.silver, color: "#8B98A7"},
								{label: "Gold", value: credits.gold, color: "#D4A72C"},
							].map((coin) => (
								<div
									key={coin.label}
									className="rounded-[10px] border border-[#E5E5E7] bg-[#F5F5F7] p-4"
								>
									<div className="text-[12px] font-semibold uppercase tracking-wide text-[#86868B]">
										{coin.label}
									</div>
									<div
										className="mt-2 text-[28px] font-bold"
										style={{color: coin.color}}
									>
										{coin.value}
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
								{[
									{
										date: "Jan 1, 2026",
										desc: "Initial wallet enabled",
										amount: `${credits.gold} gold available`,
									},
									{
										date: "Jan 1, 2026",
										desc: "Silver coin balance",
										amount: `${credits.silver} silver available`,
									},
									{
										date: "Jan 1, 2026",
										desc: "Bronze coin balance",
										amount: `${credits.bronze} bronze available`,
									},
								].map((item) => (
									<tr
										key={item.date}
										className="border-b border-[#E5E5E7]"
									>
										<td className="px-6 py-4 text-[13px] text-[#1D1D1F]">
											{item.date}
										</td>
										<td className="px-6 py-4 text-[13px] text-[#86868B]">
											{item.desc}
										</td>
										<td className="px-6 py-4 text-[13px] font-semibold text-[#1D1D1F]">
											{item.amount}
										</td>
										<td className="px-6 py-4">
											<span className="text-[13px] font-medium text-[#86868B]">
												Synced
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
