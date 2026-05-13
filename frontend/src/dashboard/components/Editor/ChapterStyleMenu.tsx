import {ChevronDown} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import type {EditorTextStyle} from "../../types";
import {
	STYLE_PRESETS,
	type StylePresetId,
	type SizeProfile,
	type FontId,
} from "../../utils/typography";
import {loadFonts} from "../../utils/fontLoader";

type ChapterStyleMenuProps = {
	value: EditorTextStyle;
	onChange: (value: EditorTextStyle) => void;
	compact?: boolean;
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
		<div ref={containerRef} className="relative shrink-0">
			<button
				type="button"
				aria-label={compact ? "Module style" : undefined}
				onClick={() => setIsOpen((current) => !current)}
				className={`flex items-center rounded-full border border-[#D4D7DD] bg-white py-1.5 text-[13px] font-medium text-[#1D1D1F] transition-all ${
					compact ? "gap-1 px-2" : "gap-2 px-3"
				} ${
					isOpen ?
						"bg-[#F5F5F7]"
					:	"hover:bg-[#F5F5F7]"
				}`}
			>
				<span className="font-bold text-[14px]">Aa</span>
				{!compact ?
					<span>Style</span>
				:	null}
				<ChevronDown
					size={14}
					className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>

			{isOpen ?
				<div className="absolute top-[calc(100%+10px)] right-0 z-30 w-[280px] rounded-md border border-[#D4D7DD] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
					{/* Style presets */}
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

					{/* Text size */}
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
