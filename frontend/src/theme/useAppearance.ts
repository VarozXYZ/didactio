import {useContext} from "react";
import {AppearanceContext} from "./appearanceContext";

export function useAppearance() {
	const context = useContext(AppearanceContext);
	if (!context) {
		throw new Error("useAppearance must be used within AppearanceProvider.");
	}

	return context;
}
