import {type ReactNode, useEffect, useState} from "react";
import {AlertCircle, Bot, Loader2, PieChart} from "lucide-react";
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
import {useAppearance} from "../../../../theme/AppearanceProvider";

const PERIOD_OPTIONS: Array<{
	label: string;
	value: BackendUsageAnalyticsPeriod;
}> = [
	{label: "7D", value: "7d"},
	{label: "30D", value: "30d"},
	{label: "6M", value: "6m"},
	{label: "12M", value: "12m"},
];

const PROVIDER_LOGOS: Record<string, string> = {
	anthropic: "/assets/brands/claude-reduced.svg",
	deepseek: "/assets/brands/deepseek-reduced.svg",
	google: "/assets/brands/gemini-color.svg",
	openai: "/assets/brands/chatgpt.png",
};

const DARK_PROVIDER_LOGOS: Record<string, string> = {
	openai: "/assets/brands/chatgpt-white.svg",
};

function formatNumber(value: number): string {
	return new Intl.NumberFormat("en").format(value);
}

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
	const {resolvedMode} = useAppearance();
	const logo =
		provider ?
			((resolvedMode === "dark" ?
				DARK_PROVIDER_LOGOS[provider]
			:	undefined) ?? PROVIDER_LOGOS[provider])
		:	undefined;

	if (!logo) {
		return <Bot size={20} />;
	}

	return <img src={logo} alt={label} className="h-6 w-6 object-contain" />;
}

function ProgressBar({value}: {value: number}) {
	const safeValue = Math.max(0, Math.min(100, value));

	return (
		<div className="h-2 overflow-hidden rounded-full bg-[#E5E5E7]">
			<div
				className="h-full rounded-full bg-[#15803D]"
				style={{width: `${safeValue}%`}}
			/>
		</div>
	);
}

function MetricCard({
	icon,
	label,
	value,
	description,
	iconBg = "#DCFCE7",
	children,
}: {
	icon: ReactNode;
	label: string;
	value: string;
	description: string;
	iconBg?: string;
	children?: ReactNode;
}) {
	return (
		<div className="flex min-h-[170px] min-w-0 flex-col justify-between rounded-[12px] border border-[#E5E5E7] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.025)]">
			<div>
				<div className="mb-4 flex items-start justify-between gap-3">
					<div
						className="app-analytics-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-black/[0.05] text-[#15803D]"
						style={{backgroundColor: iconBg}}
					>
						{icon}
					</div>
					<p className="line-clamp-2 text-right text-[34px] font-bold leading-none tracking-tight text-[#0F0F12]">
						{value}
					</p>
				</div>
				<p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#667085]">
					{label}
				</p>
				<p className="mt-2 min-h-[34px] text-[13px] leading-snug text-[#667085]">
					{description}
				</p>
			</div>
			{children}
		</div>
	);
}

function HighlightCard({
	icon,
	label,
	value,
	meta,
	count,
	iconBg = "#DCFCE7",
}: {
	icon: ReactNode;
	label: string;
	value: string;
	meta: string;
	count: string;
	iconBg?: string;
}) {
	return (
		<div className="flex min-w-0 items-center gap-3 rounded-[12px] border border-[#E5E5E7] bg-white px-3 py-3 sm:gap-4 sm:px-4">
			<div
				className="app-analytics-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] text-[#15803D]"
				style={{backgroundColor: iconBg}}
			>
				{icon}
			</div>
			<div className="min-w-0 flex-1">
				<div className="text-[12px] font-bold text-[#15803D]">
					{label}
				</div>
				<div className="mt-0.5 truncate text-[17px] font-bold text-[#0F0F12]">
					{value}
				</div>
			</div>
			<div className="min-w-[70px] shrink-0 text-right">
				<div className="truncate text-[11px] text-[#667085] sm:text-[12px]">
					{meta}
				</div>
				<div className="mt-1 truncate text-[13px] font-bold text-[#15803D]">
					{count}
				</div>
			</div>
		</div>
	);
}

function FavoriteTopicHighlight({analytics}: {analytics: BackendUsageAnalytics}) {
	const topic = analytics.favoriteTopic;
	const folderVisuals = topic ? getFolderVisuals(topic) : null;
	const emoji = topic ? getFolderEmoji(topic.icon) : "📁";

	return (
		<HighlightCard
			icon={<span className="text-[20px] leading-none">{emoji}</span>}
			iconBg={folderVisuals?.bgColor ?? "#DCFCE7"}
			label="Favorite Topic"
			value={topic ? topic.name : "None yet"}
			meta="Most active folder"
			count={
				topic ?
					`${topic.unitCount} unit${topic.unitCount === 1 ? "" : "s"}`
				:	"No units"
			}
		/>
	);
}

function ActivityChart({
	analytics,
	onPeriodChange,
	dark,
}: {
	analytics: BackendUsageAnalytics;
	onPeriodChange: (period: BackendUsageAnalyticsPeriod) => void;
	dark: boolean;
}) {
	return (
		<div className="min-w-0 rounded-[14px] border border-[#E5E5E7] bg-white p-4 shadow-[0_12px_30px_rgba(17,24,39,0.05)] sm:p-6">
			<div className="mb-5 flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0">
					<div>
						<h2 className="text-[18px] font-bold tracking-tight text-[#0F0F12]">
							AI Generations Over Time
						</h2>
						<p className="mt-0.5 text-[13px] text-[#667085]">
							Completed syllabus and module generations
						</p>
					</div>
				</div>
				<div className="flex w-full items-center overflow-hidden rounded-[10px] border border-[#E5E5E7] bg-white p-1 sm:w-auto">
					{PERIOD_OPTIONS.map((option) => (
						<button
							key={option.value}
							type="button"
							onClick={() => onPeriodChange(option.value)}
							className={`flex-1 rounded-[7px] px-3 py-1.5 text-[12px] font-bold transition sm:flex-none sm:px-4 ${
								analytics.period === option.value ?
									"bg-[#15803D] text-white shadow-[0_6px_16px_rgba(21,128,61,0.22)]"
								:	"text-[#667085] hover:text-[#0F0F12]"
							}`}
						>
							{option.label}
						</button>
					))}
				</div>
			</div>

			<ResponsiveContainer width="100%" height={250}>
				<AreaChart
					data={analytics.chart}
					margin={{top: 4, right: 0, left: -24, bottom: 0}}
				>
					<defs>
						<linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="#15803D" stopOpacity={0.14} />
							<stop offset="100%" stopColor="#15803D" stopOpacity={0} />
						</linearGradient>
					</defs>
					<CartesianGrid
						strokeDasharray="3 6"
						stroke={dark ? "#303030" : "#E4E7EC"}
						vertical={false}
					/>
					<XAxis
						dataKey="label"
						tick={{fontSize: 11, fill: dark ? "#FFFFFF" : "#667085", fontWeight: 600}}
						tickLine={false}
						axisLine={false}
						interval="preserveStartEnd"
					/>
					<YAxis
						tick={{fontSize: 11, fill: dark ? "#FFFFFF" : "#667085", fontWeight: 600}}
						tickLine={false}
						axisLine={false}
						allowDecimals={false}
						width={40}
					/>
					<Tooltip
						contentStyle={{
							fontSize: 13,
							borderRadius: 10,
							border: `1px solid ${dark ? "#303030" : "#E5E5E7"}`,
							backgroundColor: dark ? "#202020" : "#FFFFFF",
							boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
							color: dark ? "#FFFFFF" : "#1D1D1F",
						}}
						labelStyle={{fontWeight: 600, marginBottom: 2}}
						formatter={(value) => [Number(value ?? 0), "Generations"]}
						cursor={{stroke: dark ? "#303030" : "#E5E5E7", strokeWidth: 1}}
					/>
					<Area
						type="monotone"
						dataKey="count"
						stroke="#15803D"
						strokeWidth={2}
						fill="url(#areaGradient)"
						dot={false}
						activeDot={{r: 4, fill: "#15803D", strokeWidth: 0}}
					/>
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}

export function AnalyticsView() {
	const {resolvedMode} = useAppearance();
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
			<header className="app-dashboard-header hidden min-h-[80px] shrink-0 items-center border-b border-[#E5E5E7] bg-white/80 px-4 py-4 backdrop-blur-md sm:px-8 sm:py-0 md:flex">
				<div>
					<h1 className="text-[27px] font-bold tracking-tight text-[#1D1D1F] sm:text-[28px]">
						Usage & Analytics
					</h1>
					<p className="mt-0.5 text-[13px] text-[#86868B]">
						Track real unit progress and AI generation activity.
					</p>
				</div>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto bg-[#F7F8FA] px-4 py-6 sm:p-8">
				<div className="mx-auto w-full max-w-[520px] space-y-5 xl:max-w-[1260px]">
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
								className="mr-2 animate-spin text-[#15803D]"
							/>
							Loading usage metrics...
						</div>
					) : null}

					{analytics ? (
						<div
							className={`min-w-0 ${isLoading ? "opacity-60 transition" : "transition"}`}
						>
							<div className="grid gap-5 xl:grid-cols-[1.8fr_1fr]">
								<section className="min-w-0 rounded-[14px] border border-[#E5E5E7] bg-white p-4 shadow-[0_12px_30px_rgba(17,24,39,0.05)] sm:p-5">
									<div className="mb-6">
										<h2 className="text-[20px] font-bold tracking-tight text-[#0F0F12]">
											Overview
										</h2>
										<p className="mt-1 text-[13px] text-[#667085]">
											Key performance metrics at a glance
										</p>
									</div>
									<div className="grid min-w-0 gap-5 md:grid-cols-3">
										<MetricCard
											icon={
												<AssetIcon
													src="/assets/icons/book-open-green.svg"
													alt="Units created"
												/>
											}
											label="Units Created"
											value={formatNumber(analytics.unitsCreated)}
											description="Total units across all your folders"
										/>
										<MetricCard
											icon={<Bot size={19} />}
											iconBg="#DCFCE7"
											label="AI Generations"
											value={formatNumber(analytics.aiGenerations)}
											description="Syllabuses and modules generated"
										/>
										<MetricCard
											icon={<PieChart size={19} />}
											iconBg="#ECFDF3"
											label="Completion Rate"
											value={`${analytics.completionRate}%`}
											description="Percentage of unit content read"
										>
											<ProgressBar value={analytics.completionRate} />
										</MetricCard>
									</div>
								</section>

								<section className="min-w-0 rounded-[14px] border border-[#E5E5E7] bg-white p-4 shadow-[0_12px_30px_rgba(17,24,39,0.05)] sm:p-5">
									<div className="mb-6">
										<h2 className="text-[20px] font-bold tracking-tight text-[#0F0F12]">
											Highlights
										</h2>
										<p className="mt-1 text-[13px] text-[#667085]">
											Your most used model and topic
										</p>
									</div>
									<div className="space-y-5">
										<HighlightCard
											icon={
												<ProviderIcon
													provider={analytics.favoriteModel?.provider}
													label={
														analytics.favoriteModel?.label ??
														"Favorite model"
													}
												/>
											}
											label="Favorite Model"
											value={analytics.favoriteModel?.label ?? "None yet"}
											meta="Most-used AI"
											count={
												analytics.favoriteModel ?
													`${analytics.favoriteModel.count} run${
														analytics.favoriteModel.count === 1 ? "" : "s"
													}`
												:	"No runs"
											}
										/>
										<FavoriteTopicHighlight analytics={analytics} />
									</div>
								</section>
							</div>

							<div className="mt-5">
								<ActivityChart
									analytics={{...analytics, period}}
									onPeriodChange={setPeriod}
									dark={resolvedMode === "dark"}
								/>
							</div>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
