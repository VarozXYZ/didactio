import {
	createContext,
	useContext,
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
} from "./appearance";

export type {AppearanceMode} from "./appearance";

type AppearanceContextValue = {
	mode: AppearanceMode;
	resolvedMode: ResolvedAppearance;
	setMode: (mode: AppearanceMode) => void;
};

const DARK_QUERY = "(prefers-color-scheme: dark)";
const AppearanceContext = createContext<AppearanceContextValue | null>(null);

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

// Hooks and providers intentionally share this small context module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAppearance() {
	const context = useContext(AppearanceContext);
	if (!context) {
		throw new Error("useAppearance must be used within AppearanceProvider.");
	}

	return context;
}
