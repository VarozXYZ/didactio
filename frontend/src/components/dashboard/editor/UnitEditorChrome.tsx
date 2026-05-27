import {useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode} from "react";
import {CirclePlus, X} from "lucide-react";
import {cn} from "@/lib/utils";
import {CoinIcon} from "@/components/shared/Coin";

const VISIBLE_COIN_TYPES = ["bronze", "silver", "gold"] as const;

export function HeaderCoinBalance({
	credits,
	onOpenSubscription,
}: {
	credits: Record<(typeof VISIBLE_COIN_TYPES)[number], number>;
	onOpenSubscription: () => void;
}) {
	return (
		<div
			className="flex shrink-0 items-center gap-2 rounded-full border border-[#E5E5E7] bg-white px-3 py-1.5"
			aria-label="Available credits"
			title="Available credits"
		>
			{VISIBLE_COIN_TYPES.map((coinType) => (
				<span
					key={coinType}
					className="inline-flex items-center gap-1.5 text-[12px] font-semibold tabular-nums text-[#3A3A3C]"
				>
					<span>{credits[coinType]}</span>
					<CoinIcon type={coinType} size={18} />
				</span>
			))}
			<button
				aria-label="Open subscription and credits"
				className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#1D1D1F] transition-all hover:bg-[#F7FFF9] hover:text-[#34C759] active:text-[#34C759]"
				onClick={onOpenSubscription}
				title="Open subscription and credits"
				type="button"
			>
				<CirclePlus size={14} />
			</button>
		</div>
	);
}

export function HeaderControlTooltip({
	children,
	label,
}: {
	children: ReactNode;
	label: string;
}) {
	return (
		<div className="group/header-control relative shrink-0">
			{children}
			<div className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-[80] -translate-x-1/2 whitespace-nowrap rounded-md border border-[#E5E5E7] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1D1D1F] opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-opacity group-hover/header-control:opacity-100 group-focus-within/header-control:opacity-100">
				{label}
			</div>
		</div>
	);
}

export function EditorFirstRunGuide({
	open,
	onOpenChange,
	isMobile,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isMobile: boolean;
}) {
	const steps = useMemo(
		() =>
			isMobile ?
				[
					{
						selector: "[data-editor-tour='mobile-content']",
						title: "Read the module",
						description:
							"This is the current module content. Scroll naturally and use the tabs below when you need another tool.",
					},
					{
						selector: "[data-editor-tour='mobile-nav']",
						title: "Switch sections",
						description:
							"Use these tabs to move between modules, content, exercises, and settings.",
					},
					{
						selector: "[data-editor-tour='mobile-actions']",
						title: "Module actions",
						description:
							"Open notes, version history, regenerate the module, or change the reading style from here.",
					},
					{
						selector: "[data-editor-tour='mobile-exercises-tab']",
						title: "Practice",
						description:
							"Create exercises for the module and review your attempts from the Exercises tab.",
					},
				]
			:	[
					{
						selector: "[data-editor-tour='modules']",
						title: "Module outline",
						description:
							"Use the sidebar to jump between modules and sections. Progress is tracked as you read.",
					},
					{
						selector: "[data-editor-tour='content']",
						title: "Learning pages",
						description:
							"This sheet is the generated lesson. Select text to create notes or ask AI for help.",
					},
					{
						selector: "[data-editor-tour='page-controls']",
						title: "Page controls",
						description:
							"Move through pages here. The page picker also lets you jump directly to another page.",
					},
					{
						selector: "[data-editor-tour='header-actions']",
						title: "Tools",
						description:
							"Use these controls for notes, version history, regeneration, reading style, and editing.",
					},
					{
						selector: "[data-editor-tour='sidebar-actions']",
						title: "Unit actions",
						description:
							"Return to the dashboard, export the unit, reopen this tutorial, or go to settings.",
					},
				],
		[isMobile],
	);
	const [stepIndex, setStepIndex] = useState(0);
	const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
	const cardRef = useRef<HTMLDivElement | null>(null);
	const [cardSize, setCardSize] = useState({height: 196, width: 320});
	const activeStep = steps[Math.min(stepIndex, steps.length - 1)];

	useEffect(() => {
		if (!open) {
			return;
		}

		// Restart the first-run guide whenever it is opened.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setStepIndex(0);
	}, [open, isMobile]);

	useEffect(() => {
		if (!open) {
			return;
		}

		const updateTargetRect = () => {
			const element = document.querySelector(activeStep.selector);
			setTargetRect(element?.getBoundingClientRect() ?? null);
			const card = cardRef.current;
			if (card) {
				setCardSize({
					height: card.offsetHeight,
					width: card.offsetWidth,
				});
			}
		};

		updateTargetRect();
		window.addEventListener("resize", updateTargetRect);
		window.addEventListener("scroll", updateTargetRect, true);
		return () => {
			window.removeEventListener("resize", updateTargetRect);
			window.removeEventListener("scroll", updateTargetRect, true);
		};
	}, [activeStep.selector, open]);

	if (!open) {
		return null;
	}

	const fallbackRect = {
		bottom: window.innerHeight / 2 + 80,
		height: 160,
		left: 24,
		right: window.innerWidth - 24,
		top: window.innerHeight / 2 - 80,
		width: window.innerWidth - 48,
	} as DOMRect;
	const rect = targetRect ?? fallbackRect;
	const padding = 8;
	const spotlightStyle: CSSProperties = {
		height: rect.height + padding * 2,
		left: rect.left - padding,
		top: rect.top - padding,
		width: rect.width + padding * 2,
	};
	const viewportMargin = 16;
	const tooltipGap = 18;
	const target = {
		bottom: rect.bottom + padding,
		left: rect.left - padding,
		right: rect.right + padding,
		top: rect.top - padding,
	};
	const positions = [
		{
			fits: target.bottom + tooltipGap + cardSize.height <= window.innerHeight - viewportMargin,
			left: Math.min(
				Math.max(viewportMargin, target.left),
				window.innerWidth - cardSize.width - viewportMargin,
			),
			top: target.bottom + tooltipGap,
		},
		{
			fits: target.top - tooltipGap - cardSize.height >= viewportMargin,
			left: Math.min(
				Math.max(viewportMargin, target.left),
				window.innerWidth - cardSize.width - viewportMargin,
			),
			top: target.top - tooltipGap - cardSize.height,
		},
		{
			fits: target.right + tooltipGap + cardSize.width <= window.innerWidth - viewportMargin,
			left: target.right + tooltipGap,
			top: Math.min(
				Math.max(viewportMargin, target.top),
				window.innerHeight - cardSize.height - viewportMargin,
			),
		},
		{
			fits: target.left - tooltipGap - cardSize.width >= viewportMargin,
			left: target.left - tooltipGap - cardSize.width,
			top: Math.min(
				Math.max(viewportMargin, target.top),
				window.innerHeight - cardSize.height - viewportMargin,
			),
		},
	];
	const cardPosition =
		positions.find((position) => position.fits) ??
		{
			left: viewportMargin,
			top: Math.max(
				viewportMargin,
				Math.min(window.innerHeight - cardSize.height - viewportMargin, target.top),
			),
		};
	const isLastStep = stepIndex === steps.length - 1;
	const closeGuide = () => onOpenChange(false);
	const goToAvailableStep = (direction: -1 | 1) => {
		for (
			let nextIndex = stepIndex + direction;
			nextIndex >= 0 && nextIndex < steps.length;
			nextIndex += direction
		) {
			if (document.querySelector(steps[nextIndex].selector)) {
				setStepIndex(nextIndex);
				return;
			}
		}

		if (direction === 1) {
			closeGuide();
		}
	};
	const hasNextAvailableStep = steps
		.slice(stepIndex + 1)
		.some((step) => document.querySelector(step.selector));

	return (
		<div className="fixed inset-0 z-[90]">
			<div
				className="pointer-events-none absolute rounded-[22px] border-2 border-[#4ADE80] bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.55),0_18px_70px_rgba(0,0,0,0.35)] transition-all duration-200"
				style={spotlightStyle}
			/>
			<div
				ref={cardRef}
				className="app-editor-guide-dialog absolute w-[min(320px,calc(100vw-32px))] rounded-[18px] border border-[#E5E5E7] bg-white p-4 shadow-[0_24px_70px_rgba(0,0,0,0.26)]"
				style={{left: cardPosition.left, top: cardPosition.top}}
			>
				<button
					aria-label="Close tutorial"
					className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-[#86868B] transition hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
					onClick={closeGuide}
					type="button"
				>
					<X size={14} />
				</button>
				<div className="pr-8">
					<div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
						Editor guide
					</div>
					<h2 className="mt-2 text-[18px] font-bold tracking-tight text-[#0F0F12]">
						{activeStep.title}
					</h2>
					<p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">
						{activeStep.description}
					</p>
				</div>
				<div className="mt-4 flex items-center justify-between gap-3">
					<div className="flex items-center gap-1.5">
						{steps.map((step, index) => (
							<span
								key={step.title}
								className={cn(
									"h-1.5 rounded-full transition-all",
									index === stepIndex ?
										"w-5 bg-[#16A34A]"
									:	"w-1.5 bg-[#D1D5DB]",
								)}
							/>
						))}
					</div>
					<div className="flex items-center gap-2">
						<button
							className="rounded-full px-3 py-2 text-[12px] font-bold text-[#6B7280] transition hover:bg-[#F5F5F7] disabled:opacity-40"
							disabled={stepIndex === 0}
							onClick={() => goToAvailableStep(-1)}
							type="button"
						>
							Back
						</button>
						<button
							className="rounded-full bg-[#0F0F12] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#2A2A2D]"
							onClick={() => {
								if (isLastStep || !hasNextAvailableStep) {
									closeGuide();
									return;
								}
								goToAvailableStep(1);
							}}
							type="button"
						>
							{isLastStep || !hasNextAvailableStep ? "Done" : "Next"}
						</button>
					</div>
				</div>
				<button
					className="mt-3 text-[12px] font-bold text-[#86868B] transition hover:text-[#1D1D1F]"
					onClick={closeGuide}
					type="button"
				>
					Skip tutorial
				</button>
			</div>
		</div>
	);
}

export function ChapterStatusIcon({
	status,
	isCompleted,
	isGenerating,
	progress,
}: {
	status: "pending" | "ready" | "failed";
	isCompleted: boolean;
	isGenerating: boolean;
	progress: number;
}) {
	const S = 14;
	const SW = 1.5;
	const r = S / 2 - SW / 2;
	const circ = 2 * Math.PI * r;
	const cx = S / 2;
	const cy = S / 2;

	if (isGenerating) {
		return (
			<svg
				width={S}
				height={S}
				viewBox={`0 0 ${S} ${S}`}
				className="animate-spin"
				aria-hidden
			>
				<circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E5E7" strokeWidth={SW} />
				<circle
					cx={cx}
					cy={cy}
					r={r}
					fill="none"
					stroke="#4ADE80"
					strokeWidth={SW}
					strokeDasharray={`${circ * 0.28} ${circ * 0.72}`}
					strokeLinecap="round"
					transform={`rotate(-90 ${cx} ${cy})`}
				/>
			</svg>
		);
	}

	if (status === "failed") {
		return (
			<svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden>
				<circle cx={cx} cy={cy} r={r} fill="none" stroke="#F87171" strokeWidth={SW} />
				<line x1="4.8" y1="4.8" x2="9.2" y2="9.2" stroke="#F87171" strokeWidth={SW} strokeLinecap="round" />
				<line x1="9.2" y1="4.8" x2="4.8" y2="9.2" stroke="#F87171" strokeWidth={SW} strokeLinecap="round" />
			</svg>
		);
	}

	if (status === "pending") {
		return (
			<svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden>
				<circle cx={cx} cy={cy} r={r} fill="none" stroke="#C7C7CC" strokeWidth={SW} strokeDasharray="2.5 2.2" />
			</svg>
		);
	}

	if (isCompleted) {
		return (
			<svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden>
				<circle cx={cx} cy={cy} r={r} fill="none" stroke="#4ADE80" strokeWidth={SW} />
				<path
					d="M4 7.3L6.1 9.4L10 5.2"
					fill="none"
					stroke="#4ADE80"
					strokeWidth={SW}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		);
	}

	return (
		<svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden>
			<circle cx={cx} cy={cy} r={r} fill="none" stroke="#C7C7CC" strokeWidth={SW} />
			{progress > 0 && (
				<circle
					cx={cx}
					cy={cy}
					r={r}
					fill="none"
					stroke="#4ADE80"
					strokeWidth={SW}
					strokeDasharray={`${circ * Math.min(progress, 1)} ${circ}`}
					strokeLinecap="round"
					transform={`rotate(-90 ${cx} ${cy})`}
				/>
			)}
		</svg>
	);
}
