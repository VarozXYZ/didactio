export type AppearanceMode = "light" | "dark" | "system";
export type ResolvedAppearance = "light" | "dark";

export const APPEARANCE_STORAGE_KEY = "didactio.appearance";

export function parseAppearanceMode(value: string | null): AppearanceMode {
	return value === "light" || value === "dark" || value === "system" ?
			value
		:	"system";
}

export function resolveAppearance(
	mode: AppearanceMode,
	systemMode: ResolvedAppearance,
): ResolvedAppearance {
	return mode === "system" ? systemMode : mode;
}
