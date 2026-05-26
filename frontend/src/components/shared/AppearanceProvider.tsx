import {
	useEffect,
	useMemo,
	useState,
	type PropsWithChildren,
} from "react";
import {
	APPEARANCE_STORAGE_KEY,
	parseAppearanceMode,
	resolveAppearance,
	type AppearanceMode,
	type ResolvedAppearance,
} from "@/theme/appearance";
import {AppearanceContext, type AppearanceContextValue} from "@/theme/appearanceContext";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStoredMode(): AppearanceMode {
	if (typeof window === "undefined") {
		return "system";
	}

	return parseAppearanceMode(window.localStorage.getItem(APPEARANCE_STORAGE_KEY));
}

function readSystemMode(): ResolvedAppearance {
	return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function AppearanceProvider({children}: PropsWithChildren) {
	const [mode, setMode] = useState<AppearanceMode>(readStoredMode);
	const [systemMode, setSystemMode] = useState<ResolvedAppearance>(() =>
		typeof window === "undefined" ? "light" : readSystemMode(),
	);

	useEffect(() => {
		const query = window.matchMedia(DARK_QUERY);
		const onChange = () => setSystemMode(query.matches ? "dark" : "light");
		onChange();
		query.addEventListener("change", onChange);
		return () => query.removeEventListener("change", onChange);
	}, []);

	useEffect(() => {
		window.localStorage.setItem(APPEARANCE_STORAGE_KEY, mode);
	}, [mode]);

	const value = useMemo<AppearanceContextValue>(
		() => ({
			mode,
			resolvedMode: resolveAppearance(mode, systemMode),
			setMode,
		}),
		[mode, systemMode],
	);

	return (
		<AppearanceContext.Provider value={value}>
			{children}
		</AppearanceContext.Provider>
	);
}
