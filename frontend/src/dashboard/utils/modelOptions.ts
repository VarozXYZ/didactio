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

export function getProviderLogo(provider: string | null | undefined) {
	return provider ? PROVIDER_LOGOS[provider] : undefined;
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
			icon: PROVIDER_LOGOS[provider],
		};
	});
}
