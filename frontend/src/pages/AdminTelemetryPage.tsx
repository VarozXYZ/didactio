import {useEffect, useState} from "react";
import {Navigate, useNavigate} from "react-router-dom";
import {ShieldCheck, RefreshCw} from "lucide-react";
import {dashboardApi, type LangSmithTelemetrySummaryDto} from "@/dashboard/api/dashboardApi";
import {useAuth} from "@/auth/useAuth";

function formatDuration(durationMs: number | null): string {
	if (durationMs === null) return "—";
	if (durationMs < 1000) return `${durationMs} ms`;
	return `${(durationMs / 1000).toFixed(1)} s`;
}

function formatTimestamp(timestamp: string | null): string {
	if (!timestamp) return "Running";
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(timestamp));
}

export default function AdminTelemetryPage() {
	const {user} = useAuth();
	const navigate = useNavigate();
	const [summary, setSummary] = useState<LangSmithTelemetrySummaryDto | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (user?.role !== "admin") return;

		let active = true;
		void dashboardApi
			.getAdminTelemetrySummary(50)
			.then((nextSummary) => {
				if (active) setSummary(nextSummary);
			})
			.catch((loadError: unknown) => {
				if (active) {
					setError(loadError instanceof Error ? loadError.message : "Could not load telemetry.");
				}
			})
			.finally(() => {
				if (active) setIsLoading(false);
			});

		return () => {
			active = false;
		};
	}, [user?.role]);

	if (user?.role !== "admin") {
		return <Navigate to="/dashboard" replace />;
	}

	return (
		<div className="min-h-screen bg-[#F5F5F7] px-6 py-8 font-sans text-[#1D1D1F] md:px-10">
			<div className="mx-auto max-w-6xl">
				<header className="mb-8 flex flex-wrap items-start justify-between gap-4">
					<div>
						<button
							type="button"
							onClick={() => navigate("/dashboard")}
							className="mb-4 text-sm font-medium text-[#00A83F] hover:underline"
						>
							← Back to dashboard
						</button>
						<div className="flex items-center gap-3">
							<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#DFF8E8] text-[#008F38]">
								<ShieldCheck size={22} />
							</div>
							<div>
								<p className="text-xs font-bold uppercase tracking-[0.18em] text-[#86868B]">Admin observability</p>
								<h1 className="mt-1 font-sora text-3xl font-bold tracking-tight">LangSmith telemetry</h1>
							</div>
						</div>
					</div>
					<button
						type="button"
						disabled={isLoading}
						onClick={() => window.location.reload()}
						className="inline-flex items-center gap-2 rounded-xl border border-[#D8D8DC] bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:border-[#00B84A] disabled:cursor-not-allowed disabled:opacity-60"
					>
						<RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
						Refresh
					</button>
				</header>

				{error && (
					<div className="mb-6 rounded-2xl border border-[#F2B8B5] bg-[#FFF4F3] px-5 py-4 text-sm text-[#A3261A]" role="alert">
						{error}
					</div>
				)}

				{isLoading && !summary ?
					<div className="rounded-3xl border border-[#E5E5E7] bg-white p-8 text-sm text-[#86868B]">Loading telemetry summary…</div>
				:	summary && (
					<>
						<div className="mb-6 rounded-2xl border border-[#E5E5E7] bg-white px-5 py-4 text-sm text-[#5F6368]">
							<span className="font-semibold text-[#1D1D1F]">Project:</span> {summary.project} · {summary.configured ? "Connected to LangSmith" : "Telemetry is not configured"}
							<span className="ml-2 text-xs text-[#86868B]">Updated {formatTimestamp(summary.generatedAt)}</span>
						</div>
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
							{[
								["Total runs", summary.totalRuns],
								["Completed", summary.completedRuns],
								["Failed", summary.failedRuns],
								["Active", summary.activeRuns],
								["Total tokens", summary.totalTokens.toLocaleString()],
							].map(([label, value]) => (
								<div key={label} className="rounded-2xl border border-[#E5E5E7] bg-white p-5 shadow-sm">
									<p className="text-xs font-bold uppercase tracking-wider text-[#86868B]">{label}</p>
									<p className="mt-3 font-sora text-2xl font-bold">{value}</p>
								</div>
							))}
						</div>
						<div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
							<section className="rounded-2xl border border-[#E5E5E7] bg-white p-6 shadow-sm">
								<h2 className="font-sora text-lg font-bold">Run types</h2>
								<p className="mt-1 text-sm text-[#86868B]">Breakdown of the latest sampled traces.</p>
								<div className="mt-5 space-y-3">
									{Object.entries(summary.byRunType).length === 0 ? <p className="text-sm text-[#86868B]">No runs available.</p> : Object.entries(summary.byRunType).map(([runType, count]) => (
										<div key={runType} className="flex items-center justify-between rounded-xl bg-[#F7F7F8] px-4 py-3 text-sm">
											<span className="font-medium">{runType}</span><span className="font-semibold tabular-nums">{count}</span>
										</div>
									))}
								</div>
								<p className="mt-5 text-sm text-[#86868B]">Average duration: <span className="font-semibold text-[#1D1D1F]">{formatDuration(summary.averageDurationMs)}</span></p>
							</section>
							<section className="rounded-2xl border border-[#E5E5E7] bg-white p-6 shadow-sm">
								<h2 className="font-sora text-lg font-bold">Latest runs</h2>
								<div className="mt-4 overflow-x-auto">
									<table className="w-full min-w-[620px] text-left text-sm">
										<thead className="border-b border-[#E5E5E7] text-xs uppercase tracking-wider text-[#86868B]"><tr><th className="pb-3 pr-4">Name</th><th className="pb-3 pr-4">Type</th><th className="pb-3 pr-4">Status</th><th className="pb-3 pr-4">Duration</th><th className="pb-3">Tokens</th></tr></thead>
										<tbody>{summary.latestRuns.length === 0 ? <tr><td colSpan={5} className="py-8 text-center text-[#86868B]">No recent runs.</td></tr> : summary.latestRuns.map((run) => <tr key={run.id} className="border-b border-[#F0F0F2] last:border-0"><td className="max-w-[220px] truncate py-3 pr-4 font-medium" title={run.name}>{run.name}</td><td className="py-3 pr-4 text-[#5F6368]">{run.runType}</td><td className={`py-3 pr-4 font-semibold ${run.hasError ? "text-[#C5221F]" : run.status === "running" ? "text-[#B06000]" : "text-[#008F38]"}`}>{run.status}</td><td className="py-3 pr-4 text-[#5F6368]">{formatDuration(run.durationMs)}</td><td className="py-3 tabular-nums text-[#5F6368]">{run.totalTokens.toLocaleString()}</td></tr>)}</tbody>
									</table>
								</div>
							</section>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
