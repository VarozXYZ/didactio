import type {DidacticUnitGeneratedChapter} from "../didactic-unit/didactic-unit-chapter.js";

function cleanHeading(value: string): string {
	return value.replace(/^#+\s*/, "").trim();
}

function splitSections(
	markdown: string,
	headingDepth: number,
): Array<{heading: string; body: string}> {
	const lines = markdown.split(/\r?\n/);
	const sections: Array<{heading: string; body: string}> = [];
	let currentHeading = "";
	let currentBody: string[] = [];
	const prefix = "#".repeat(headingDepth);
	let activeFenceMarker: "```" | "~~~" | null = null;

	const pushCurrent = () => {
		if (!currentHeading) {
			return;
		}

		sections.push({
			heading: currentHeading,
			body: currentBody.join("\n").trim(),
		});
	};

	for (const line of lines) {
		const trimmedLine = line.trimStart();

		if (trimmedLine.startsWith("```") || trimmedLine.startsWith("~~~")) {
			const fenceMarker = trimmedLine.startsWith("```") ? "```" : "~~~";

			if (activeFenceMarker === fenceMarker) {
				activeFenceMarker = null;
			} else if (activeFenceMarker === null) {
				activeFenceMarker = fenceMarker;
			}
		}

		if (activeFenceMarker === null && line.startsWith(`${prefix} `)) {
			pushCurrent();
			currentHeading = cleanHeading(line);
			currentBody = [];
			continue;
		}

		currentBody.push(line);
	}

	pushCurrent();
	return sections;
}

export function normalizeGeneratedChapterMarkdown(
	markdown: string,
	chapterIndex: number,
	options: {fallbackTitle?: string} = {},
): Omit<
	DidacticUnitGeneratedChapter,
	"generatedAt" | "updatedAt" | "chapterIndex"
> {
	const trimmed = markdown.trim();
	if (!trimmed) {
		throw new Error("Generated chapter markdown is empty.");
	}

	const topSections = splitSections(trimmed, 1);
	const titleSection = topSections[0];
	const normalizedTitle = cleanHeading(
		titleSection?.heading ?? options.fallbackTitle ?? "",
	);
	const bodyWithoutTopLevelTitle =
		titleSection && normalizedTitle ? titleSection.body.trim() : trimmed;
	const normalizedMarkdown = bodyWithoutTopLevelTitle || trimmed;

	return {
		title: normalizedTitle || `Module ${chapterIndex + 1}`,
		markdown: normalizedMarkdown,
	};
}
