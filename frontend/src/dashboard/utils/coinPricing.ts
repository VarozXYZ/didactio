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

export function getSyllabusGenerationCost(): {
	coinType: BackendCoinType;
	amount: number;
} {
	return {coinType: "bronze", amount: 1};
}

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
}): {coinType: BackendCoinType; amount: number} {
	return {
		coinType: input.quality === "gold" ? "silver" : "bronze",
		amount: input.quality === "gold" ? 5 : 1,
	};
}

export function getActivityFeedbackRefillCost(input: {
	quality: BackendGenerationQuality;
}): {coinType: BackendCoinType; amount: number} {
	return {
		coinType: input.quality,
		amount: 1,
	};
}
