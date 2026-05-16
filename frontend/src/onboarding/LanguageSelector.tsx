import {useRef, useState} from "react";
import {Check, ChevronDown, Languages} from "lucide-react";
import {Popover, PopoverContent, PopoverTrigger} from "../components/ui/popover";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "../components/ui/command";

export const LANGUAGES: {code: string; iso: string; label: string; native: string}[] = [
	{code: "English", iso: "EN", label: "English", native: "English"},
	{code: "Spanish", iso: "ES", label: "Spanish", native: "Español"},
	{code: "French", iso: "FR", label: "French", native: "Français"},
	{code: "German", iso: "DE", label: "German", native: "Deutsch"},
	{code: "Portuguese", iso: "PT", label: "Portuguese", native: "Português"},
	{code: "Italian", iso: "IT", label: "Italian", native: "Italiano"},
	{code: "Chinese", iso: "CN", label: "Chinese", native: "中文"},
	{code: "Japanese", iso: "JP", label: "Japanese", native: "日本語"},
	{code: "Arabic", iso: "AR", label: "Arabic", native: "العربية"},
	{code: "Russian", iso: "RU", label: "Russian", native: "Русский"},
	{code: "Korean", iso: "KO", label: "Korean", native: "한국어"},
	{code: "Hindi", iso: "HI", label: "Hindi", native: "हिन्दी"},
	{code: "Dutch", iso: "NL", label: "Dutch", native: "Nederlands"},
	{code: "Polish", iso: "PL", label: "Polish", native: "Polski"},
	{code: "Turkish", iso: "TR", label: "Turkish", native: "Türkçe"},
	{code: "Vietnamese", iso: "VI", label: "Vietnamese", native: "Tiếng Việt"},
	{code: "Thai", iso: "TH", label: "Thai", native: "ภาษาไทย"},
	{code: "Indonesian", iso: "ID", label: "Indonesian", native: "Bahasa Indonesia"},
	{code: "Swahili", iso: "SW", label: "Swahili", native: "Kiswahili"},
	{code: "Catalan", iso: "CA", label: "Catalan", native: "Català"},
];

const ISO_COLORS: Record<string, string> = {
	EN: "text-[#3B82F6]", ES: "text-[#EF4444]", FR: "text-[#6366F1]",
	DE: "text-[#F59E0B]", PT: "text-[#10B981]", IT: "text-[#EC4899]",
	CN: "text-[#EF4444]", JP: "text-[#EF4444]", AR: "text-[#10B981]",
	RU: "text-[#3B82F6]", KO: "text-[#6366F1]", HI: "text-[#F59E0B]",
	NL: "text-[#F97316]", PL: "text-[#EF4444]", TR: "text-[#EF4444]",
	VI: "text-[#10B981]", TH: "text-[#6366F1]", ID: "text-[#EF4444]",
	SW: "text-[#10B981]", CA: "text-[#F59E0B]",
};

type Props = {
	value: string;
	onChange: (value: string) => void;
};

export function LanguageSelector({value, onChange}: Props) {
	const [open, setOpen] = useState(false);
	const [showCustom, setShowCustom] = useState(false);
	const [customInput, setCustomInput] = useState("");
	const customRef = useRef<HTMLInputElement>(null);

	const selected = LANGUAGES.find((l) => l.code === value);
	const isCustom = Boolean(value && !selected);

	function handleClose(o: boolean) {
		setOpen(o);
		if (!o && !isCustom) setShowCustom(false);
	}

	function handlePickOther() {
		setOpen(false);
		setShowCustom(true);
		setCustomInput(isCustom ? value : "");
		setTimeout(() => customRef.current?.focus(), 50);
	}

	function commitCustom(raw: string) {
		const trimmed = raw.trim();
		if (trimmed) {
			onChange(trimmed);
		}
	}

	return (
		<div className="flex flex-col gap-2">
			<Popover open={open} onOpenChange={handleClose}>
				<PopoverTrigger asChild>
					<button
						type="button"
						role="combobox"
						aria-expanded={open}
						className="flex w-full items-center justify-between gap-2 rounded-[10px] border border-black/[0.12] bg-white px-3.5 py-2.5 text-[14px] text-[#1D1D1F] transition hover:border-black/25 focus:outline-none"
					>
						<span className="flex items-center gap-2.5">
							{selected ?
								<>
									<span className={`w-[22px] text-[11px] font-bold tabular-nums ${ISO_COLORS[selected.iso] ?? "text-[#6E6E73]"}`}>
										{selected.iso}
									</span>
									<span>{selected.native}</span>
								</>
							: isCustom ?
								<>
									<Languages size={14} className="text-[#6E6E73]" />
									<span>{value}</span>
								</>
							:	<>
									<Languages size={14} className="text-[#AEAEB2]" />
									<span className="text-[#AEAEB2]">Select a language</span>
								</>
							}
						</span>
						<ChevronDown
							size={14}
							className={`shrink-0 text-[#AEAEB2] transition-transform ${open ? "rotate-180" : ""}`}
						/>
					</button>
				</PopoverTrigger>

				<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
					<Command>
						<CommandInput placeholder="Search language…" />
						<CommandList>
							<CommandEmpty className="py-3 text-center text-[13px] text-[#AEAEB2]">
								No results found.
							</CommandEmpty>
							<CommandGroup heading="Language">
								{LANGUAGES.map((lang) => (
									<CommandItem
										key={lang.code}
										value={`${lang.label} ${lang.native}`}
										onSelect={() => {
											onChange(lang.code);
											setShowCustom(false);
											setOpen(false);
										}}
									>
										<span className={`w-[22px] shrink-0 text-[11px] font-bold tabular-nums ${ISO_COLORS[lang.iso] ?? "text-[#6E6E73]"}`}>
											{lang.iso}
										</span>
										<span className="flex-1">{lang.native}</span>
										{value === lang.code && (
											<Check size={13} className="ml-auto shrink-0 text-[#11A07D]" />
										)}
									</CommandItem>
								))}
							</CommandGroup>
							<CommandSeparator />
							<CommandGroup>
								<CommandItem
									value="other"
									onSelect={handlePickOther}
									className="text-[#6E6E73]"
								>
									<Languages size={13} className="shrink-0" />
									<span>Other…</span>
									{isCustom && <Check size={13} className="ml-auto shrink-0 text-[#11A07D]" />}
								</CommandItem>
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>

			{showCustom && (
				<div className="flex items-center gap-2">
					<input
						ref={customRef}
						type="text"
						value={customInput}
						onChange={(e) => setCustomInput(e.target.value)}
						onBlur={(e) => commitCustom(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								commitCustom(customInput);
								(e.target as HTMLInputElement).blur();
							}
						}}
						placeholder="Type your language…"
						className="flex-1 rounded-[10px] border border-black/[0.12] bg-white px-3.5 py-2 text-[13.5px] text-[#1D1D1F] outline-none transition placeholder:text-[#AEAEB2] focus:border-[#1D1D1F]/50"
					/>
				</div>
			)}
		</div>
	);
}
