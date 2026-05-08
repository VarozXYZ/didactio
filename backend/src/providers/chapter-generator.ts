import type {DidacticUnitGeneratedChapter} from "../didactic-unit/didactic-unit-chapter.js";
import type {
	DidacticUnitLevel,
	DidacticUnitQuestionAnswer,
	DidacticUnitReferenceSyllabus,
} from "../didactic-unit/planning.js";

export interface ChapterGenerationSource {
	topic: string;
	provider: string;
	level: DidacticUnitLevel;
	questionnaireAnswers?: DidacticUnitQuestionAnswer[];
	syllabus?: DidacticUnitReferenceSyllabus;
}

export interface ChapterGenerator {
	generate(
		source: ChapterGenerationSource,
		chapterIndex: number,
	): Promise<DidacticUnitGeneratedChapter>;
}

function formatQuestionnaireContext(source: ChapterGenerationSource): string {
	if (!source.questionnaireAnswers?.length) {
		return "not provided";
	}

	return source.questionnaireAnswers
		.map((answer) => `- ${answer.questionId}: ${answer.value}`)
		.join("\n");
}

function getSyllabusChapter(
	source: ChapterGenerationSource,
	chapterIndex: number,
) {
	const chapter = source.syllabus?.modules[chapterIndex];

	if (!chapter) {
		throw new Error(
			"Chapter index is out of range for the approved syllabus.",
		);
	}

	return chapter;
}

export function buildChapterGenerationPrompt(
	source: ChapterGenerationSource,
	chapterIndex: number,
): string {
	const chapter = getSyllabusChapter(source, chapterIndex);

	return [
		"Write one didactic chapter in sanitized HTML.",
		`Topic: ${source.topic}`,
		`Unit title: ${source.syllabus?.title ?? source.topic}`,
		`Learner level: ${source.level}`,
		`Module title: ${chapter.title}`,
		`Module overview: ${chapter.overview}`,
		`Module lessons: ${chapter.lessons.map((lesson) => lesson.title).join(", ")}`,
		"Learner questionnaire context:",
		formatQuestionnaireContext(source),
		"Return only HTML instructional content.",
		"Use h2, h3, h4, p, ul, ol, li, blockquote, pre, code, table, thead, tbody, tr, th, td, hr, br, strong, em, u, a, sub, sup, and mark only.",
		"Do not include JSON, markdown fences, script, style, iframe, img, div, section, or inline style attributes.",
		"Do not include the module title as a top-level heading.",
		"Do not include a standalone overview section at the beginning.",
		"Start directly with the instructional body and use natural topic-specific headings.",
	].join("\n");
}
