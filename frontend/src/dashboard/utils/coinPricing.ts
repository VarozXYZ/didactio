import type {
	BackendCoinType,
	BackendGenerationQuality,
} from "../api/dashboardApi";

export type UnitLength = "intro" | "short" | "long" | "textbook";

const UNIT_LENGTH_COSTS: Record<UnitLength, number> = {
	intro: 1,
	short: 1,
	long: 2,
	textbook: 3,
};

export function getUnitGenerationCost(input: {
	quality: BackendGenerationQuality;
	length: UnitLength;
}): {coinType: BackendCoinType; amount: number} {
	return {
		coinType: input.quality,
		amount: UNIT_LENGTH_COSTS[input.length],
	};
}

export function getModuleRegenerationCost(input: {
	quality: BackendGenerationQuality;
	length: UnitLength;
}): {coinType: BackendCoinType; amount: number} {
	const amount =
		input.length === "textbook" ? 5
		: input.length === "long" ? 3
		: 1;
	return {
		coinType: input.quality === "gold" ? "silver" : "bronze",
		amount,
	};
}

export function getActivityGenerationCost(input: {
	quality: BackendGenerationQuality;
}): {coinType: BackendCoinType; amount: number} {
	return {
		coinType: input.quality === "gold" ? "silver" : "bronze",
		amount: 1,
	};
}

export function getActivityFeedbackRefillCost(input: {
	quality: BackendGenerationQuality;
}): {coinType: BackendCoinType; amount: number} {
	return {
		coinType: input.quality === "gold" ? "silver" : "bronze",
		amount: 1,
	};
}
