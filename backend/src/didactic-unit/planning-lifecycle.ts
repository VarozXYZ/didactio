import type {
	DidacticUnitReferenceSyllabus,
	DidacticUnitQuestionAnswer,
	DidacticUnitQuestionnaireAnswersInput,
	DidacticUnitQuestionnaire,
	DidacticUnitSyllabus,
	UpdateDidacticUnitSyllabusInput,
} from "./planning.js";
import {
	adaptDidacticUnitSyllabusToReferenceSyllabus,
	adaptReferenceSyllabusToDidacticUnitSyllabus,
	buildQuestionnaireForDidacticUnit,
} from "./planning.js";
import type {DidacticUnit} from "./create-didactic-unit.js";
import type {AuthoringConfig} from "../ai/config.js";

function withUpdatedAt<T extends DidacticUnit>(didacticUnit: T): T {
	return {
		...didacticUnit,
		updatedAt: new Date().toISOString(),
	};
}

function findAnswerValue(
	answers: DidacticUnitQuestionAnswer[] | undefined,
	questionId: string,
): string {
	return (
		answers?.find((answer) => answer.questionId === questionId)?.value ??
		"not provided"
	);
}

function buildSyllabusPrompt(
	didacticUnit: DidacticUnit,
	authoring: AuthoringConfig,
): string {
	const topicKnowledge = findAnswerValue(
		didacticUnit.questionnaireAnswers,
		"topic_knowledge_level",
	);
	const relatedKnowledge = findAnswerValue(
		didacticUnit.questionnaireAnswers,
		"related_knowledge_level",
	);
	const learningGoal = findAnswerValue(
		didacticUnit.questionnaireAnswers,
		"learning_goal",
	);
	const continuityBrief =
		didacticUnit.improvedTopicBrief ?? didacticUnit.topic;
	const additionalContext = didacticUnit.additionalContext?.trim();

	return [
		"Create a didactic syllabus from this generation brief.",
		"",
		"Generation brief:",
		continuityBrief,
		"",
		`Normalized topic: ${didacticUnit.topic}.`,
		`Learner current knowledge of the topic: ${topicKnowledge}.`,
		`Learner knowledge of related concepts: ${relatedKnowledge}.`,
		`Learning goal: ${learningGoal}.`,
		`Explicit learner level: ${didacticUnit.level}.`,
		`Requested unit depth: ${didacticUnit.depth}.`,
		`Requested unit length: ${didacticUnit.length}.`,
		`Authoring language: ${authoring.language}.`,
		`Authoring tone: ${authoring.tone}.`,
		additionalContext ?
			`Additional learner/context notes: ${additionalContext}.`
		:	"",
		"Return a structured syllabus with a title, description, keywords, and an ordered module outline with lesson plans.",
	].join("\n");
}

function mergeAdditionalContext(
	existingContext: string | undefined,
	extraContext: string | undefined,
): string | undefined {
	const normalizedExisting = existingContext?.trim();
	const normalizedExtra = extraContext?.trim();

	if (!normalizedExisting && !normalizedExtra) {
		return undefined;
	}

	if (!normalizedExisting) {
		return normalizedExtra;
	}

	if (!normalizedExtra || normalizedExtra === normalizedExisting) {
		return normalizedExisting;
	}

	return `${normalizedExisting}\n\nAdditional syllabus guidance:\n${normalizedExtra}`;
}

export function moderateDidacticUnitPlanning(
	didacticUnit: DidacticUnit,
	input: {
		normalizedTopic: string;
		improvedTopicBrief: string;
		reasoningNotes: string;
	},
): DidacticUnit {
	if (didacticUnit.status !== "submitted") {
		throw new Error(
			"Didactic unit cannot be moderated from its current state.",
		);
	}

	return withUpdatedAt({
		...didacticUnit,
		title: input.normalizedTopic,
		topic: input.normalizedTopic,
		status: "moderation_completed",
		nextAction:
			didacticUnit.questionnaireEnabled ?
				"generate_questionnaire"
			:	"generate_syllabus_prompt",
		moderatedAt: new Date().toISOString(),
		improvedTopicBrief: input.improvedTopicBrief,
		reasoningNotes: input.reasoningNotes,
	});
}

export function generateDidacticUnitQuestionnaire(
	didacticUnit: DidacticUnit,
): DidacticUnit {
	if (didacticUnit.status !== "moderation_completed") {
		throw new Error(
			"Questionnaire cannot be generated from the current didactic unit state.",
		);
	}

	return withUpdatedAt({
		...didacticUnit,
		status: "questionnaire_ready",
		nextAction: "answer_questionnaire",
		questionnaire: buildQuestionnaireForDidacticUnit(didacticUnit.topic),
		questionnaireGeneratedAt: new Date().toISOString(),
	});
}

export function applyGeneratedDidacticUnitQuestionnaire(
	didacticUnit: DidacticUnit,
	questionnaire: DidacticUnitQuestionnaire,
): DidacticUnit {
	if (didacticUnit.status !== "moderation_completed") {
		throw new Error(
			"Questionnaire cannot be generated from the current didactic unit state.",
		);
	}

	return withUpdatedAt({
		...didacticUnit,
		status: "questionnaire_ready",
		nextAction: "answer_questionnaire",
		questionnaire: {
			questions: questionnaire.questions.map((question) => ({
				...question,
				options: question.options ? [...question.options] : undefined,
			})),
		},
		questionnaireGeneratedAt: new Date().toISOString(),
	});
}

export function answerDidacticUnitQuestionnaire(
	didacticUnit: DidacticUnit,
	input: DidacticUnitQuestionnaireAnswersInput,
): DidacticUnit {
	if (
		didacticUnit.status !== "questionnaire_ready" ||
		!didacticUnit.questionnaire
	) {
		throw new Error(
			"Questionnaire cannot be answered from the current didactic unit state.",
		);
	}

	if (input.answers.length === 0) {
		return withUpdatedAt({
			...didacticUnit,
			status: "questionnaire_answered",
			nextAction: "generate_syllabus_prompt",
			questionnaireAnswers: [],
			questionnaireAnsweredAt: new Date().toISOString(),
		});
	}

	const questionIds = didacticUnit.questionnaire.questions.map(
		(question) => question.id,
	);
	const uniqueAnswerIds = new Set(
		input.answers.map((answer) => answer.questionId),
	);

	if (uniqueAnswerIds.size !== input.answers.length) {
		throw new Error(
			"Questionnaire answers cannot contain duplicate questionIds.",
		);
	}

	if (input.answers.length !== questionIds.length) {
		throw new Error(
			"Questionnaire answers must cover every generated question.",
		);
	}

	for (const answer of input.answers) {
		if (!questionIds.includes(answer.questionId)) {
			throw new Error(
				"Questionnaire answers must match the generated questions.",
			);
		}
	}

	return withUpdatedAt({
		...didacticUnit,
		status: "questionnaire_answered",
		nextAction: "generate_syllabus_prompt",
		questionnaireAnswers: input.answers,
		questionnaireAnsweredAt: new Date().toISOString(),
	});
}

export function generateDidacticUnitSyllabusPrompt(
	didacticUnit: DidacticUnit,
	authoring: AuthoringConfig,
): DidacticUnit {
	return prepareDidacticUnitSyllabusGeneration(didacticUnit, authoring);
}

export function prepareDidacticUnitSyllabusGeneration(
	didacticUnit: DidacticUnit,
	authoring: AuthoringConfig,
	extraContext?: string,
): DidacticUnit {
	const canGenerateFromAnsweredQuestionnaire =
		didacticUnit.status === "questionnaire_answered" &&
		didacticUnit.questionnaireAnswers;
	const canGenerateWithoutQuestionnaire =
		didacticUnit.status === "moderation_completed" &&
		!didacticUnit.questionnaireEnabled;
	const canGenerateFromPreparedPrompt =
		didacticUnit.status === "syllabus_prompt_ready" &&
		Boolean(didacticUnit.syllabusPrompt);
	const canRegenerateExistingSyllabus =
		didacticUnit.status === "syllabus_ready" ||
		didacticUnit.status === "syllabus_approved";

	if (
		!canGenerateFromAnsweredQuestionnaire &&
		!canGenerateWithoutQuestionnaire &&
		!canGenerateFromPreparedPrompt &&
		!canRegenerateExistingSyllabus
	) {
		throw new Error(
			"Syllabus prompt cannot be generated from the current didactic unit state.",
		);
	}

	const preparedDidacticUnit = {
		...didacticUnit,
		additionalContext: mergeAdditionalContext(
			didacticUnit.additionalContext,
			extraContext,
		),
	};

	return withUpdatedAt({
		...preparedDidacticUnit,
		status: "syllabus_prompt_ready",
		nextAction: "review_syllabus_prompt",
		syllabusPrompt: buildSyllabusPrompt(preparedDidacticUnit, authoring),
		syllabusPromptGeneratedAt: new Date().toISOString(),
	});
}

export function applyGeneratedDidacticUnitSyllabus(
	didacticUnit: DidacticUnit,
	syllabus: DidacticUnitReferenceSyllabus,
): DidacticUnit {
	if (
		didacticUnit.status !== "syllabus_prompt_ready" ||
		!didacticUnit.syllabusPrompt
	) {
		throw new Error(
			"Syllabus cannot be generated from the current didactic unit state.",
		);
	}

	const compatibilitySyllabus =
		adaptReferenceSyllabusToDidacticUnitSyllabus(syllabus);

	return withUpdatedAt({
		...didacticUnit,
		title: compatibilitySyllabus.title,
		overview: compatibilitySyllabus.overview,
		learningGoals: [...compatibilitySyllabus.learningGoals],
		keywords: [...compatibilitySyllabus.keywords],
		modules: syllabus.modules.map((module) => ({
			title: module.title,
			overview: module.overview,
			lessons: module.lessons.map((lesson) => ({
				title: lesson.title,
				contentOutline: [...lesson.contentOutline],
			})),
		})),
		chapters: compatibilitySyllabus.chapters.map((chapter) => ({
			title: chapter.title,
			overview: chapter.overview,
			keyPoints: [...chapter.keyPoints],
			lessons: chapter.lessons.map((lesson) => ({
				title: lesson.title,
				contentOutline: [...lesson.contentOutline],
			})),
		})),
		status: "syllabus_ready",
		nextAction: "review_syllabus",
		referenceSyllabus: syllabus,
		syllabus: compatibilitySyllabus,
		syllabusGeneratedAt: new Date().toISOString(),
	});
}

export function updateDidacticUnitSyllabus(
	didacticUnit: DidacticUnit,
	input: UpdateDidacticUnitSyllabusInput,
): DidacticUnit {
	if (didacticUnit.status !== "syllabus_ready" || !didacticUnit.syllabus) {
		throw new Error(
			"Syllabus cannot be updated from the current didactic unit state.",
		);
	}

	const referenceSyllabus = adaptDidacticUnitSyllabusToReferenceSyllabus({
		topic: didacticUnit.topic,
		syllabus: input.syllabus,
	});

	return withUpdatedAt({
		...didacticUnit,
		title: input.syllabus.title,
		overview: input.syllabus.overview,
		learningGoals: [...input.syllabus.learningGoals],
		keywords: [...input.syllabus.keywords],
		modules: referenceSyllabus.modules.map((module) => ({
			title: module.title,
			overview: module.overview,
			lessons: module.lessons.map((lesson) => ({
				title: lesson.title,
				contentOutline: [...lesson.contentOutline],
			})),
		})),
		chapters: input.syllabus.chapters.map((chapter) => ({
			title: chapter.title,
			overview: chapter.overview,
			keyPoints: [...chapter.keyPoints],
			lessons: chapter.lessons.map((lesson) => ({
				title: lesson.title,
				contentOutline: [...lesson.contentOutline],
			})),
		})),
		nextAction: "approve_syllabus",
		referenceSyllabus,
		syllabus: input.syllabus,
		syllabusUpdatedAt: new Date().toISOString(),
	});
}

export function approveDidacticUnitSyllabus(
	didacticUnit: DidacticUnit,
	generationTier?: "cheap" | "premium",
): DidacticUnit {
	if (didacticUnit.status !== "syllabus_ready" || !didacticUnit.syllabus) {
		throw new Error(
			"Syllabus cannot be approved from the current didactic unit state.",
		);
	}

	return withUpdatedAt({
		...didacticUnit,
		status: "syllabus_approved",
		nextAction: "view_didactic_unit",
		generationTier: generationTier ?? didacticUnit.generationTier,
		syllabusApprovedAt: new Date().toISOString(),
	});
}
