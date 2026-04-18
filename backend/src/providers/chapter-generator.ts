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

function findAnswerValue(
	source: ChapterGenerationSource,
	questionId: string,
): string {
	return (
		source.questionnaireAnswers?.find(
			(answer) => answer.questionId === questionId,
		)?.value ?? "not provided"
	);
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
	const topicKnowledgeLevel = findAnswerValue(
		source,
		"topic_knowledge_level",
	);
	const relatedKnowledgeLevel = findAnswerValue(
		source,
		"related_knowledge_level",
	);
	const learningGoal = findAnswerValue(source, "learning_goal");

	return [
		"Write one didactic chapter in markdown.",
		`Topic: ${source.topic}`,
		`Unit title: ${source.syllabus?.title ?? source.topic}`,
		`Learner level: ${source.level}`,
		`Module title: ${chapter.title}`,
		`Module overview: ${chapter.overview}`,
		`Module lessons: ${chapter.lessons.map((lesson) => lesson.title).join(", ")}`,
		`Current topic knowledge: ${topicKnowledgeLevel}`,
		`Related knowledge: ${relatedKnowledgeLevel}`,
		`Learner goal: ${learningGoal}`,
		"Return only markdown instructional content.",
		"Do not include the module title as a top-level heading.",
		"Do not include a standalone overview section at the beginning.",
		"Start directly with the instructional body and use natural topic-specific headings.",
	].join("\n");
}
