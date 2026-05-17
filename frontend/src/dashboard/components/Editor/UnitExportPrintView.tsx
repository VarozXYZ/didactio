import type {CSSProperties} from "react";
import type {UnitExportSnapshot} from "../../export/unitExport";

type UnitExportPrintViewProps = {
	snapshot: UnitExportSnapshot;
	onClose: () => void;
	onPrint: () => void;
};

function resolvePrintVars(snapshot: UnitExportSnapshot): CSSProperties {
	const theme = snapshot.unit.presentationTheme;
	const headingFont =
		theme?.headingFont === "eb-garamond" ? "EB Garamond"
		: theme?.headingFont === "crimson-pro" ? "Crimson Pro"
		: theme?.headingFont === "dm-sans" ? "DM Sans"
		: "Sora";
	return {
		"--unit-print-body":
			theme?.bodyFont === "eb-garamond" ? "EB Garamond"
			: theme?.bodyFont === "crimson-pro" ? "Crimson Pro"
			: theme?.bodyFont === "dm-sans" ? "DM Sans"
			: "Inter",
		"--unit-print-heading": headingFont,
		"--unit-print-accent": theme?.accentColor ?? "#15803D",
		"--unit-print-heading-color": theme?.headingColor ?? "#1D1D1F",
		"--unit-print-body-color": theme?.bodyColor ?? "#2F3137",
	} as CSSProperties;
}

export function UnitExportPrintView({
	snapshot,
	onClose,
	onPrint,
}: UnitExportPrintViewProps) {
	const omittedCount = snapshot.skippedModules.length;

	return (
		<div
			className="unit-print-root fixed inset-0 z-[80] overflow-auto bg-[#F5F5F7] text-[#1D1D1F]"
			style={resolvePrintVars(snapshot)}
		>
			<style>
				{`
					.unit-print-toolbar {
						position: sticky;
						top: 0;
						z-index: 2;
						display: flex;
						align-items: center;
						justify-content: space-between;
						gap: 16px;
						border-bottom: 1px solid #E5E5E7;
						background: rgba(255,255,255,.92);
						backdrop-filter: blur(12px);
						padding: 12px 20px;
					}
					.unit-print-document {
						width: min(920px, calc(100% - 32px));
						margin: 24px auto 56px;
						background: #fff;
						box-shadow: 0 18px 60px rgba(0,0,0,.12);
					}
					.unit-print-brand {
						display: none;
					}
					.unit-print-page {
						min-height: 1120px;
						padding: 64px 72px;
					}
					.unit-print-cover {
						min-height: 1120px;
					}
					.unit-print-kicker {
						color: var(--unit-print-accent);
						font-family: Inter, sans-serif;
						font-size: 12px;
						font-weight: 800;
						letter-spacing: .18em;
						text-transform: uppercase;
					}
					.unit-print-root h1,
					.unit-print-root h2,
					.unit-print-root h3 {
						color: var(--unit-print-heading-color);
						font-family: var(--unit-print-heading), Sora, sans-serif;
						letter-spacing: 0;
					}
					.unit-print-root h1 {
						margin: 14px 0 18px;
						font-size: 54px;
						line-height: 1.05;
					}
					.unit-print-root h2 {
						margin: 0 0 12px;
						font-size: 28px;
						line-height: 1.18;
					}
					.unit-print-root h3 {
						margin: 14px 0 10px;
						font-size: 20px;
					}
					.unit-print-root p,
					.unit-print-root li,
					.unit-print-root td {
						color: var(--unit-print-body-color);
						font-family: var(--unit-print-body), Inter, sans-serif;
						font-size: 15px;
						line-height: 1.72;
					}
					.unit-print-note {
						border: 1px solid #E5E5E7;
						border-radius: 8px;
						padding: 12px 14px;
					}
					.unit-print-toc {
						list-style: none;
						margin: 34px 0 0;
						padding: 0;
					}
					.unit-print-toc-title {
						margin-top: 70px !important;
						border-top: 1px solid #E5E5E7;
						padding-top: 22px;
					}
					.unit-print-toc li {
						display: grid;
						grid-template-columns: 44px 1fr;
						gap: 16px;
						border-bottom: 1px solid #ECECF0;
						padding: 12px 0;
					}
					.unit-print-module {
						break-before: page;
						page-break-before: always;
					}
					.unit-print-module-header {
						border-bottom: 1px solid #E5E5E7;
						margin-bottom: 24px;
						padding-bottom: 18px;
					}
					.unit-print-content {
						font-family: var(--unit-print-body), Inter, sans-serif;
					}
					.unit-print-content h2,
					.unit-print-content h3,
					.unit-print-content h4 {
						break-after: avoid;
						page-break-after: avoid;
					}
					.unit-print-content p,
					.unit-print-content ul,
					.unit-print-content ol,
					.unit-print-content blockquote,
					.unit-print-content table,
					.unit-print-content pre {
						break-inside: avoid;
						page-break-inside: avoid;
					}
					.unit-print-content table {
						width: 100%;
						border-collapse: collapse;
					}
					.unit-print-content th,
					.unit-print-content td {
						border: 1px solid #E5E5E7;
						padding: 8px 10px;
						text-align: left;
						vertical-align: top;
					}
					.unit-print-content pre {
						overflow-x: auto;
						border: 1px solid #D0D7DE;
						border-radius: 8px;
						background: #F6F8FA;
						padding: 14px;
						white-space: pre-wrap;
					}
					.unit-print-content code {
						font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
						font-size: 13px;
					}
					@page {
						size: A4;
						margin: 0;

						@bottom-center {
							content: counter(page);
							color: #86868B;
							font-family: Inter, sans-serif;
							font-size: 9px;
							font-weight: 700;
						}
					}
					@media print {
						html,
						body,
						#root {
							width: 100% !important;
							height: auto !important;
							margin: 0 !important;
							padding: 0 !important;
							overflow: visible !important;
							background: #fff !important;
						}
						body * {
							visibility: hidden !important;
						}
						.unit-print-root,
						.unit-print-root * {
							visibility: visible !important;
						}
						.unit-print-root {
							position: absolute !important;
							left: 0 !important;
							top: 0 !important;
							right: auto !important;
							bottom: auto !important;
							width: 100% !important;
							height: auto !important;
							overflow: visible !important;
							background: #fff !important;
							transform: none !important;
						}
						.unit-print-toolbar {
							display: none !important;
						}
						.unit-print-brand {
							display: block !important;
							position: fixed !important;
							top: 8mm !important;
							right: 8mm !important;
							z-index: 10 !important;
							color: #6E6E73 !important;
							font-family: Inter, sans-serif !important;
							font-size: 9px !important;
							font-weight: 700 !important;
							letter-spacing: .08em !important;
							text-transform: uppercase !important;
						}
						.unit-print-brand strong {
							color: #15803D !important;
							font-weight: 800 !important;
						}
						.unit-print-document {
							display: block !important;
							width: 100% !important;
							max-width: none !important;
							margin: 0 !important;
							box-shadow: none !important;
							background: #fff !important;
						}
						.unit-print-page {
							display: block !important;
							box-sizing: border-box !important;
							width: 100% !important;
							min-height: 0 !important;
							padding: 22mm 18mm 12mm !important;
							-webkit-box-decoration-break: clone;
							box-decoration-break: clone;
							break-after: page;
							page-break-after: always;
						}
						.unit-print-page:last-child {
							break-after: auto;
							page-break-after: auto;
						}
						.unit-print-cover {
							min-height: 0 !important;
						}
						.unit-print-module {
							break-before: auto !important;
							page-break-before: auto !important;
						}
						.unit-print-content h2,
						.unit-print-content h3 {
							padding-top: 7mm !important;
						}
						.unit-print-content h2:first-child,
						.unit-print-content h3:first-child,
						.unit-print-module-header + .unit-print-content h2:first-child,
						.unit-print-module-header + .unit-print-content h3:first-child {
							padding-top: 0 !important;
						}
					}
				`}
			</style>

			<div className="unit-print-toolbar">
				<div>
					<div className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#86868B]">
						Print preview
					</div>
					<div className="text-[14px] font-semibold text-[#1D1D1F]">
						{snapshot.unit.title}
					</div>
				</div>
				<div className="flex items-center gap-2">
					<button
						className="rounded-full border border-[#D4D7DD] bg-white px-4 py-2 text-[13px] font-semibold text-[#374151] hover:bg-[#F5F5F7]"
						onClick={onClose}
						type="button"
					>
						Close
					</button>
					<button
						className="rounded-full bg-[#1D1D1F] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#333333]"
						onClick={onPrint}
						type="button"
					>
						Print theory PDF
					</button>
				</div>
			</div>
			<div className="unit-print-brand">
				Created with <strong>Didactio</strong>
			</div>

			<article className="unit-print-document">
				<section className="unit-print-page unit-print-cover">
					<h1>{snapshot.unit.title}</h1>
					<p>{snapshot.unit.overview}</p>

					<h2 className="unit-print-toc-title">
						Table of contents
					</h2>
					<ol className="unit-print-toc">
						{snapshot.modules.map((module) => (
							<li key={module.chapterIndex}>
								<strong>
									{String(module.chapterIndex + 1).padStart(
										2,
										"0",
									)}
								</strong>
								<span>{module.title}</span>
							</li>
						))}
					</ol>
					{omittedCount > 0 && (
						<div className="unit-print-note mt-8">
							<strong>{omittedCount} modules were not included.</strong>
							<p className="m-0">
								Pending or failed modules are omitted until their content is
								generated.
							</p>
						</div>
					)}
				</section>

				{snapshot.modules.map((module) => (
					<section
						className="unit-print-page unit-print-module"
						key={module.chapterIndex}
					>
						<header className="unit-print-module-header">
							<div className="unit-print-kicker">
								Module {module.chapterIndex + 1}
							</div>
							<h2>{module.title}</h2>
							<p>{module.overview}</p>
						</header>
						<div
							className="unit-print-content unit-page-scope"
							dangerouslySetInnerHTML={{__html: module.html}}
						/>
					</section>
				))}
			</article>
		</div>
	);
}
