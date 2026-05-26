export type GenerationQualityDto = "silver" | "gold";
export type AiModelTierDto = GenerationQualityDto;

export type AiModelConfigDto = {
	provider: string;
	model: string;
};

export type ModelEntryDto = {
	id: string;
	label: string;
	description: string;
	recommended?: boolean;
};

export type ModelCatalogDto = {
	silver: ModelEntryDto[];
	gold: ModelEntryDto[];
};

export type AuthoringConfigDto = {
	language: string;
	tone: "friendly" | "neutral" | "professional";
	learnerLevel: "beginner" | "intermediate" | "advanced";
	extraInstructions?: string;
};

export type AiConfigDto = {
	silver: AiModelConfigDto;
	gold: AiModelConfigDto;
	authoring: AuthoringConfigDto;
};
