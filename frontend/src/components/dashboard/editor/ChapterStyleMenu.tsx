import {ChevronDown} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import type {EditorTextStyle} from "@/dashboard/types";
import {
	STYLE_PRESETS,
	type StylePresetId,
	type SizeProfile,
	type FontId,
} from "@/shared/presentation/typography";
import {loadFonts} from "@/shared/presentation/fontLoader";
import {cn} from "@/lib/utils";

type ChapterStyleMenuProps = {
	value: EditorTextStyle;
	onChange: (value: EditorTextStyle) => void;
	compact?: boolean;
	iconOnly?: boolean;
};

const SIZE_PROFILES: Array<{
	value: SizeProfile;
	label: string;
	sampleSize: number;
}> = [
	{value: "small", label: "Small", sampleSize: 12},
	{value: "regular", label: "Regular", sampleSize: 14},
	{value: "large", label: "Large", sampleSize: 17},
];

const PRESET_ROWS: Array<StylePresetId[]> = [
	["modern", "classic", "plain"],
];

function SectionLabel({children}: {children: string}) {
	return (
		<div className="px-1 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#86868B]">
			{children}
		</div>
	);
}

export function ChapterStyleMenu({
	value,
	onChange,
	compact = false,
	iconOnly = false,
}: ChapterStyleMenuProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (isOpen) {
			const fontIds = Object.values(STYLE_PRESETS).flatMap(
				(p) => [p.heading, p.body] as FontId[],
			);
			void loadFonts(fontIds);
		}
	}, [isOpen]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () =>
			document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const activePreset = value.stylePreset ?? "classic";

	return (
		<div ref={containerRef} className="group/style-menu relative shrink-0">
			<button
				type="button"
				aria-label={compact || iconOnly ? "Module style" : undefined}
				onClick={() => setIsOpen((current) => !current)}
				className={`app-editor-style-menu-button group flex items-center rounded-full border border-[#D4D7DD] bg-white py-1.5 text-[13px] font-medium text-[#1D1D1F] transition-all hover:border-[#34C759] hover:text-[#34C759] active:border-[#34C759] active:text-[#34C759] ${
					iconOnly ? "h-10 w-10 justify-center px-0"
					: compact ? "gap-1 px-2"
					: "gap-2 px-3"
				} ${
					isOpen ?
						"border-[#1D1D1F] bg-white text-[#1D1D1F]"
					:	"hover:bg-[#F5F5F7]"
				}`}
			>
				<span
					className={cn(
						"text-[14px] font-bold transition-colors group-hover:text-[#34C759] group-active:text-[#34C759]",
						"app-editor-style-menu-icon",
						isOpen ? "text-[#34C759]" : "text-[#1D1D1F]",
					)}
				>
					Aa
				</span>
				{!compact && !iconOnly ?
					<span>Style</span>
				:	null}
				{iconOnly ? null : (
					<ChevronDown
						size={14}
						className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
					/>
				)}
			</button>
			{iconOnly && !isOpen ? (
				<div className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-[80] -translate-x-1/2 whitespace-nowrap rounded-md border border-[#E5E5E7] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1D1D1F] opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-opacity group-hover/style-menu:opacity-100 group-focus-within/style-menu:opacity-100">
					Style
				</div>
			) : null}

			{isOpen ?
				<div className="absolute top-[calc(100%+10px)] right-0 z-30 w-[280px] rounded-md border border-[#D4D7DD] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
					<SectionLabel>Style</SectionLabel>
					<div className="grid grid-cols-3 gap-1.5">
						{PRESET_ROWS.flat().map((presetId) => {
							const preset = STYLE_PRESETS[presetId];
							const isActive = activePreset === presetId;
							return (
								<button
									key={presetId}
									type="button"
									onClick={() =>
										onChange({
											...value,
											stylePreset: presetId,
										})
									}
									className={`flex flex-col items-center gap-1 rounded-lg border py-2 transition-colors ${
										isActive ?
											"border-[#D4D7DD] bg-[#F5F5F7] text-[#1D1D1F]"
										:	"border-[#D4D7DD] text-[#1D1D1F] hover:bg-[#F5F5F7]"
									}`}
								>
									<span className="text-[12px] font-semibold">
										{preset.label}
									</span>
								</button>
							);
						})}
					</div>

					<div className="mt-3 border-t border-[#EEE8DC] pt-3">
						<SectionLabel>Text size</SectionLabel>
						<div className="grid grid-cols-3 gap-1.5">
							{SIZE_PROFILES.map((profile) => {
								const isActive =
									(value.sizeProfile ?? "regular") ===
									profile.value;
								return (
									<button
										key={profile.value}
										type="button"
										onClick={() =>
											onChange({
												...value,
												sizeProfile: profile.value,
											})
										}
										className={`flex flex-col items-center gap-1 rounded-lg border py-2 transition-colors ${
											isActive ?
												"border-[#D4D7DD] bg-[#F5F5F7] text-[#1D1D1F]"
											:	"border-[#D4D7DD] text-[#1D1D1F] hover:bg-[#F5F5F7]"
										}`}
									>
										<span
											style={{fontSize: profile.sampleSize}}
											className="font-medium leading-none text-[#1D1D1F]"
										>
											Aa
										</span>
									</button>
								);
							})}
						</div>
					</div>
				</div>
			:	null}
		</div>
	);
}
