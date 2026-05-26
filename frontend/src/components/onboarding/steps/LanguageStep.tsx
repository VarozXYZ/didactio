const LANGUAGES = [
	"English",
	"Spanish",
	"French",
	"German",
	"Portuguese",
	"Italian",
	"Chinese",
	"Japanese",
	"Arabic",
	"Russian",
	"Korean",
	"Hindi",
	"Dutch",
	"Polish",
	"Turkish",
	"Vietnamese",
	"Thai",
	"Indonesian",
	"Swahili",
	"Catalan",
];

type Props = {
	language: string;
	onLanguageChange: (value: string) => void;
	onNext: () => void;
	onBack: () => void;
};

export function LanguageStep({language, onLanguageChange, onNext, onBack}: Props) {
	const isCustom = language.trim() && !LANGUAGES.includes(language.trim());
	const canProceed = language.trim().length > 0;

	return (
		<div className="flex flex-col gap-6 py-2">
			<div>
				<h2 className="font-sora text-[22px] font-bold text-[#1D1D1F] leading-tight">
					Content language
				</h2>
				<p className="mt-1.5 text-[14px] text-[#6E6E73] leading-relaxed">
					All your learning materials — summaries, lessons, quizzes — will be
					generated in this language.
				</p>
			</div>

			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
				{LANGUAGES.map((lang) => (
					<button
						key={lang}
						type="button"
						onClick={() => onLanguageChange(lang)}
						className={`rounded-[10px] border px-3.5 py-2.5 text-left text-[13.5px] font-medium transition-all ${
							language === lang ?
								"border-[#1D1D1F] bg-[#1D1D1F] text-white"
							:	"border-black/[0.1] bg-white text-[#1D1D1F] hover:border-[#1D1D1F]/40 hover:bg-black/[0.03]"
						}`}
					>
						{lang}
					</button>
				))}
			</div>

			<div className="flex flex-col gap-1.5">
				<label
					htmlFor="custom-language"
					className="text-[13px] font-semibold text-[#1D1D1F]"
				>
					Other language
				</label>
				<input
					id="custom-language"
					type="text"
					value={isCustom ? language : ""}
					onChange={(e) => onLanguageChange(e.target.value)}
					placeholder="Type any language…"
					className="w-full rounded-[10px] border border-black/[0.12] bg-white px-3.5 py-2.5 text-[14px] text-[#1D1D1F] outline-none transition placeholder:text-[#AEAEB2] focus:border-[#1D1D1F] focus:ring-2 focus:ring-[#1D1D1F]/10"
				/>
			</div>

			<div className="flex justify-between pt-2">
				<button
					type="button"
					onClick={onBack}
					className="rounded-[10px] px-4 py-2.5 text-[14px] font-medium text-[#6E6E73] transition hover:bg-black/[0.05]"
				>
					← Back
				</button>
				<button
					type="button"
					onClick={onNext}
					disabled={!canProceed}
					className="rounded-[10px] bg-[#1D1D1F] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#3A3A3C] disabled:cursor-not-allowed disabled:opacity-40"
				>
					Continue →
				</button>
			</div>
		</div>
	);
}
