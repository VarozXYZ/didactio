import {useEffect, useState} from "react";
import {Star, ChevronRight, ChevronLeft} from "lucide-react";
import {dashboardApi, type BackendModelEntry} from "../../dashboard/api/dashboardApi";
import {CoinIcon} from "../../components/Coin";

type Props = {
	silverModelId: string;
	goldModelId: string;
	onSilverChange: (id: string) => void;
	onGoldChange: (id: string) => void;
	onNext: () => void;
	onBack: () => void;
};

const PROVIDER_LOGOS: Record<string, string> = {
	deepseek: "/assets/brands/deepseek-reduced.svg",
	openai: "/assets/brands/chatgpt.png",
	google: "/assets/brands/gemini.png",
	anthropic: "/assets/brands/claude-reduced.svg",
};

function getProviderLogo(modelId: string): string | undefined {
	const provider = modelId.split("/")[0];
	return PROVIDER_LOGOS[provider];
}

function ModelCard({
	entry,
	selected,
	onSelect,
}: {
	entry: BackendModelEntry;
	selected: boolean;
	onSelect: () => void;
}) {
	const logo = getProviderLogo(entry.id);

	return (
		<button
			type="button"
			onClick={onSelect}
			className={`relative flex h-full w-full flex-col gap-2 rounded-[12px] border p-3.5 text-left transition-all ${
				selected ?
					"border-[#1D1D1F] bg-[#1D1D1F] text-white"
				:	"border-black/[0.1] bg-white hover:border-[#1D1D1F]/40 hover:bg-black/[0.02]"
			}`}
		>
			{entry.recommended && (
				<span
					className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-[#EFA047]/15 px-2 py-0.5 text-[9.5px] font-bold text-[#EFA047]"
				>
					<Star size={8} fill="currentColor" strokeWidth={0} />
					Best
				</span>
			)}

			<div className="flex items-center gap-2 pr-12">
				{logo ?
					<img
						src={logo}
						alt=""
						className={`h-5 w-5 shrink-0 object-contain ${selected ? "brightness-0 invert" : ""}`}
					/>
				:	null}
				<span className="text-[13px] font-semibold leading-tight">
					{entry.label}
				</span>
			</div>

			<p
				className={`flex-1 text-[11.5px] leading-relaxed ${
					selected ? "text-white/65" : "text-[#6E6E73]"
				}`}
			>
				{entry.description}
			</p>
		</button>
	);
}

export function ModelsStep({
	silverModelId,
	goldModelId,
	onSilverChange,
	onGoldChange,
	onNext,
	onBack,
}: Props) {
	const [silverModels, setSilverModels] = useState<BackendModelEntry[]>([]);
	const [goldModels, setGoldModels] = useState<BackendModelEntry[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		void dashboardApi.getAiConfigCatalog().then((catalog) => {
			setSilverModels(catalog.silver);
			setGoldModels(catalog.gold);
			if (!silverModelId && catalog.silver.length > 0) {
				const recommended = catalog.silver.find((m) => m.recommended) ?? catalog.silver[0];
				onSilverChange(recommended.id);
			}
			if (!goldModelId && catalog.gold.length > 0) {
				onGoldChange(catalog.gold[0].id);
			}
			setLoading(false);
		});
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	const maxCards = Math.max(silverModels.length, goldModels.length);

	return (
		<div className="flex flex-col gap-6 py-2">
			<div>
				<h2 className="font-sora text-[22px] font-bold text-[#1D1D1F] leading-tight">
					Choose your AI models
				</h2>
				<p className="mt-1.5 text-[14px] text-[#6E6E73] leading-relaxed">
					Silver models are used for fast, everyday tasks. Gold models are for
					in-depth, premium content generation.
				</p>
			</div>

			{loading ?
				<div className="flex items-center justify-center py-10 text-[13px] text-[#AEAEB2]">
					Loading models…
				</div>
			:	<div className="grid grid-cols-2 gap-x-4 gap-y-0">
					<div className="mb-2 flex items-center gap-1.5">
						<CoinIcon type="silver" size={15} />
						<span className="text-[12.5px] font-bold text-[#1D1D1F]">Silver model</span>
					</div>
					<div className="mb-2 flex items-center gap-1.5">
						<CoinIcon type="gold" size={15} />
						<span className="text-[12.5px] font-bold text-[#1D1D1F]">Gold model</span>
					</div>

					{Array.from({length: maxCards}).map((_, i) => (
						<>
							<div key={`silver-${i}`} className="pb-2">
								{silverModels[i] && (
									<ModelCard
										entry={silverModels[i]}
										selected={silverModelId === silverModels[i].id}
										onSelect={() => onSilverChange(silverModels[i].id)}
									/>
								)}
							</div>
							<div key={`gold-${i}`} className="pb-2">
								{goldModels[i] && (
									<ModelCard
										entry={goldModels[i]}
										selected={goldModelId === goldModels[i].id}
										onSelect={() => onGoldChange(goldModels[i].id)}
									/>
								)}
							</div>
						</>
					))}
				</div>
			}

			<div className="flex justify-between pt-1">
				<button
					type="button"
					onClick={onBack}
					className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[14px] font-medium text-[#6E6E73] transition hover:bg-black/[0.05]"
				>
					<ChevronLeft size={15} strokeWidth={2.5} />
					Back
				</button>
				<button
					type="button"
					onClick={onNext}
					disabled={loading || !silverModelId || !goldModelId}
					className="flex items-center gap-1.5 rounded-[10px] bg-[#1D1D1F] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#3A3A3C] disabled:cursor-not-allowed disabled:opacity-40"
				>
					Continue
					<ChevronRight size={15} strokeWidth={2.5} />
				</button>
			</div>
		</div>
	);
}
