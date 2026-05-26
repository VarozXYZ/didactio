import {useEffect, useState} from "react";
import {Star, ChevronRight, ChevronLeft} from "lucide-react";
import {dashboardApi, type BackendModelEntry} from "../../dashboard/api/dashboardApi";
import {getProviderLogo} from "../../dashboard/utils/modelOptions";
import {useAppearance} from "../../theme/AppearanceProvider";

type Props = {
	silverModelId: string;
	goldModelId: string;
	onSilverChange: (id: string) => void;
	onGoldChange: (id: string) => void;
	onNext: () => void;
	onBack: () => void;
};

function getModelLogo(modelId: string, darkMode: boolean): string | undefined {
	const provider = modelId.split("/")[0];
	return getProviderLogo(provider, darkMode ? "dark" : "light");
}

function ModelCard({
	entry,
	selected,
	onSelect,
	darkMode,
}: {
	entry: BackendModelEntry;
	selected: boolean;
	onSelect: () => void;
	darkMode: boolean;
}) {
	const logo = getModelLogo(entry.id, darkMode);

	return (
		<button
			type="button"
			onClick={onSelect}
			className={`app-onboarding-model-card relative flex min-h-[94px] w-full flex-col gap-2 rounded-[12px] border p-3.5 text-left transition-all md:min-h-[96px] ${
				selected ?
					"app-onboarding-model-card-selected border-[#1D1D1F] bg-[#1D1D1F] text-white"
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
						className={`h-5 w-5 shrink-0 object-contain ${
							selected && !darkMode && !entry.id.startsWith("google/") ?
								"brightness-0 invert"
							:	""
						}`}
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
	const {resolvedMode} = useAppearance();
	const darkMode = resolvedMode === "dark";
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

	return (
		<div className="flex flex-col gap-6 py-2">
			<div className="hidden md:block">
				<h2 className="font-sora text-[22px] font-bold text-[#1D1D1F] leading-tight">
					Choose your AI models
				</h2>
				<p className="mt-1.5 text-[14px] text-[#6E6E73] leading-relaxed">
					Standard models are used for fast, everyday tasks. Pro models are for
					in-depth premium generation.
				</p>
			</div>

			{loading ?
				<div className="flex items-center justify-center py-10 text-[13px] text-[#AEAEB2]">
					Loading models…
				</div>
			:	<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<div className="mb-2 flex items-center gap-1.5">
							<span className="text-[12.5px] font-bold text-[#1D1D1F]">Standard model</span>
						</div>
						<div className="space-y-2">
							{silverModels.map((model) => (
								<ModelCard
									key={model.id}
									entry={model}
									selected={silverModelId === model.id}
									onSelect={() => onSilverChange(model.id)}
									darkMode={darkMode}
								/>
							))}
						</div>
					</div>
					<div>
						<div className="mb-2 flex items-center gap-1.5">
							<span className="text-[12.5px] font-bold text-[#1D1D1F]">Pro model</span>
						</div>
						<div className="space-y-2">
							{goldModels.map((model) => (
								<ModelCard
									key={model.id}
									entry={model}
									selected={goldModelId === model.id}
									onSelect={() => onGoldChange(model.id)}
									darkMode={darkMode}
								/>
							))}
						</div>
					</div>
				</div>
			}

			<div className="flex justify-between gap-3 pt-1">
				<button
					type="button"
					onClick={onBack}
					className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[14px] font-medium text-[#6E6E73] transition hover:bg-black/[0.05] sm:flex-none"
				>
					<ChevronLeft size={15} strokeWidth={2.5} />
					Back
				</button>
				<button
					type="button"
					onClick={onNext}
					disabled={loading || !silverModelId || !goldModelId}
					className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#1D1D1F] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#3A3A3C] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
				>
					Continue
					<ChevronRight size={15} strokeWidth={2.5} />
				</button>
			</div>
		</div>
	);
}
