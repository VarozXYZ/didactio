import {useEffect, useRef, useState} from "react";
import {BriefcaseBusiness, Check, Loader2, Scale, Smile, Star} from "lucide-react";
import type {LucideIcon} from "lucide-react";
import {toastError} from "@/hooks/use-toast";
import {LanguageSelector} from "../../../../onboarding/LanguageSelector";
import {CoinIcon} from "../../../../components/Coin";
import {
	type BackendAiConfig,
	type BackendAiModelConfig,
	type BackendAuthoringConfig,
	type BackendModelCatalog,
	type BackendModelEntry,
	dashboardApi,
} from "../../../api/dashboardApi";

type ModelTier = "silver" | "gold";

const PROVIDER_LOGOS: Record<string, string> = {
	anthropic: "/assets/brands/claude-reduced.svg",
	deepseek: "/assets/brands/deepseek-reduced.svg",
	google: "/assets/brands/gemini.png",
	openai: "/assets/brands/chatgpt.png",
};

const TONE_OPTIONS: Array<{
	value: BackendAuthoringConfig["tone"];
	label: string;
	description: string;
	Icon: LucideIcon;
}> = [
	{
		value: "friendly",
		label: "Friendly",
		description: "Warm, clear, and encouraging.",
		Icon: Smile,
	},
	{
		value: "neutral",
		label: "Neutral",
		description: "Balanced and direct.",
		Icon: Scale,
	},
	{
		value: "professional",
		label: "Professional",
		description: "Formal and polished.",
		Icon: BriefcaseBusiness,
	},
];

function modelIdFromConfig(config: BackendAiModelConfig) {
	return `${config.provider}/${config.model}`;
}

function modelConfigFromId(id: string): BackendAiModelConfig {
	const [provider, ...modelParts] = id.split("/");
	return {
		provider: provider || "",
		model: modelParts.join("/") || id,
	};
}

function getProviderLogo(modelId: string): string | undefined {
	return PROVIDER_LOGOS[modelId.split("/")[0]];
}

function normalizeAiConfig(config: BackendAiConfig): BackendAiConfig {
	const extraInstructions =
		typeof config.authoring.extraInstructions === "string" ?
			config.authoring.extraInstructions
		:	"";

	return {
		...config,
		authoring: {
			...config.authoring,
			...(extraInstructions.trim() ?
				{extraInstructions}
			:	{extraInstructions: undefined}),
		},
	};
}

function SettingSection({
	children,
	description,
	title,
}: {
	children: React.ReactNode;
	description: string;
	title: string;
}) {
	return (
		<section className="rounded-[16px] border border-black/[0.07] bg-white/70 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
			<div className="mb-4">
				<h2 className="text-[18px] font-bold tracking-tight text-[#1D1D1F]">
					{title}
				</h2>
				<p className="mt-1 text-[13px] leading-relaxed text-[#6E6E73]">
					{description}
				</p>
			</div>
			{children}
		</section>
	);
}

function ChoiceCard<TValue extends string>({
	description,
	Icon,
	label,
	selected,
	value,
	onSelect,
}: {
	description: string;
	Icon: LucideIcon;
	label: string;
	selected: boolean;
	value: TValue;
	onSelect: (value: TValue) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onSelect(value)}
			className={`flex min-h-[68px] items-center gap-3 rounded-[12px] border px-3.5 py-3 text-left transition-all ${
				selected ?
					"border-[#1D1D1F] bg-[#1D1D1F] text-white"
				:	"border-black/[0.1] bg-white hover:border-[#1D1D1F]/40 hover:bg-black/[0.02]"
			}`}
		>
			<span
				className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
					selected ? "bg-white/15 text-white" : "bg-black/[0.04] text-[#1D1D1F]"
				}`}
			>
				<Icon size={17} strokeWidth={2.2} />
			</span>
			<span className="min-w-0 flex-1">
				<span className="flex items-center justify-between gap-2">
					<span className="text-[13px] font-semibold">{label}</span>
					{selected ? <Check size={14} className="shrink-0" /> : null}
				</span>
				<span
					className={`mt-0.5 block text-[11.5px] leading-snug ${
						selected ? "text-white/65" : "text-[#6E6E73]"
					}`}
				>
					{description}
				</span>
			</span>
		</button>
	);
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
			className={`relative flex min-h-[92px] w-full items-start gap-3 rounded-[12px] border p-3.5 text-left transition-all ${
				selected ?
					"border-[#1D1D1F] bg-[#1D1D1F] text-white"
				:	"border-black/[0.1] bg-white hover:border-[#1D1D1F]/40 hover:bg-black/[0.02]"
			}`}
		>
			{entry.recommended ? (
				<span
					className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-[#EFA047]/15 px-2 py-0.5 text-[9.5px] font-bold text-[#EFA047]"
				>
					<Star size={8} fill="currentColor" strokeWidth={0} />
					Best
				</span>
			) : null}

			<span
				className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
					selected ? "bg-white/15" : "bg-black/[0.04]"
				}`}
			>
				{logo ? (
					<img
						src={logo}
						alt=""
						className={`h-5 w-5 object-contain ${
							selected ? "brightness-0 invert" : ""
						}`}
					/>
				) : null}
			</span>

			<span className="min-w-0 flex-1 pr-8">
				<span className="block text-[13px] font-semibold leading-tight">
					{entry.label}
				</span>
				<span
					className={`mt-1 block text-[11.5px] leading-relaxed ${
						selected ? "text-white/65" : "text-[#6E6E73]"
					}`}
				>
					{entry.description}
				</span>
			</span>
		</button>
	);
}

function ModelColumn({
	catalog,
	current,
	tier,
	onChange,
}: {
	catalog: BackendModelEntry[];
	current: BackendAiModelConfig;
	tier: ModelTier;
	onChange: (next: BackendAiModelConfig) => void;
}) {
	const selectedId = modelIdFromConfig(current);
	const hasSelectedModel = catalog.some((entry) => entry.id === selectedId);

	const options = hasSelectedModel ?
		catalog
	:	[
			{
				id: selectedId,
				label: current.model || "Current model",
				description:
					"This model is currently configured but is not in the onboarding catalog.",
			},
			...catalog,
		];

	return (
		<div className="min-w-0">
			<div className="mb-2 flex items-center gap-1.5">
				<CoinIcon type={tier} size={15} />
				<span className="text-[12.5px] font-bold text-[#1D1D1F]">
					{tier === "silver" ? "Silver model" : "Gold model"}
				</span>
			</div>
			<div className="grid gap-2 md:grid-cols-3">
				{options.map((entry) => (
					<ModelCard
						key={entry.id}
						entry={entry}
						selected={selectedId === entry.id}
						onSelect={() => onChange(modelConfigFromId(entry.id))}
					/>
				))}
			</div>
		</div>
	);
}

export function PreferencesView() {
	const [config, setConfig] = useState<BackendAiConfig | null>(null);
	const [catalog, setCatalog] = useState<BackendModelCatalog | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [saveStatus, setSaveStatus] = useState<
		"idle" | "saving" | "saved" | "error"
	>("idle");
	const lastSavedConfigRef = useRef("");
	const latestConfigRef = useRef("");

	useEffect(() => {
		const loadConfig = async () => {
			setIsLoading(true);

			try {
				const [nextConfig, nextCatalog] = await Promise.all([
					dashboardApi.getAiConfig(),
					dashboardApi.getAiConfigCatalog(),
				]);
				const normalizedConfig = normalizeAiConfig(nextConfig);
				setConfig(normalizedConfig);
				setCatalog(nextCatalog);
				const initialConfig = JSON.stringify(normalizedConfig);
				lastSavedConfigRef.current = initialConfig;
				latestConfigRef.current = initialConfig;
				setSaveStatus("saved");
			} catch (loadError) {
				toastError(
					loadError instanceof Error ?
						loadError.message
					:	"Failed to load preferences.",
				);
			} finally {
				setIsLoading(false);
			}
		};

		void loadConfig();
	}, []);

	useEffect(() => {
		if (!config || isLoading) {
			return;
		}

		const serializedConfig = JSON.stringify(config);
		latestConfigRef.current = serializedConfig;

		if (serializedConfig === lastSavedConfigRef.current) {
			return;
		}

		setSaveStatus("saving");

		const timeoutId = window.setTimeout(() => {
			const configToSave = normalizeAiConfig(config);
			const pendingSerializedConfig = serializedConfig;

			void dashboardApi
				.updateAiConfig(configToSave)
				.then(() => {
					lastSavedConfigRef.current = pendingSerializedConfig;
					if (latestConfigRef.current === pendingSerializedConfig) {
						setSaveStatus("saved");
					}
				})
				.catch((saveError) => {
					if (latestConfigRef.current === pendingSerializedConfig) {
						setSaveStatus("error");
					}
					toastError(
						saveError instanceof Error ?
							saveError.message
						:	"Failed to save preferences.",
					);
				});
		}, 650);

		return () => window.clearTimeout(timeoutId);
	}, [config, isLoading]);

	return (
		<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
			<header className="flex h-[80px] shrink-0 items-center justify-between gap-4 border-b border-[#E5E5E7] bg-white/80 px-8 backdrop-blur-md">
				<div>
					<h1 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
						Preferences
					</h1>
					<p className="mt-0.5 text-[13px] text-[#86868B]">
						Adjust your generation defaults.
					</p>
				</div>
				<div className="flex min-w-[104px] items-center justify-end gap-2 text-[13px] font-medium text-[#6E6E73]">
					{saveStatus === "saving" ? (
						<>
							<Loader2 size={14} className="animate-spin text-[#D97706]" />
							<span>Saving...</span>
						</>
					) : saveStatus === "error" ? (
						<span className="text-red-600">Save failed</span>
					) : saveStatus === "saved" ? (
						<>
							<Check size={14} className="text-[#2D8F4B]" />
							<span>Saved</span>
						</>
					) : null}
				</div>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto p-8">
				<div className="mx-auto max-w-[1040px] space-y-5">
					{isLoading ? (
						<div className="flex min-h-[320px] items-center justify-center rounded-[18px] border border-black/[0.07] bg-white text-[13px] text-[#86868B]">
							<Loader2
								size={18}
								className="mr-2 animate-spin text-[#4ADE80]"
							/>
							Loading preferences...
						</div>
					) : null}

					{config && catalog ? (
						<div className="grid gap-5">
							<SettingSection
								title="Content language"
								description="All generated lessons and learning materials will use this language by default."
							>
								<div className="max-w-[420px]">
									<LanguageSelector
										value={config.authoring.language}
										onChange={(language) =>
											setConfig((previous) =>
												previous ?
													{
														...previous,
														authoring: {
															...previous.authoring,
															language,
														},
													}
												:	previous,
											)
										}
									/>
								</div>
							</SettingSection>

							<SettingSection
								title="Teaching style"
								description="Choose the default voice Didactio uses when creating materials."
							>
								<div className="grid gap-2 md:grid-cols-3">
									{TONE_OPTIONS.map((option) => (
										<ChoiceCard
											key={option.value}
											value={option.value}
											Icon={option.Icon}
											label={option.label}
											description={option.description}
											selected={config.authoring.tone === option.value}
											onSelect={(tone) =>
												setConfig((previous) =>
													previous ?
														{
															...previous,
															authoring: {
																...previous.authoring,
																tone,
															},
														}
													:	previous,
												)
											}
										/>
									))}
								</div>
							</SettingSection>

							<SettingSection
								title="AI models"
								description="Silver is used for fast everyday generation. Gold is used for premium, higher-depth outputs."
							>
								<div className="grid gap-4">
									<ModelColumn
										tier="silver"
										catalog={catalog.silver}
										current={config.silver}
										onChange={(silver) =>
											setConfig((previous) =>
												previous ?
													{...previous, silver}
												:	previous,
											)
										}
									/>
									<ModelColumn
										tier="gold"
										catalog={catalog.gold}
										current={config.gold}
										onChange={(gold) =>
											setConfig((previous) =>
												previous ? {...previous, gold} : previous,
											)
										}
									/>
								</div>
							</SettingSection>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
