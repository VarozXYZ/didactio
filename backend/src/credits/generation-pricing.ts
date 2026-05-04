import type {CreditCoinType} from "../auth/core/types.js";
import type {DidacticUnitLength} from "../didactic-unit/planning.js";

export type GenerationQuality = "silver" | "gold";
export type GenerationChargeOperation =
	| "syllabus_generation"
	| "unit_generation"
	| "module_regeneration";

export interface GenerationCoinCost {
	coinType: CreditCoinType;
	amount: number;
}

const UNIT_LENGTH_COSTS: Record<DidacticUnitLength, number> = {
	intro: 1,
	short: 1,
	long: 2,
	textbook: 3,
};

export function resolveUnitGenerationCost(input: {
	quality: GenerationQuality;
	length: DidacticUnitLength;
}): GenerationCoinCost {
	return {
		coinType: input.quality,
		amount: UNIT_LENGTH_COSTS[input.length],
	};
}

export function resolveSyllabusGenerationCost(): GenerationCoinCost {
	return {
		coinType: "bronze",
		amount: 1,
	};
}

export function resolveModuleRegenerationCost(input: {
	quality: GenerationQuality;
}): GenerationCoinCost {
	return {
		coinType: input.quality === "gold" ? "silver" : "bronze",
		amount: 1,
	};
}

export function isGenerationQuality(value: unknown): value is GenerationQuality {
	return value === "silver" || value === "gold";
}

export function legacyTierToGenerationQuality(
	value: unknown,
): GenerationQuality | undefined {
	if (value === "silver" || value === "cheap") {
		return "silver";
	}

	if (value === "gold" || value === "premium") {
		return "gold";
	}

	return undefined;
}
