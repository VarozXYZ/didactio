import React, {
	useState,
	type Dispatch,
	type SetStateAction,
	type FormEvent,
} from "react";
import {ChevronDown, Plus, FolderPlus, CircleHelp} from "lucide-react";
import {FolderFormModal} from "../../Dashboard/Sidebar/FolderFormModal";
import type {BackendFolder} from "../../../api/dashboardApi";
import {Progress} from "@/components/ui/progress";
import {getFolderEmoji} from "../../../utils/folderDisplay";

type TopicStepProps = {
	draftTopic: string;
	setDraftTopic: Dispatch<SetStateAction<string>>;
	draftAdditionalContext: string;
	setDraftAdditionalContext: Dispatch<SetStateAction<string>>;
	draftLearningProfile: "beginner" | "intermediate" | "advanced";
	setDraftLearningProfile: Dispatch<
		SetStateAction<"beginner" | "intermediate" | "advanced">
	>;
	draftLength: "intro" | "short" | "long" | "textbook";
	setDraftLength: Dispatch<
		SetStateAction<"intro" | "short" | "long" | "textbook">
	>;
	draftFolderId: string | null;
	setDraftFolderId: Dispatch<SetStateAction<string | null>>;
	availableFolders: BackendFolder[];
	onCreateFolder: (
		name: string,
		icon: string,
		color: string,
	) => Promise<BackendFolder>;
	isSubmitting: boolean;
	isResumed: boolean;
	onSubmit: () => Promise<void>;
	onCancel: () => void;
};

type SegmentedControlVariant = "default" | "cost";

const LEARNING_PROFILE_OPTIONS: Array<{
	value: "beginner" | "intermediate" | "advanced";
	label: string;
}> = [
	{value: "beginner", label: "Beginner"},
	{value: "intermediate", label: "Intermediate"},
	{value: "advanced", label: "Advanced"},
];

const LENGTH_OPTIONS: Array<{
	value: "intro" | "short" | "long" | "textbook";
	label: string;
	multiplier: number;
}> = [
	{value: "short", label: "Introduction", multiplier: 1},
	{value: "long", label: "Course", multiplier: 2},
	{value: "textbook", label: "Textbook", multiplier: 3},
];

const TOPIC_PLACEHOLDER_EXAMPLES = [
	"Building a personal budget that actually works",
	"Japanese for travel conversations",
	"The history of the Silk Road",
	"Writing better product descriptions",
	"Basic guitar chords and strumming patterns",
	"Understanding climate change and its impacts",
	"Introductory Python for data analysis",
	"Negotiation skills for freelancers",
	"Ancient Greek mythology and its legacy",
	"Public speaking without freezing up",
	"Nutrition basics for everyday life",
	"How jazz harmony works",
	"Graphic design principles for beginners",
	"Probability through real-world examples",
	"Starting a small online business",
	"World geography through migration and trade",
	"Critical reading of news and media",
	"Photography with manual camera settings",
	"Chemistry in cooking",
	"Emotional intelligence at work",
];

function pickRandomTopicPlaceholder(): string {
	return TOPIC_PLACEHOLDER_EXAMPLES[
		Math.floor(Math.random() * TOPIC_PLACEHOLDER_EXAMPLES.length)
	];
}

const SPRING = "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)";

const SEG = {
	teal: {
		from: "#26E8B0",
		to: "#0A9068",
		fg: "#FFFFFF",
		glow: "rgba(17,160,125,0.50)",
	},
	gold: {
		from: "#FFE44D",
		to: "#C99800",
		fg: "#1D1D1F",
		glow: "rgba(238,197,3,0.48)",
	},
	orange: {
		from: "#FFB85C",
		to: "#D96F10",
		fg: "#1D1D1F",
		glow: "rgba(239,160,71,0.48)",
	},
	red: {
		from: "#FF4F7A",
		to: "#BC0F3C",
		fg: "#FFFFFF",
		glow: "rgba(224,29,80,0.48)",
	},
} as const;

function segSelectedStyle(
	color: (typeof SEG)[keyof typeof SEG],
): React.CSSProperties {
	return {
		background: `linear-gradient(150deg, ${color.from} 0%, ${color.to} 100%)`,
		color: color.fg,
		transition: SPRING,
	};
}

function segIdleStyle(): React.CSSProperties {
	return {transition: SPRING};
}

function learningProfileSegmentColors(v: string): (typeof SEG)[keyof typeof SEG] {
	if (v === "beginner") return SEG.teal;
	if (v === "intermediate") return SEG.orange;
	return SEG.red;
}

function lengthSegmentColors(v: string): (typeof SEG)[keyof typeof SEG] {
	if (v === "short") return SEG.teal;
	if (v === "long") return SEG.orange;
	return SEG.red;
}

function segmentedGridColsClass(count: number): string {
	if (count === 4) return "grid-cols-4";
	if (count === 3) return "grid-cols-3";
	return "grid-cols-2";
}

function FieldTooltip({text}: {text: string}) {
	return (
		<span className="group relative inline-flex min-w-0">
			<button
				type="button"
				tabIndex={0}
				aria-label={text}
				className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[#AEAEB2] transition-colors hover:text-[#6E6E73] focus:outline-none focus:ring-2 focus:ring-[#11A07D]/30"
			>
				<CircleHelp size={14} />
			</button>
			<span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden w-64 -translate-y-1/2 rounded-[10px] bg-[#1D1D1F] px-3 py-2 text-left text-[12px] font-medium leading-5 text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 md:block">
				{text}
			</span>
		</span>
	);
}

function SegmentedControl<T extends string>({
	label,
	tooltip,
	value,
	onChange,
	options,
	colorsFor,
	variant = "default",
}: {
	label: string;
	tooltip?: string;
	value: T;
	onChange: (v: T) => void;
	options: Array<{
		value: T;
		label: string;
		multiplier?: number;
	}>;
	colorsFor: (v: T) => (typeof SEG)[keyof typeof SEG];
	variant?: SegmentedControlVariant;
}) {
	const cols = segmentedGridColsClass(options.length);
	const selectedOption = options.find((option) => option.value === value);
	return (
		<div className="w-full min-w-0">
			<div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-[#86868B]">
				<div className="flex min-w-0 items-center gap-1.5">
					<span>{label}</span>
					{tooltip ?
						<FieldTooltip text={tooltip} />
					:	null}
					{variant === "cost" && selectedOption?.multiplier ? (
						<span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#6E6E73] sm:hidden">
							<span
								className="length-coin-cycle"
								aria-hidden="true"
							/>
							x {selectedOption.multiplier}
						</span>
					) : null}
				</div>
			</div>
			<div
				className={`app-wizard-segmented-control grid w-full gap-0.5 rounded-[14px] p-0.5 ${cols}`}
				style={{
					background: "rgba(0,0,0,0.06)",
					border: "1px solid rgba(0,0,0,0.07)",
				}}
			>
				{options.map((opt) => {
					const selected = value === opt.value;
					const color = colorsFor(opt.value);
					return (
						<button
							key={opt.value}
							type="button"
							onClick={() => onChange(opt.value)}
							style={
								selected ?
									segSelectedStyle(color)
								:	segIdleStyle()
							}
							className={`min-w-0 rounded-[10px] px-2 py-2 text-center text-[13px] font-semibold ${
								selected ? "app-wizard-segmented-option-selected" : (
									"app-wizard-segmented-option " +
									"text-[#6E6E73] hover:text-[#1D1D1F]"
								)
							}`}
						>
							<span className="inline-flex min-w-0 items-center justify-center gap-2">
								<span className="truncate">{opt.label}</span>
								{opt.multiplier && variant !== "cost" ?
									<span
										className="hidden shrink-0 items-center gap-1 text-[11px] font-bold leading-none sm:inline-flex"
									>
										<span
											className="length-coin-cycle"
											aria-hidden="true"
										/>
										<span>x {opt.multiplier}</span>
									</span>
								:	null}
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}

export function TopicStep({
	draftTopic,
	setDraftTopic,
	draftAdditionalContext,
	setDraftAdditionalContext,
	draftLearningProfile,
	setDraftLearningProfile,
	draftLength,
	setDraftLength,
	draftFolderId,
	setDraftFolderId,
	availableFolders,
	onCreateFolder,
	isSubmitting,
	isResumed,
	onSubmit,
	onCancel,
}: TopicStepProps) {
	const [showContext, setShowContext] = useState(
		Boolean(draftAdditionalContext),
	);
	const [showFolderDropdown, setShowFolderDropdown] = useState(false);
	const [showFolderModal, setShowFolderModal] = useState(false);
	const [progressValue, setProgressValue] = useState(0);
	const [topicPlaceholder] = useState(() => pickRandomTopicPlaceholder());

	const selectedFolder = availableFolders.find((f) => f.id === draftFolderId);

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setProgressValue(15);
		const interval = setInterval(() => {
			setProgressValue((prev) => Math.min(prev + Math.random() * 12, 90));
		}, 600);
		try {
			await onSubmit();
		} finally {
			clearInterval(interval);
			setProgressValue(100);
		}
	};

	return (
		<form onSubmit={(e) => void handleSubmit(e)} className="w-full min-w-0 space-y-5 overflow-x-hidden">
			<div className="pb-1">
				<label className="mb-2.5 hidden text-[13px] font-semibold text-[#1D1D1F] md:block">
					What do you want to learn?
				</label>
				<input
					type="text"
					value={draftTopic}
					onChange={(e) => setDraftTopic(e.target.value)}
					placeholder={topicPlaceholder}
					disabled={isResumed}
					className="w-full rounded-[14px] px-4 py-2.5 text-[14px] text-[#1D1D1F] placeholder:text-[#AEAEB2]/60 placeholder:italic focus:outline-none disabled:opacity-60"
					style={{
						background: "rgba(255,255,255,0.65)",
						border: "1px solid rgba(0,0,0,0.10)",
						backdropFilter: "blur(8px)",
					}}
				/>
			</div>

			<div>
				<button
					type="button"
					onClick={() => setShowContext((prev) => !prev)}
					className="flex items-center gap-1.5 text-[13px] font-medium text-[#6E6E73] transition-colors hover:text-[#1D1D1F]"
				>
					<Plus
						size={14}
						className={`transition-transform ${showContext ? "rotate-45" : ""}`}
					/>
					Additional context
				</button>
				{showContext && (
					<textarea
						rows={3}
						value={draftAdditionalContext}
						onChange={(e) =>
							setDraftAdditionalContext(e.target.value)
						}
						placeholder="Learner goals, domain constraints, audience notes..."
						className="mt-2 w-full rounded-[14px] px-4 py-2.5 text-[14px] text-[#1D1D1F] placeholder:text-[#AEAEB2]/60 placeholder:italic focus:outline-none"
						style={{
							background: "rgba(255,255,255,0.65)",
							border: "1px solid rgba(0,0,0,0.10)",
							backdropFilter: "blur(8px)",
						}}
					/>
				)}
			</div>

			<div>
				<div className="mb-1.5 text-[12px] font-semibold text-[#86868B]">
					Folder
				</div>
				<div className="flex items-center gap-2">
					<div className="relative min-w-0 flex-1 md:w-[240px] md:flex-none md:shrink-0">
						<button
							type="button"
							onClick={() =>
								setShowFolderDropdown((prev) => !prev)
							}
							className="app-wizard-folder-trigger flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-[13px] transition-all hover:opacity-80"
							style={{
								background: "rgba(255,255,255,0.65)",
								border: "1px solid rgba(0,0,0,0.10)",
								backdropFilter: "blur(8px)",
							}}
						>
							<span className="flex items-center gap-2 truncate text-[#1D1D1F]">
								{selectedFolder ?
									<>
										<span className="shrink-0 text-[15px]">
											{getFolderEmoji(
												selectedFolder.icon,
											)}
										</span>
										<span className="truncate">
											{selectedFolder.name}
										</span>
									</>
								:	<>
										<span className="shrink-0 text-[15px]">
											✨
										</span>
										<span className="text-[#86868B]">
											Auto-classify
										</span>
									</>
								}
							</span>
							<ChevronDown
								size={14}
								className="ml-2 shrink-0 text-[#86868B]"
							/>
						</button>

						{showFolderDropdown && (
							<>
								<div
									className="fixed inset-0 z-10"
									onClick={() => setShowFolderDropdown(false)}
								/>
								<div
									className="app-wizard-folder-menu absolute left-0 top-full z-20 mt-1.5 max-h-[220px] w-full overflow-y-auto rounded-[10px] py-1"
									style={{
										background: "rgba(255,255,255,0.88)",
										backdropFilter: "blur(24px)",
										border: "1px solid rgba(255,255,255,0.6)",
										boxShadow:
											"0 8px 32px rgba(0,0,0,0.14)",
									}}
								>
									<button
										type="button"
										onClick={() => {
											setDraftFolderId(null);
											setShowFolderDropdown(false);
										}}
										className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-black/[0.04] ${
											draftFolderId === null ?
												"font-semibold text-[#1D1D1F]"
											:	"text-[#6E6E73]"
										}`}
									>
										<span className="text-[14px]">✨</span>
										Auto-classify
									</button>
									{availableFolders.map((folder) => (
										<button
											key={folder.id}
											type="button"
											onClick={() => {
												setDraftFolderId(folder.id);
												setShowFolderDropdown(false);
											}}
											className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-black/[0.04] ${
												draftFolderId === folder.id ?
													"font-semibold text-[#1D1D1F]"
												:	"text-[#6E6E73]"
											}`}
										>
											<span className="text-[14px]">
												{getFolderEmoji(folder.icon)}
											</span>
											{folder.name}
										</button>
									))}
								</div>
							</>
						)}
					</div>

					<button
						type="button"
						onClick={() => setShowFolderModal(true)}
						title="New folder"
						className="app-wizard-folder-create flex shrink-0 items-center justify-center rounded-[10px] p-2.5 text-[#6E6E73] transition-all hover:text-[#11A07D]"
						style={{
							background: "rgba(255,255,255,0.65)",
							border: "1px solid rgba(0,0,0,0.10)",
							backdropFilter: "blur(8px)",
						}}
					>
						<FolderPlus size={15} />
					</button>
				</div>
			</div>

			<FolderFormModal
				open={showFolderModal}
				mode="create"
				onClose={() => setShowFolderModal(false)}
				onSubmit={async (name, icon, color) => {
					const created = await onCreateFolder(name, icon, color);
					setDraftFolderId(created.id);
				}}
			/>

			<div className="flex flex-col gap-5">
				<SegmentedControl
					label="Level & depth"
					tooltip="Sets the learner experience and technical depth assumed by the unit."
					value={draftLearningProfile}
					onChange={(v) => setDraftLearningProfile(v)}
					options={LEARNING_PROFILE_OPTIONS}
					colorsFor={(v) => learningProfileSegmentColors(v)}
				/>
				<SegmentedControl
					label="Length"
					tooltip="Sets the overall scope and amount of content. Different lengths have different generation costs."
					value={draftLength}
					onChange={(v) => setDraftLength(v)}
					options={LENGTH_OPTIONS}
					colorsFor={(v) => lengthSegmentColors(v)}
					variant="cost"
				/>
			</div>

			{isSubmitting && (
				<div className="space-y-2">
					<Progress value={progressValue} className="h-1.5" />
					<p className="text-center text-[12px] text-[#86868B]">
						This may take a few seconds…
					</p>
				</div>
			)}

			<div className="flex justify-end gap-3 pt-3">
				<button
					type="button"
					onClick={onCancel}
					className="hidden rounded-[10px] px-4 py-2 text-[13px] font-medium text-[#1D1D1F] transition-all hover:opacity-70 md:inline-flex"
					style={{
						background: "rgba(0,0,0,0.06)",
						border: "1px solid rgba(0,0,0,0.07)",
					}}
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={!draftTopic.trim() || isSubmitting || isResumed}
					className="w-full rounded-[10px] bg-[#1D1D1F] px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-80 disabled:opacity-35 md:w-auto md:py-2"
				>
					{isSubmitting ? "Preparing..." : "Continue"}
				</button>
			</div>
		</form>
	);
}
