import {type ReactNode, useEffect, useState} from "react";
import {AlertCircle, Loader2, Sparkles} from "lucide-react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	type BackendUsageAnalytics,
	type BackendUsageAnalyticsPeriod,
	dashboardApi,
} from "../../../api/dashboardApi";
import {getFolderEmoji, getFolderVisuals} from "../../../utils/folderDisplay";

const PERIOD_OPTIONS: Array<{
	label: string;
	value: BackendUsageAnalyticsPeriod;
}> = [
	{label: "7D", value: "7d"},
	{label: "30D", value: "30d"},
	{label: "6M", value: "6m"},
	{label: "12M", value: "12m"},
];

function formatNumber(value: number): string {
	return new Intl.NumberFormat("en").format(value);
}

const PROVIDER_LOGOS: Record<string, string> = {
	anthropic: "/assets/brands/claude-reduced.svg",
	deepseek: "/assets/brands/deepseek-reduced.svg",
	google: "/assets/brands/gemini.png",
	openai: "/assets/brands/chatgpt.png",
};

function AssetIcon({src, alt}: {src: string; alt: string}) {
	return <img src={src} alt={alt} className="h-5 w-5 object-contain" />;
}

function ProviderIcon({
	provider,
	label,
}: {
	provider?: string;
	label: string;
}) {
	const logo = provider ? PROVIDER_LOGOS[provider] : undefined;

	if (!logo) {
		return <Sparkles size={18} />;
	}

	return <img src={logo} alt={label} className="h-5 w-5 object-contain" />;
}

function MetricCard({
	icon,
	label,
	value,
	description,
	iconBg,
}: {
	icon: ReactNode;
	label: string;
	value: string;
	description: string;
	iconBg?: string;
}) {
	return (
		<div className="flex h-[130px] flex-col justify-between rounded-[14px] border border-black/[0.07] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.025)]">
			<div className="flex items-center justify-between gap-2">
				<p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#AEAEB2]">
					{label}
				</p>
				<div
					className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-black/[0.05] text-[#1D1D1F]"
					style={{backgroundColor: iconBg ?? "#F5F5F7"}}
				>
					{icon}
				</div>
			</div>
			<div>
				<p className="line-clamp-2 text-[21px] font-bold leading-tight tracking-tight text-[#1D1D1F]">
					{value}
				</p>
				<p className="mt-1 line-clamp-1 text-[11.5px] text-[#86868B]">
					{description}
				</p>
			</div>
		</div>
	);
}

function FavoriteTopicMetric({analytics}: {analytics: BackendUsageAnalytics}) {
	const topic = analytics.favoriteTopic;
	const folderVisuals = topic ? getFolderVisuals(topic) : null;
	const emoji = topic ? getFolderEmoji(topic.icon) : "📁";

	return (
		<MetricCard
			icon={<span className="text-[15px] leading-none">{emoji}</span>}
			iconBg={folderVisuals?.bgColor ?? "#F5F5F7"}
			label="Favorite Topic"
			value={topic ? topic.name : "None yet"}
			description={
				topic ?
					`Most active folder · ${topic.unitCount} unit${topic.unitCount === 1 ? "" : "s"}`
				:	"Create units inside folders to discover it"
			}
		/>
	);
}

function ActivityChart({
	analytics,
	onPeriodChange,
}: {
	analytics: BackendUsageAnalytics;
	onPeriodChange: (period: BackendUsageAnalyticsPeriod) => void;
}) {
	return (
		<div className="rounded-[14px] border border-[#E5E5E7] bg-white p-6">
			<div className="mb-5 flex flex-wrap items-start justify-between gap-4">
				<div>
					<h2 className="text-[17px] font-bold tracking-tight text-[#1D1D1F]">
						AI Generations Over Time
					</h2>
					<p className="mt-0.5 text-[13px] text-[#AEAEB2]">
						Completed syllabus and module generations
					</p>
				</div>
				<div className="flex items-center gap-1 rounded-[10px] bg-[#F5F5F7] p-1">
					{PERIOD_OPTIONS.map((option) => (
						<button
							key={option.value}
							type="button"
							onClick={() => onPeriodChange(option.value)}
							className={`rounded-[7px] px-3 py-1.5 text-[12px] font-bold transition ${
								analytics.period === option.value ?
									"bg-white text-[#1D1D1F] shadow-sm"
								:	"text-[#AEAEB2] hover:text-[#6E6E73]"
							}`}
						>
							{option.label}
						</button>
					))}
				</div>
			</div>

			<ResponsiveContainer width="100%" height={220}>
				<AreaChart
					data={analytics.chart}
					margin={{top: 4, right: 4, left: -16, bottom: 0}}
				>
					<defs>
						<linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="#3B82F6" stopOpacity={0.15} />
							<stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
						</linearGradient>
					</defs>
					<CartesianGrid
						strokeDasharray="3 6"
						stroke="#F0F0F2"
						vertical={false}
					/>
					<XAxis
						dataKey="label"
						tick={{fontSize: 11, fill: "#AEAEB2", fontWeight: 600}}
						tickLine={false}
						axisLine={false}
						interval="preserveStartEnd"
					/>
					<YAxis
						tick={{fontSize: 11, fill: "#AEAEB2", fontWeight: 600}}
						tickLine={false}
						axisLine={false}
						allowDecimals={false}
						width={40}
					/>
					<Tooltip
						contentStyle={{
							fontSize: 13,
							borderRadius: 10,
							border: "1px solid #E5E5E7",
							boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
							color: "#1D1D1F",
						}}
						labelStyle={{fontWeight: 600, marginBottom: 2}}
						formatter={(value) => [Number(value ?? 0), "Generations"]}
						cursor={{stroke: "#E5E5E7", strokeWidth: 1}}
					/>
					<Area
						type="monotone"
						dataKey="count"
						stroke="#3B82F6"
						strokeWidth={2}
						fill="url(#areaGradient)"
						dot={false}
						activeDot={{r: 4, fill: "#3B82F6", strokeWidth: 0}}
					/>
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}

export function AnalyticsView() {
	const [period, setPeriod] = useState<BackendUsageAnalyticsPeriod>("30d");
	const [analytics, setAnalytics] = useState<BackendUsageAnalytics | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let isMounted = true;
		setIsLoading(true);
		setError(null);

		void dashboardApi
			.getUsageAnalytics(period)
			.then((nextAnalytics) => {
				if (!isMounted) return;
				setAnalytics(nextAnalytics);
			})
			.catch((loadError) => {
				if (!isMounted) return;
				setError(
					loadError instanceof Error ?
						loadError.message
					:	"Failed to load usage metrics.",
				);
			})
			.finally(() => {
				if (isMounted) {
					setIsLoading(false);
				}
			});

		return () => {
			isMounted = false;
		};
	}, [period]);

	return (
		<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
			<header className="flex h-[80px] shrink-0 items-center border-b border-[#E5E5E7] bg-white/80 px-8 backdrop-blur-md">
				<div>
					<h1 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
						Usage & Metrics
					</h1>
					<p className="mt-0.5 text-[13px] text-[#86868B]">
						Track real unit progress and AI generation activity.
					</p>
				</div>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto p-8">
				<div className="mx-auto max-w-[960px] space-y-5">
					{error ? (
						<div className="flex items-center gap-3 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
							<AlertCircle size={16} />
							{error}
						</div>
					) : null}

					{isLoading && !analytics ? (
						<div className="flex min-h-[360px] items-center justify-center rounded-[18px] border border-black/[0.07] bg-white text-[13px] text-[#86868B]">
							<Loader2
								size={18}
								className="mr-2 animate-spin text-[#3B82F6]"
							/>
							Loading usage metrics...
						</div>
					) : null}

					{analytics ? (
						<div className={isLoading ? "opacity-60 transition" : "transition"}>
							<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
								<MetricCard
									icon={
										<AssetIcon
											src="/assets/icons/project.png"
											alt="Units created"
										/>
									}
									label="Units Created"
									value={formatNumber(analytics.unitsCreated)}
									description="Total units across all your folders"
								/>
								<MetricCard
									icon={<Sparkles size={15} />}
									label="AI Generations"
									value={formatNumber(analytics.aiGenerations)}
									description="Syllabuses and modules generated"
								/>
								<MetricCard
									icon={
										<AssetIcon
											src="/assets/icons/check-mark.png"
											alt="Completion rate"
										/>
									}
									label="Completion Rate"
									value={`${analytics.completionRate}%`}
									description={`${formatNumber(analytics.readBlockCount)} of ${formatNumber(
										analytics.totalBlockCount,
									)} blocks read`}
								/>
								<MetricCard
									icon={
										<ProviderIcon
											provider={analytics.favoriteModel?.provider}
											label={analytics.favoriteModel?.label ?? "Favorite model"}
										/>
									}
									label="Favorite Model"
									value={analytics.favoriteModel?.label ?? "None yet"}
									description={
										analytics.favoriteModel ?
											`Most-used AI · ${analytics.favoriteModel.count} run${
												analytics.favoriteModel.count === 1 ? "" : "s"
											}`
										:	"Complete AI generations to discover it"
									}
								/>
								<FavoriteTopicMetric analytics={analytics} />
							</div>

							<div className="mt-5">
								<ActivityChart
									analytics={{...analytics, period}}
									onPeriodChange={setPeriod}
								/>
							</div>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
