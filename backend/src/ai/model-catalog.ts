export interface ModelEntry {
	id: string;
	label: string;
	description: string;
	recommended?: boolean;
}

export interface ModelCatalog {
	silver: ModelEntry[];
	gold: ModelEntry[];
}

export const MODEL_CATALOG: ModelCatalog = {
	silver: [
		{
			id: "deepseek/deepseek-v4-flash",
			label: "DeepSeek V4 Flash",
			description: "Fast and efficient. Great for most learning content.",
			recommended: true,
		},
		{
			id: "openai/gpt-5-nano",
			label: "GPT-5 Nano",
			description: "OpenAI's lightweight model. Quick and reliable.",
		},
		{
			id: "google/gemini-2.5-flash-lite",
			label: "Gemini 2.5 Flash Lite",
			description: "Google's efficient model. Good balance of speed and quality.",
		},
	],
	gold: [
		{
			id: "anthropic/claude-sonnet-4-6",
			label: "Claude Sonnet 4.6",
			description: "Anthropic's balanced model. Excellent at structured content.",
			recommended: true,
		},
		{
			id: "openai/gpt-5.5",
			label: "GPT-5.5",
			description: "OpenAI's powerful model. Superior reasoning and depth.",
		},
		{
			id: "google/gemini-3.1-pro-preview",
			label: "Gemini 3.1 Pro",
			description: "Google's frontier model. Strong at multimodal reasoning.",
		},
	],
};

export function isValidModelId(tier: "silver" | "gold", modelId: string): boolean {
	return MODEL_CATALOG[tier].some((entry) => entry.id === modelId);
}
