import type {
	BackendAiConfig,
	BackendGenerationQuality,
	BackendModelCatalog,
} from "../api/dashboardApi";

export const PROVIDER_LOGOS: Record<string, string> = {
	anthropic: "/assets/brands/claude-reduced.svg",
	claude: "/assets/brands/claude-reduced.svg",
	deepseek: "/assets/brands/deepseek-reduced.svg",
	google: "/assets/brands/gemini-color.svg",
	openai: "/assets/brands/chatgpt.png",
};

const DARK_PROVIDER_LOGOS: Record<string, string> = {
	openai: "/assets/brands/chatgpt-white.svg",
};

type ProviderLogoMode = "light" | "dark";

export function getProviderLogo(
	provider: string | null | undefined,
	mode: ProviderLogoMode = "light",
) {
	if (!provider) return undefined;
	return (
		(mode === "dark" ? DARK_PROVIDER_LOGOS[provider] : undefined) ??
		PROVIDER_LOGOS[provider]
	);
}

export type GenerationModelOption = {
	quality: BackendGenerationQuality;
	tierLabel: string;
	label: string;
	provider: string;
	model: string;
	icon?: string;
};

function modelIdFromConfig(config: {provider: string; model: string}) {
	return `${config.provider}/${config.model}`;
}

function fallbackModelLabel(modelId: string) {
	const [, ...modelParts] = modelId.split("/");
	return modelParts.join("/") || modelId;
}

export function buildGenerationModelOptions(
	config: BackendAiConfig | null,
	catalog: BackendModelCatalog | null,
	mode: ProviderLogoMode = "light",
): GenerationModelOption[] {
	return (["silver", "gold"] as const).map((quality) => {
		const current = config?.[quality];
		const modelId = current ? modelIdFromConfig(current) : quality;
		const provider = current?.provider ?? quality;
		const entry = catalog?.[quality].find((item) => item.id === modelId);
		return {
			quality,
			tierLabel: quality === "silver" ? "Standard" : "Pro",
			label: entry?.label ?? fallbackModelLabel(modelId),
			provider,
			model: current?.model ?? quality,
			icon: getProviderLogo(provider, mode),
		};
	});
}
