import {
	type Dispatch,
	type SetStateAction,
	useRef,
	useState,
	useEffect,
	useCallback,
} from "react";
import {ChevronRight, Loader2} from "lucide-react";

function SparkleFilledIcon({size = 16}: {size?: number}) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			fill="none"
			aria-hidden="true"
		>
			<path
				fill="currentColor"
				fillRule="evenodd"
				d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5m9-3a.75.75 0 0 1 .728.568l.258 1.036a2.63 2.63 0 0 0 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258a2.63 2.63 0 0 0-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.63 2.63 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.63 2.63 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5M16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395a1.5 1.5 0 0 0-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395a1.5 1.5 0 0 0 .948-.948l.395-1.183A.75.75 0 0 1 16.5 15"
				clipRule="evenodd"
			/>
		</svg>
	);
}

function StartGenerationButton({
	onClick,
	disabled,
	label,
}: {
	onClick: () => void;
	disabled: boolean;
	label: string;
}) {
	const [hovered, setHovered] = useState(false);
	const [pressed, setPressed] = useState(false);
	const [spinKey, setSpinKey] = useState(0);

	return (
		<>
			<style>{`
                @property --arc-end-sg {
                    syntax: '<angle>';
                    inherits: false;
                    initial-value: 0deg;
                }
                @keyframes arcExpandSg {
                    from { --arc-end-sg: 0deg; }
                    to   { --arc-end-sg: 360deg; }
                }
                .border-spinner-sg {
                    animation: arcExpandSg 1.1s cubic-bezier(0.2, 0.8, 0.4, 1) forwards;
                }
            `}</style>
			<button
				type="button"
				onClick={onClick}
				disabled={disabled}
				onMouseEnter={() => {
					if (!disabled) {
						setHovered(true);
						setSpinKey((k) => k + 1);
					}
				}}
				onMouseLeave={() => {
					setHovered(false);
					setPressed(false);
				}}
				onMouseDown={() => {
					if (!disabled) setPressed(true);
				}}
				onMouseUp={() => setPressed(false)}
				style={{
					position: "relative",
					overflow: "hidden",
					padding: "2px",
					border: "none",
					borderRadius: "14px",
					background: "#0f0f12",
					cursor: disabled ? "not-allowed" : "pointer",
					opacity: disabled ? 0.4 : 1,
					transform: pressed ? "scale(0.988)" : "none",
					transition: "transform 0.12s ease, box-shadow 0.22s ease",
					boxShadow:
						"inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -2px 8px rgba(0,0,0,0.30)",
				}}
			>
				<div
					aria-hidden="true"
					style={{
						position: "absolute",
						inset: 0,
						borderRadius: "14px",
						pointerEvents: "none",
						zIndex: 0,
						transform:
							hovered ? "translateY(-1px)" : "translateY(0px)",
						opacity: hovered ? 1 : 0,
						transition:
							"opacity 220ms cubic-bezier(0.16,1,0.3,1), transform 220ms cubic-bezier(0.16,1,0.3,1)",
						boxShadow:
							"0 20px 52px -22px rgba(0,0,0,0.78), 0 12px 26px -18px rgba(0,0,0,0.58)",
					}}
				/>
				{hovered && (
					<div
						key={spinKey}
						className="border-spinner-sg"
						style={{
							position: "absolute",
							width: "300%",
							height: "500%",
							top: "50%",
							left: "50%",
							transform: "translate(-50%, -50%)",
							background:
								"conic-gradient(from 0deg, #3434c3 0deg, #337ECF 45deg, #8DD598 90deg, #11A07D 135deg, #FADF52 180deg, #EFA047 225deg, #E01D50 270deg, #BB2081 315deg, #3434c3 360deg)",
							WebkitMaskImage:
								"conic-gradient(from 0deg, black 0deg, black var(--arc-end-sg), transparent calc(var(--arc-end-sg) + 12deg), transparent 360deg)",
							maskImage:
								"conic-gradient(from 0deg, black 0deg, black var(--arc-end-sg), transparent calc(var(--arc-end-sg) + 12deg), transparent 360deg)",
							zIndex: 1,
						}}
					/>
				)}
				<div
					style={{
						position: "relative",
						zIndex: 2,
						background: "#0f0f12",
						borderRadius: "12px",
					}}
					className="flex select-none items-center gap-2.5 px-5 py-[11px] text-[14px] font-semibold text-white"
				>
					<SparkleFilledIcon size={16} />
					{label}
				</div>
			</button>
		</>
	);
}
import type {BackendAiModelTier} from "../../../api/dashboardApi";
import type {PlanningDetailViewModel, PlanningSyllabus} from "../../../types";
import {Progress} from "@/components/ui/progress";

type PartialPlanningSyllabus = {
	title?: string;
	overview?: string;
	learningGoals?: string[];
	keywords?: string[];
	chapters?: Array<{
		title?: string;
		overview?: string;
		keyPoints?: string[];
		lessons?: Array<{
			title?: string;
			contentOutline?: string[];
		}>;
	}>;
};

type SyllabusStepProps = {
	planning: PlanningDetailViewModel | null;
	syllabusToRender: PlanningSyllabus | PartialPlanningSyllabus | null;
	hasSyllabus: boolean;
	isStreamingSyllabus: boolean;
	activeGenerationTier: BackendAiModelTier | null;
	isSubmitting: boolean;
	reviewDecision: "accept" | "reject";
	setReviewDecision: Dispatch<SetStateAction<"accept" | "reject">>;
	regenerationContext: string;
	setRegenerationContext: Dispatch<SetStateAction<string>>;
	selectedGenerationTier: BackendAiModelTier;
	setSelectedGenerationTier: Dispatch<SetStateAction<BackendAiModelTier>>;
	onGenerateSyllabus: (tier: BackendAiModelTier) => Promise<void>;
	onStartGeneration: (tier: BackendAiModelTier) => Promise<void>;
};

function ChapterAccordion({
	chapter,
	index,
	isOpen,
	onHover,
	onLeave,
}: {
	chapter: NonNullable<PartialPlanningSyllabus["chapters"]>[number];
	index: number;
	isOpen: boolean;
	onHover: () => void;
	onLeave: () => void;
}) {
	const contentRef = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState(0);

	useEffect(() => {
		if (!contentRef.current) return;
		setHeight(isOpen ? contentRef.current.scrollHeight : 0);
	}, [isOpen, chapter.lessons]);

	const lessons = chapter.lessons ?? [];

	return (
		<div
			className="group/chapter overflow-hidden rounded-[16px] transition-shadow duration-300"
			style={{
				background: "rgba(255,255,255,0.55)",
				border: "1px solid rgba(0,0,0,0.06)",
				backdropFilter: "blur(12px)",
			}}
			onMouseEnter={onHover}
			onMouseLeave={onLeave}
		>
			<div className="flex items-center gap-3 px-4 py-3.5">
				<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-gradient-to-br from-[#34C759] to-[#11A07D] text-[11px] font-bold text-white shadow-[0_2px_8px_rgba(52,199,89,0.35)]">
					{index + 1}
				</span>
				<div className="min-w-0 flex-1">
					<h4 className="text-[14px] font-semibold text-[#1D1D1F]">
						{chapter.title || `Module ${index + 1}`}
					</h4>
				</div>
				<div className="flex items-center gap-2">
					<ChevronRight
						size={14}
						className={`shrink-0 text-[#AEAEB2] transition-transform duration-500 ${isOpen ? "rotate-90" : ""}`}
						style={{
							transitionTimingFunction:
								"cubic-bezier(0.4, 0, 0.2, 1)",
						}}
					/>
				</div>
			</div>

			<div
				className="overflow-hidden transition-[height] duration-500"
				style={{
					height,
					transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
				}}
			>
				<div ref={contentRef} className="px-4 pb-4">
					{chapter.overview && (
						<p className="mb-3 pl-9 text-[12.5px] leading-[1.7] text-[#6E6E73]">
							{chapter.overview}
						</p>
					)}

					{lessons.length > 0 && (
						<div className="space-y-3 pl-9">
							{lessons.map((lesson, li) => (
								<div
									key={`${lesson.title}-${li}`}
									className="flex items-start gap-2.5"
								>
									<span className="mt-[2px] shrink-0 text-[11px] font-semibold tabular-nums text-[#C7C7CC]">
										{index + 1}.{li + 1}
									</span>
									<div className="min-w-0 flex-1">
										<div className="text-[12.5px] font-semibold text-[#1D1D1F]">
											{lesson.title || `Lesson ${li + 1}`}
										</div>
										{(lesson.contentOutline?.length ?? 0) >
											0 && (
											<ul className="mt-0.5 space-y-0.5">
												{lesson.contentOutline?.map(
													(o) => (
														<li
															key={o}
															className="flex gap-1.5 text-[11px] leading-[1.55] text-[#86868B]"
														>
															<span className="mt-[1px] shrink-0 text-[#D1D1D6]">
																–
															</span>
															{o}
														</li>
													),
												)}
											</ul>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function SyllabusCard({
	syllabus,
	isStreaming,
}: {
	syllabus: PlanningSyllabus | PartialPlanningSyllabus;
	isStreaming: boolean;
	activeTier: BackendAiModelTier | null;
}) {
	const chapters = syllabus.chapters ?? [];
	const [openIndex, setOpenIndex] = useState<number | null>(null);
	const leaveTimer = useRef<ReturnType<typeof setTimeout>>(null);

	const handleHover = useCallback((idx: number) => {
		if (leaveTimer.current) clearTimeout(leaveTimer.current);
		setOpenIndex(idx);
	}, []);

	const handleLeave = useCallback(() => {
		leaveTimer.current = setTimeout(() => setOpenIndex(null), 200);
	}, []);

	useEffect(
		() => () => {
			if (leaveTimer.current) clearTimeout(leaveTimer.current);
		},
		[],
	);

	return (
		<div className="space-y-5">
			{/* Title */}
			<div>
				<div className="flex items-center gap-2">
					<h3 className="text-[22px] font-bold tracking-tight text-[#1D1D1F]">
						{syllabus.title || "Building syllabus…"}
					</h3>
					{isStreaming && (
						<span className="flex items-center gap-1.5 rounded-full bg-[#EAF9EF] px-2.5 py-0.5 text-[10px] font-semibold text-[#2D8F4B]">
							<span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#34C759]" />
							Streaming
						</span>
					)}
				</div>
			</div>

			{/* Overview + Keywords — two columns, ~70/30 */}
			{(syllabus.overview || (syllabus.keywords?.length ?? 0) > 0) && (
				<div
					className="grid gap-x-5 gap-y-3"
					style={{
						gridTemplateColumns: "1fr auto",
						alignItems: "start",
					}}
				>
					{syllabus.overview && (
						<div>
							<div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#AEAEB2]">
								Overview
							</div>
							<p className="text-[13px] leading-[1.75] text-[#6E6E73]">
								{syllabus.overview}
							</p>
						</div>
					)}

					{(syllabus.keywords?.length ?? 0) > 0 && (
						<div className="w-[200px] shrink-0">
							<div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#AEAEB2]">
								Keywords
							</div>
							<div className="flex flex-wrap gap-1.5">
								{syllabus.keywords
									?.flatMap((kw) =>
										kw.includes(",") || kw.includes(";") ?
											kw
												.split(/[,;]/)
												.map((k) => k.trim())
												.filter(Boolean)
										: kw.includes(" ") ?
											kw.split(/\s+/).filter(Boolean)
										:	[kw],
									)
									.map((kw) => (
										<span
											key={kw}
											className="rounded-full bg-[#EAF9EF] px-2.5 py-[3px] text-[11px] font-medium text-[#2D8F4B]"
										>
											{kw}
										</span>
									))}
							</div>
						</div>
					)}
				</div>
			)}

			{/* Modules */}
			{chapters.length > 0 && (
				<div>
					<div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#AEAEB2]">
						Modules · {chapters.length}
					</div>
					<div className="space-y-2">
						{chapters.map((chapter, idx) => (
							<ChapterAccordion
								key={`${chapter.title}-${idx}`}
								chapter={chapter}
								index={idx}
								isOpen={openIndex === idx}
								onHover={() => handleHover(idx)}
								onLeave={handleLeave}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

export function SyllabusStep({
	planning,
	syllabusToRender,
	hasSyllabus,
	isStreamingSyllabus,
	activeGenerationTier,
	isSubmitting,
	reviewDecision,
	setReviewDecision,
	regenerationContext,
	setRegenerationContext,
	selectedGenerationTier,
	setSelectedGenerationTier,
	onGenerateSyllabus,
	onStartGeneration,
}: SyllabusStepProps) {
	void planning;
	const isWaiting = !hasSyllabus && !syllabusToRender;
	const [hasChosen, setHasChosen] = useState(false);

	const choose = (decision: "accept" | "reject") => {
		setReviewDecision(decision);
		setHasChosen(true);
	};

	const undoChoice = () => setHasChosen(false);

	return (
		<div className="space-y-4">
			{/* Waiting state */}
			{isWaiting && (
				<div className="flex flex-col items-center justify-center py-12">
					<Loader2 size={28} className="mb-4 animate-spin text-[#4ADE80]" />
					<p className="mb-4 text-[14px] font-medium text-[#1D1D1F]">
						Generating syllabus…
					</p>
					<div className="w-48">
						<Progress
							value={undefined}
							className="h-1.5 animate-pulse"
						/>
					</div>
					<p className="mt-3 text-[12px] text-[#86868B]">
						{isStreamingSyllabus ?
							"Streaming syllabus draft…"
						:	"Preparing syllabus generation…"}
					</p>
				</div>
			)}

			{/* Syllabus display */}
			{syllabusToRender && (
				<SyllabusCard
					syllabus={syllabusToRender}
					isStreaming={isStreamingSyllabus}
					activeTier={activeGenerationTier}
				/>
			)}

			{/* Review controls — progressive centered flow */}
			{hasSyllabus && (
				<div
					className="flex flex-col items-center gap-5 border-t pt-6"
					style={{borderColor: "rgba(0,0,0,0.06)"}}
				>
					{/* Question label */}
					<div
						className="flex items-center gap-2 rounded-full px-4 py-1.5"
						style={{
							background: "rgba(52,199,89,0.08)",
							border: "1px solid rgba(52,199,89,0.2)",
						}}
					>
						<span className="text-[13px]">🎉</span>
						<p className="text-[13px] font-semibold text-[#1D1D1F]">
							Happy with this syllabus?
						</p>
					</div>

					{/* Q1 — two separate answer buttons, or committed choice + undo */}
					{!hasChosen ?
						<div className="flex animate-in fade-in items-center gap-3 duration-200">
							<button
								type="button"
								onClick={() => choose("accept")}
								className="rounded-[12px] px-5 py-2 text-[13px] font-semibold text-[#1D1D1F] transition-all hover:bg-black/[0.04]"
								style={{border: "1px solid rgba(0,0,0,0.08)"}}
							>
								😊 Yes, looks great
							</button>
							<span className="text-[#D1D1D6]">·</span>
							<button
								type="button"
								onClick={() => choose("reject")}
								className="rounded-[12px] px-5 py-2 text-[13px] font-semibold text-[#1D1D1F] transition-all hover:bg-black/[0.04]"
								style={{border: "1px solid rgba(0,0,0,0.08)"}}
							>
								😕 No, tweak it
							</button>
						</div>
					:	<div className="flex animate-in fade-in items-center gap-2.5 duration-200">
							<span
								className="rounded-[10px] px-4 py-1.5 text-[12.5px] font-semibold"
								style={
									reviewDecision === "accept" ?
										{
											background: "rgba(52,199,89,0.10)",
											border: "1px solid rgba(52,199,89,0.22)",
											color: "#2D8F4B",
										}
									:	{
											background: "rgba(0,0,0,0.04)",
											border: "1px solid rgba(0,0,0,0.08)",
											color: "#1D1D1F",
										}
								}
							>
								{reviewDecision === "accept" ?
									"😊 Yes, looks great"
								:	"😕 No, tweak it"}
							</span>
							<button
								type="button"
								onClick={undoChoice}
								className="flex h-6 w-6 items-center justify-center rounded-full text-[#AEAEB2] transition-colors hover:bg-black/[0.05] hover:text-[#6E6E73]"
								title="Change answer"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 64 640 512"
									width="13"
									height="13"
									fill="currentColor"
								>
									<path d="M320 128c-56.8 0-107.9 24.7-143.1 64H224c17.7 0 32 14.3 32 32s-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V96c0-17.7 14.3-32 32-32s32 14.3 32 32v54.7C174.9 97.6 243.5 64 320 64c141.4 0 256 114.6 256 256S461.4 576 320 576c-87 0-163.9-43.4-210.1-109.7c-10.1-14.5-6.6-34.4 7.9-44.6s34.4-6.6 44.6 7.9c34.8 49.8 92.4 82.3 157.6 82.3c106 0 192-86 192-192S426 128 320 128" />
								</svg>
							</button>
						</div>
					}

					{/* Q2 — Yes path: tier picker + action */}
					{hasChosen && reviewDecision === "accept" && (
						<div className="flex animate-in fade-in slide-in-from-bottom-2 flex-col items-center gap-3 duration-200">
							<div
								className="inline-flex rounded-[10px] bg-[#F5F5F7] p-0.5"
								style={{border: "1px solid rgba(0,0,0,0.06)"}}
							>
								<button
									type="button"
									onClick={() =>
										setSelectedGenerationTier("cheap")
									}
									className={`rounded-[8px] px-4 py-1.5 text-[12px] font-medium transition-all ${
										selectedGenerationTier === "cheap" ?
											"bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
										:	"text-[#6E6E73] hover:text-[#1D1D1F]"
									}`}
								>
									Standard
								</button>
								<button
									type="button"
									onClick={() =>
										setSelectedGenerationTier("premium")
									}
									className={`rounded-[8px] px-4 py-1.5 text-[12px] font-medium transition-all ${
										selectedGenerationTier === "premium" ?
											"bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
										:	"text-[#6E6E73] hover:text-[#1D1D1F]"
									}`}
								>
									Premium
								</button>
							</div>
							<StartGenerationButton
								onClick={() =>
									void onStartGeneration(
										selectedGenerationTier,
									)
								}
								disabled={isSubmitting}
								label={
									isSubmitting ? "Starting…" : (
										"Start learning"
									)
								}
							/>
						</div>
					)}

					{/* Q2 — No path: context + regenerate */}
					{hasChosen && reviewDecision === "reject" && (
						<div className="animate-in fade-in slide-in-from-bottom-2 w-full max-w-lg duration-200">
							<div className="flex items-stretch gap-3">
								{/* Auto-growing input */}
								<div className="relative min-h-[76px] flex-1">
									{!regenerationContext && (
										<div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-[13px] italic leading-relaxed text-[#AEAEB2]/50">
											What would you like changed?
										</div>
									)}
									<textarea
										rows={1}
										value={regenerationContext}
										onChange={(e) => {
											setRegenerationContext(
												e.target.value,
											);
											e.target.style.height = "auto";
											e.target.style.height = `${e.target.scrollHeight}px`;
										}}
										placeholder=""
										className="min-h-[76px] w-full resize-none overflow-hidden rounded-[14px] px-4 py-2.5 text-[13px] leading-relaxed text-[#1D1D1F] focus:outline-none"
										style={{
											background: "rgba(255,255,255,0.7)",
											border: "1px solid rgba(0,0,0,0.07)",
											backdropFilter: "blur(12px)",
											boxShadow:
												"inset 0 1px 3px rgba(0,0,0,0.04)",
										}}
									/>
								</div>
								{/* Right column: tier + button */}
								<div className="flex shrink-0 flex-col items-stretch gap-2">
									<div
										className="inline-flex self-center rounded-[10px] bg-[#F5F5F7] p-0.5"
										style={{
											border: "1px solid rgba(0,0,0,0.06)",
										}}
									>
										<button
											type="button"
											onClick={() =>
												setSelectedGenerationTier(
													"cheap",
												)
											}
											className={`rounded-[8px] px-3 py-1 text-[12px] font-medium transition-all ${
												(
													selectedGenerationTier ===
													"cheap"
												) ?
													"bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
												:	"text-[#6E6E73] hover:text-[#1D1D1F]"
											}`}
										>
											Standard
										</button>
										<button
											type="button"
											onClick={() =>
												setSelectedGenerationTier(
													"premium",
												)
											}
											className={`rounded-[8px] px-3 py-1 text-[12px] font-medium transition-all ${
												(
													selectedGenerationTier ===
													"premium"
												) ?
													"bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
												:	"text-[#6E6E73] hover:text-[#1D1D1F]"
											}`}
										>
											Premium
										</button>
									</div>
									<button
										type="button"
										disabled={
											isSubmitting ||
											!regenerationContext.trim()
										}
										onClick={() =>
											void onGenerateSyllabus(
												selectedGenerationTier,
											)
										}
										className="rounded-[12px] bg-[#1D1D1F] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#2C2C2E] disabled:opacity-40"
									>
										{isStreamingSyllabus ?
											"Regenerating…"
										:	"Regenerate"}
									</button>
								</div>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
