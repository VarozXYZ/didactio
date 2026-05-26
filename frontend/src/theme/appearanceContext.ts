import {createContext} from "react";
import type {AppearanceMode, ResolvedAppearance} from "./appearance";

export type AppearanceContextValue = {
	mode: AppearanceMode;
	resolvedMode: ResolvedAppearance;
	setMode: (mode: AppearanceMode) => void;
};

export const AppearanceContext = createContext<AppearanceContextValue | null>(null);
