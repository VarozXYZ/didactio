import {FONT_CATALOG, type FontId} from "./typography";

// Tracks which fonts have finished loading.
const loadedFonts = new Set<FontId>(["inter"]); // Inter is already in index.css

// In-flight load promises, keyed by FontId.
const pendingLoads = new Map<FontId, Promise<void>>();

async function doLoad(fontId: FontId): Promise<void> {
	const entry = FONT_CATALOG[fontId];
	if (!entry.googleId) return; // Already bundled (Inter)

	// Inject the Google Fonts stylesheet if not already present.
	const selector = `link[data-gfont="${fontId}"]`;
	if (!document.querySelector(selector)) {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = `https://fonts.googleapis.com/css2?family=${entry.googleId}&display=swap`;
		link.dataset.gfont = fontId;
		document.head.appendChild(link);
	}

	// Wait until the browser has the specific weights we care about.
	await Promise.allSettled([
		document.fonts.load(`400 16px "${entry.family}"`),
		document.fonts.load(`700 16px "${entry.family}"`),
	]);
}

export async function loadFont(fontId: FontId): Promise<void> {
	if (loadedFonts.has(fontId)) return;

	const existing = pendingLoads.get(fontId);
	if (existing) return existing;

	const promise = doLoad(fontId)
		.then(() => {
			loadedFonts.add(fontId);
			pendingLoads.delete(fontId);
		})
		.catch(() => {
			pendingLoads.delete(fontId);
		});

	pendingLoads.set(fontId, promise);
	return promise;
}

export async function loadFonts(fontIds: FontId[]): Promise<void> {
	await Promise.all(fontIds.map(loadFont));
}

export function isFontLoaded(fontId: FontId): boolean {
	return loadedFonts.has(fontId);
}
