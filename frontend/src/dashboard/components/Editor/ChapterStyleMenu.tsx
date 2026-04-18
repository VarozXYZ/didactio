import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	AlignRight,
	ChevronDown,
	Settings2,
} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import type {ChapterPresentationSettings} from "../../types";
import {
	FONT_CATALOG,
	type FontId,
	type SizeProfile,
} from "../../utils/typography";
import {loadFonts} from "../../utils/fontLoader";

type ChapterStyleMenuProps = {
	value: ChapterPresentationSettings;
	onChange: (value: ChapterPresentationSettings) => void;
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

const ALIGN_OPTIONS: Array<{
	value: ChapterPresentationSettings["paragraphAlign"];
	label: string;
	icon: typeof AlignLeft;
}> = [
	{value: "left", label: "Left", icon: AlignLeft},
	{value: "center", label: "Center", icon: AlignCenter},
	{value: "right", label: "Right", icon: AlignRight},
	{value: "justify", label: "Justify", icon: AlignJustify},
];

const FONT_IDS = Object.keys(FONT_CATALOG) as FontId[];

function SectionLabel({children}: {children: string}) {
	return (
		<div className="px-1 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A8578]">
			{children}
		</div>
	);
}

function FontPicker({
	value,
	onChange,
}: {
	value: string;
	onChange: (fontId: FontId) => void;
}) {
	return (
		<div className="max-h-[148px] overflow-y-auto rounded-xl border border-[#EDE8DF] bg-[#FAFAF8]">
			{FONT_IDS.map((fontId) => {
				const entry = FONT_CATALOG[fontId];
				const isActive = value === fontId;
				return (
					<button
						key={fontId}
						type="button"
						onClick={() => onChange(fontId)}
						className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] transition-colors first:rounded-t-xl last:rounded-b-xl ${
							isActive ?
								"bg-[#F0ECE2] text-[#1D1D1F]"
							:	"text-[#4B4B52] hover:bg-[#F5F2EA]"
						}`}
					>
						<span style={{fontFamily: entry.family}}>
							{entry.label}
						</span>
						{isActive ?
							<span className="text-[10px] text-[#2E7D32]">
								✓
							</span>
						:	null}
					</button>
				);
			})}
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

	// Load all catalog fonts when the menu opens so previews render correctly.
	useEffect(() => {
		if (isOpen) {
			void loadFonts(FONT_IDS);
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

	return (
		<div ref={containerRef} className="relative shrink-0">
			<button
				type="button"
				aria-label={compact ? "Module style" : undefined}
				onClick={() => setIsOpen((current) => !current)}
				className={`flex h-9 items-center rounded-full border text-[12px] font-medium transition-all ${
					compact ? "gap-1 px-2" : "gap-2 px-3"
				} ${
					isOpen ?
						"border-[#D9D1C1] bg-[#F7F4EC] text-[#1D1D1F]"
					:	"border-transparent text-[#1D1D1F] hover:border-[#E3E1DA] hover:bg-[#F7F4EC]"
				}`}
			>
				<Settings2 size={15} />
				{!compact ?
					<span>Module Style</span>
				:	null}
				<ChevronDown
					size={14}
					className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>

			{isOpen ?
				<div className="absolute bottom-[calc(100%+10px)] left-0 z-30 w-[300px] rounded-3xl border border-[#E7E1D6] bg-white p-4 shadow-[0_18px_48px_rgba(28,24,18,0.12)]">
					{/* Size profile */}
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
									className={`flex flex-col items-center gap-1 rounded-xl border py-2 transition-colors ${
										isActive ?
											"border-[#D9D1C1] bg-[#F5F1E7] text-[#1D1D1F]"
										:	"border-[#ECE7DE] text-[#4B4B52] hover:bg-[#F8F6F1]"
									}`}
								>
									<span
										style={{fontSize: profile.sampleSize}}
										className="font-medium leading-none text-[#1D1D1F]"
									>
										Aa
									</span>
									<span className="text-[10px] font-medium">
										{profile.label}
									</span>
								</button>
							);
						})}
					</div>

					{/* Body font */}
					<div className="mt-3 border-t border-[#EEE8DC] pt-3">
						<SectionLabel>Body font</SectionLabel>
						<FontPicker
							value={value.bodyFontFamily ?? "inter"}
							onChange={(fontId) =>
								onChange({...value, bodyFontFamily: fontId})
							}
						/>
					</div>

					{/* Heading font */}
					<div className="mt-3 border-t border-[#EEE8DC] pt-3">
						<SectionLabel>Heading font</SectionLabel>
						<FontPicker
							value={value.headingFontFamily ?? "inter"}
							onChange={(fontId) =>
								onChange({...value, headingFontFamily: fontId})
							}
						/>
					</div>

					{/* Alignment */}
					<div className="mt-3 border-t border-[#EEE8DC] pt-3">
						<SectionLabel>Alignment</SectionLabel>
						<div className="grid grid-cols-4 gap-1.5">
							{ALIGN_OPTIONS.map((option) => {
								const Icon = option.icon;
								const isActive =
									value.paragraphAlign === option.value;
								return (
									<button
										key={option.value}
										type="button"
										title={option.label}
										onClick={() =>
											onChange({
												...value,
												paragraphAlign: option.value,
											})
										}
										className={`flex items-center justify-center rounded-xl border py-2 transition-colors ${
											isActive ?
												"border-[#D9D1C1] bg-[#F5F1E7] text-[#1D1D1F]"
											:	"border-[#ECE7DE] text-[#4B4B52] hover:bg-[#F8F6F1]"
										}`}
									>
										<Icon size={15} />
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
