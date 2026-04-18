import type {PlanningSyllabus} from "../types";

export type PartialPlanningSyllabusLesson = {
	title: string;
	contentOutline: string[];
};

export type PartialPlanningSyllabusChapter = {
	title: string;
	overview?: string;
	keyPoints: string[];
	estimatedDurationMinutes?: number;
	lessons: PartialPlanningSyllabusLesson[];
};

export type PartialPlanningSyllabus = {
	title?: string;
	overview?: string;
	learningGoals: string[];
	keywords: string[];
	estimatedDurationMinutes?: number;
	chapters: PartialPlanningSyllabusChapter[];
};

function cleanHeading(value: string): string {
	return value.replace(/^#+\s*/, "").trim();
}

function stripNumericPrefix(value: string): string {
	return value.replace(/^\d+[).\-\s]+/, "").trim();
}

function splitSections(
	markdown: string,
	headingDepth: number,
): Array<{heading: string; body: string}> {
	const prefix = `${"#".repeat(headingDepth)} `;
	const lines = markdown.split(/\r?\n/);
	const sections: Array<{heading: string; body: string}> = [];
	let currentHeading = "";
	let currentBody: string[] = [];

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
		if (line.startsWith(prefix)) {
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

function parseBulletList(block: string): string[] {
	return block
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => /^[-*]\s+/.test(line))
		.map((line) => line.replace(/^[-*]\s+/, "").trim())
		.filter(Boolean);
}

function parseParagraph(block: string): string | undefined {
	const value = block
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#"))
		.join(" ")
		.trim();

	return value || undefined;
}

function parseNumericBlock(block: string): number | undefined {
	const joined = block
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.join(" ");
	const matched = joined.match(/\d+/);

	if (!matched) {
		return undefined;
	}

	return Number.parseInt(matched[0], 10);
}

function parseLessons(block: string): PartialPlanningSyllabusLesson[] {
	return splitSections(block, 5).map((lessonSection) => ({
		title: stripNumericPrefix(lessonSection.heading),
		contentOutline: parseBulletList(lessonSection.body),
	}));
}

function parseChapters(block: string): PartialPlanningSyllabusChapter[] {
	return splitSections(block, 3).map((chapterSection) => {
		const innerSections = splitSections(chapterSection.body, 4);
		const overviewSection = innerSections.find((entry) =>
			/overview/i.test(entry.heading),
		);
		const estimatedDurationSection = innerSections.find((entry) =>
			/estimated duration/i.test(entry.heading),
		);
		const keyPointsSection = innerSections.find((entry) =>
			/key points?/i.test(entry.heading),
		);
		const lessonsSection = innerSections.find((entry) =>
			/lessons?/i.test(entry.heading),
		);

		return {
			title: stripNumericPrefix(chapterSection.heading),
			overview:
				overviewSection ?
					parseParagraph(overviewSection.body)
				:	undefined,
			keyPoints:
				keyPointsSection ? parseBulletList(keyPointsSection.body) : [],
			estimatedDurationMinutes:
				estimatedDurationSection ?
					parseNumericBlock(estimatedDurationSection.body)
				:	undefined,
			lessons: lessonsSection ? parseLessons(lessonsSection.body) : [],
		};
	});
}

export function parsePartialSyllabusMarkdown(
	markdown: string,
): PartialPlanningSyllabus | null {
	const trimmed = markdown.trim();
	if (!trimmed) {
		return null;
	}

	const topSections = splitSections(trimmed, 1);
	const titleSection = topSections[0];

	if (!titleSection) {
		return null;
	}

	const secondLevelSections = splitSections(titleSection.body, 2);
	const overviewSection = secondLevelSections.find((section) =>
		/overview/i.test(section.heading),
	);
	const learningGoalsSection = secondLevelSections.find((section) =>
		/learning goals?/i.test(section.heading),
	);
	const keywordsSection = secondLevelSections.find((section) =>
		/keywords?/i.test(section.heading),
	);
	const estimatedDurationSection = secondLevelSections.find((section) =>
		/estimated duration/i.test(section.heading),
	);
	const chaptersSection = secondLevelSections.find((section) =>
		/chapters?/i.test(section.heading),
	);

	return {
		title: cleanHeading(titleSection.heading) || undefined,
		overview:
			overviewSection ? parseParagraph(overviewSection.body) : undefined,
		learningGoals:
			learningGoalsSection ?
				parseBulletList(learningGoalsSection.body)
			:	[],
		keywords: keywordsSection ? parseBulletList(keywordsSection.body) : [],
		estimatedDurationMinutes:
			estimatedDurationSection ?
				parseNumericBlock(estimatedDurationSection.body)
			:	undefined,
		chapters: chaptersSection ? parseChapters(chaptersSection.body) : [],
	};
}

export function hasStructuredSyllabusPreview(
	syllabus: PartialPlanningSyllabus | PlanningSyllabus | null | undefined,
): boolean {
	if (!syllabus) {
		return false;
	}

	return Boolean(
		syllabus.title ||
		syllabus.overview ||
		syllabus.learningGoals.length ||
		syllabus.keywords.length ||
		syllabus.chapters.length,
	);
}
