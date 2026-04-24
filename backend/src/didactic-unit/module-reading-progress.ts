import type {DidacticUnit} from "./create-didactic-unit.js";
import type {DidacticUnitGeneratedChapter} from "./didactic-unit-chapter.js";

export interface DidacticUnitModuleReadProgress {
	moduleIndex: number;
	readCharacterCount: number;
	lastReadAt: string;
	lastVisitedPageIndex?: number;
	lastVisitedAt?: string;
}

function cleanToken(token: string): string {
	return token.replace(/^[`"'([{]+|[`"',.:;!?)}\]]+$/g, "");
}

const TITLE_STOP_WORDS = new Set([
	"a",
	"an",
	"and",
	"at",
	"by",
	"for",
	"from",
	"in",
	"of",
	"on",
	"or",
	"the",
	"to",
	"with",
]);

const TITLE_END_STOP_WORDS = new Set([
	"a",
	"an",
	"and",
	"for",
	"in",
	"of",
	"on",
	"or",
	"the",
	"to",
	"with",
]);

function isTitleLikeToken(token: string): boolean {
	const cleaned = cleanToken(token);

	if (!cleaned) {
		return false;
	}

	const lower = cleaned.toLowerCase();

	if (TITLE_STOP_WORDS.has(lower)) {
		return true;
	}

	if (/^[A-Z][a-z0-9/-]*$/.test(cleaned)) {
		return true;
	}

	if (/^[A-Z][A-Za-z0-9-]*\.[A-Za-z0-9.-]+$/.test(cleaned)) {
		return false;
	}

	return false;
}

function repairRunOnHeading(line: string): string {
	const match = line.match(/^(#{1,6})\s+(.+)$/);

	if (!match) {
		return line;
	}

	const marker = match[1];
	const body = match[2].trim();

	if (body.length < 50) {
		return line;
	}

	const words = body.split(/\s+/);
	let bestSplitIndex = -1;
	let bestScore = Number.NEGATIVE_INFINITY;

	for (let index = 2; index <= Math.min(6, words.length - 1); index += 1) {
		const prefix = words.slice(0, index);
		const rest = words.slice(index);

		if (rest.join(" ").length < 24) {
			continue;
		}

		let score = 0;

		prefix.forEach((word) => {
			score += isTitleLikeToken(word) ? 1 : -2;
		});

		const lastPrefix = cleanToken(
			prefix[prefix.length - 1] ?? "",
		).toLowerCase();
		if (TITLE_END_STOP_WORDS.has(lastPrefix)) {
			score -= 1.5;
		}

		const firstRest = cleanToken(rest[0] ?? "");
		const secondRest = cleanToken(rest[1] ?? "");

		if (/^[a-z]/.test(firstRest)) {
			score += 2;
		} else if (/^[a-z]/.test(secondRest)) {
			score += 1.5;
		}

		if (/[.]/.test(prefix.join(" "))) {
			score -= 1;
		}

		if (score > bestScore) {
			bestScore = score;
			bestSplitIndex = index;
		}
	}

	if (bestSplitIndex === -1 || bestScore < 2) {
		return line;
	}

	const heading = words.slice(0, bestSplitIndex).join(" ");
	const remainder = words.slice(bestSplitIndex).join(" ");

	return `${marker} ${heading}\n\n${remainder}`;
}

function promoteStandaloneNumberedHeading(
	line: string,
	previousLine: string | undefined,
	nextLine: string | undefined,
): string {
	const trimmedLine = line.trim();

	if (!trimmedLine || /^#{1,6}\s/.test(trimmedLine)) {
		return line;
	}

	const match = trimmedLine.match(/^(\d+(?:\.\d+)+)\.?\s+(.+)$/);
	if (!match) {
		return line;
	}

	const body = match[2].trim();
	if (body.length < 4 || body.length > 90 || /[.!?]$/.test(body)) {
		return line;
	}

	const previousTrimmed = previousLine?.trim() ?? "";
	const nextTrimmed = nextLine?.trim() ?? "";

	if (
		previousTrimmed &&
		!/[.!?:]$/.test(previousTrimmed) &&
		!/^#{1,6}\s/.test(previousTrimmed)
	) {
		return line;
	}

	if (!nextTrimmed || /^(?:[-*]\s|\d+\.\s)/.test(nextTrimmed)) {
		return line;
	}

	const level = Math.min(6, match[1].split(".").length);
	return `${"#".repeat(level)} ${trimmedLine}`;
}

function repairAiMarkdown(markdown: string): string {
	const repairedMarkdown = markdown
		.replace(/\*\*([^\n*]+)\n\s*\n([^\n*]+)\*\*/g, "**$1 $2**")
		.replace(/:\s+(1\.\s+)/g, ":\n\n$1")
		.replace(/([.!?])\s+(\d+\.\s+)/g, "$1\n\n$2");
	const repairedLines = repairedMarkdown.split("\n");

	return repairedLines
		.map((line, index, lines) =>
			promoteStandaloneNumberedHeading(
				repairRunOnHeading(line),
				lines[index - 1],
				lines[index + 1],
			),
		)
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function renumberMarkdownHeadings(markdown: string): string {
	const lines = markdown.split("\n");
	let activeFenceMarker: "```" | "~~~" | null = null;
	let minimumHeadingDepth: number | null = null;

	for (const line of lines) {
		const trimmedLine = line.trimStart();

		if (trimmedLine.startsWith("```") || trimmedLine.startsWith("~~~")) {
			const fenceMarker = trimmedLine.startsWith("```") ? "```" : "~~~";
			activeFenceMarker =
				activeFenceMarker === fenceMarker ? null
				: activeFenceMarker === null ? fenceMarker
				: activeFenceMarker;
		}

		if (activeFenceMarker !== null) {
			continue;
		}

		const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
		if (!headingMatch) {
			continue;
		}

		const depth = headingMatch[1].length;
		minimumHeadingDepth =
			minimumHeadingDepth === null ? depth : (
				Math.min(minimumHeadingDepth, depth)
			);
	}

	if (minimumHeadingDepth === null) {
		return markdown;
	}

	activeFenceMarker = null;
	const headingCounters = [0, 0, 0, 0, 0, 0];

	return lines
		.map((line) => {
			const trimmedLine = line.trimStart();

			if (
				trimmedLine.startsWith("```") ||
				trimmedLine.startsWith("~~~")
			) {
				const fenceMarker =
					trimmedLine.startsWith("```") ? "```" : "~~~";
				activeFenceMarker =
					activeFenceMarker === fenceMarker ? null
					: activeFenceMarker === null ? fenceMarker
					: activeFenceMarker;
				return line;
			}

			if (activeFenceMarker !== null) {
				return line;
			}

			const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
			if (!headingMatch) {
				return line;
			}

			const hashes = headingMatch[1];
			const body = headingMatch[2]
				.replace(/^\d+(?:\.\d+)*\.\s+/, "")
				.trim();

			const normalizedLevel = Math.max(
				1,
				Math.min(6, hashes.length - minimumHeadingDepth + 1),
			);

			headingCounters[normalizedLevel - 1] += 1;
			for (
				let index = normalizedLevel;
				index < headingCounters.length;
				index += 1
			) {
				headingCounters[index] = 0;
			}

			const prefix = headingCounters.slice(0, normalizedLevel).join(".");
			return `${hashes} ${prefix}. ${body}`;
		})
		.join("\n");
}

export function formatModuleMarkdownForReadProgress(
	markdown: string | null | undefined,
): string {
	const normalizedMarkdown = markdown?.trim() ?? "";

	if (!normalizedMarkdown) {
		return "";
	}

	return renumberMarkdownHeadings(repairAiMarkdown(normalizedMarkdown));
}

export function markdownToReadableText(
	markdown: string | null | undefined,
): string {
	const formattedMarkdown = formatModuleMarkdownForReadProgress(markdown);

	if (!formattedMarkdown) {
		return "";
	}

	return formattedMarkdown
		.replace(/```[\s\S]*?```/g, (match) =>
			match.replace(/^```[^\n]*\n?/g, "").replace(/\n?```$/g, ""),
		)
		.replace(/`([^`]+)`/g, "$1")
		.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/^\s{0,3}>\s?/gm, "")
		.replace(/^\s*[-*+]\s+/gm, "")
		.replace(/^\s*\d+\.\s+/gm, "")
		.replace(/[*_~]+/g, "")
		.replace(/\|/g, " ")
		.replace(/\n{2,}/g, "\n")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n[ \t]+/g, "\n")
		.replace(/\s+/g, " ")
		.trim();
}

export function getGeneratedModule(
	didacticUnit: DidacticUnit,
	moduleIndex: number,
): DidacticUnitGeneratedChapter | undefined {
	return didacticUnit.generatedChapters?.find(
		(generatedChapter) => generatedChapter.chapterIndex === moduleIndex,
	);
}

export function getModuleTotalCharacterCount(
	didacticUnit: DidacticUnit,
	moduleIndex: number,
): number {
	const generatedModule = getGeneratedModule(didacticUnit, moduleIndex);

	if (!generatedModule) {
		return 0;
	}

	return markdownToReadableText(generatedModule.markdown).length;
}

export function getModuleReadProgressRecord(
	didacticUnit: DidacticUnit,
	moduleIndex: number,
): DidacticUnitModuleReadProgress | undefined {
	return didacticUnit.moduleReadProgress?.find(
		(progress) => progress.moduleIndex === moduleIndex,
	);
}

export function getModuleReadCharacterCount(
	didacticUnit: DidacticUnit,
	moduleIndex: number,
): number {
	const totalCharacterCount = getModuleTotalCharacterCount(
		didacticUnit,
		moduleIndex,
	);

	if (totalCharacterCount === 0) {
		return 0;
	}

	return Math.min(
		getModuleReadProgressRecord(didacticUnit, moduleIndex)
			?.readCharacterCount ?? 0,
		totalCharacterCount,
	);
}

export function updateDidacticUnitModuleReadProgress(
	didacticUnit: DidacticUnit,
	moduleIndex: number,
	requestedReadCharacterCount: number,
	requestedLastVisitedPageIndex?: number,
): DidacticUnit {
	const generatedModule = getGeneratedModule(didacticUnit, moduleIndex);

	if (!generatedModule) {
		throw new Error("Generated didactic unit module not found.");
	}

	const totalCharacterCount = getModuleTotalCharacterCount(
		didacticUnit,
		moduleIndex,
	);
	const clampedRequestedReadCharacterCount = Math.max(
		0,
		Math.min(totalCharacterCount, Math.floor(requestedReadCharacterCount)),
	);
	const existingProgress = getModuleReadProgressRecord(
		didacticUnit,
		moduleIndex,
	);
	const previousReadCharacterCount = existingProgress?.readCharacterCount ?? 0;
	const nextReadCharacterCount = Math.max(
		previousReadCharacterCount,
		clampedRequestedReadCharacterCount,
	);
	const nextLastVisitedPageIndex =
		requestedLastVisitedPageIndex ?? existingProgress?.lastVisitedPageIndex;
	const didReadAdvance = nextReadCharacterCount > previousReadCharacterCount;
	const didLastVisitedPageChange =
		nextLastVisitedPageIndex !== existingProgress?.lastVisitedPageIndex;

	if (
		existingProgress &&
		existingProgress.readCharacterCount === nextReadCharacterCount &&
		!didLastVisitedPageChange
	) {
		return didacticUnit;
	}

	const updatedAt = new Date().toISOString();
	const nextModuleReadProgress = [
		...(didacticUnit.moduleReadProgress ?? []).filter(
			(progress) => progress.moduleIndex !== moduleIndex,
		),
		{
			moduleIndex,
			readCharacterCount: nextReadCharacterCount,
			lastReadAt:
				didReadAdvance || !existingProgress ?
					updatedAt
				: existingProgress.lastReadAt,
			lastVisitedPageIndex: nextLastVisitedPageIndex,
			lastVisitedAt:
				requestedLastVisitedPageIndex !== undefined ?
					updatedAt
				: existingProgress?.lastVisitedAt,
		},
	].sort((left, right) => left.moduleIndex - right.moduleIndex);

	return {
		...didacticUnit,
		moduleReadProgress: nextModuleReadProgress,
		updatedAt,
	};
}

export function resetDidacticUnitModuleReadProgress(
	didacticUnit: DidacticUnit,
	moduleIndex: number,
): DidacticUnit {
	const nextModuleReadProgress = (
		didacticUnit.moduleReadProgress ?? []
	).filter((progress) => progress.moduleIndex !== moduleIndex);

	if (
		nextModuleReadProgress.length ===
		(didacticUnit.moduleReadProgress ?? []).length
	) {
		return didacticUnit;
	}

	return {
		...didacticUnit,
		moduleReadProgress: nextModuleReadProgress,
	};
}
