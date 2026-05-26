import type {
	CoinTypeDto,
	GenerationQualityDto,
} from "@/dashboard/api/dashboardApi";

export type UnitLength = "intro" | "short" | "long" | "textbook";

const UNIT_LENGTH_COSTS: Record<UnitLength, number> = {
	intro: 1,
	short: 1,
	long: 2,
	textbook: 3,
};

export function getUnitGenerationCost(input: {
	quality: GenerationQualityDto;
	length: UnitLength;
}): {coinType: CoinTypeDto; amount: number} {
	return {
		coinType: input.quality,
		amount: UNIT_LENGTH_COSTS[input.length],
	};
}

export function getModuleRegenerationCost(input: {
	quality: GenerationQualityDto;
	length: UnitLength;
}): {coinType: CoinTypeDto; amount: number} {
	if (input.quality === "gold") {
		return {
			coinType: "silver",
			amount: 5,
		};
	}

	const amount =
		input.length === "textbook" ? 5
		: input.length === "long" ? 3
		: 1;
	return {
		coinType: "bronze",
		amount,
	};
}

export function getActivityGenerationCost(input: {
	quality: GenerationQualityDto;
}): {coinType: CoinTypeDto; amount: number} {
	return {
		coinType: input.quality === "gold" ? "silver" : "bronze",
		amount: 1,
	};
}

export function getActivityFeedbackRefillCost(input: {
	quality: GenerationQualityDto;
}): {coinType: CoinTypeDto; amount: number} {
	return {
		coinType: input.quality === "gold" ? "silver" : "bronze",
		amount: 1,
	};
}
