import {z} from "zod";

export const LEARNING_ACTIVITY_TYPES = [
	"multiple_choice",
	"short_answer",
	"coding_practice",
	"flashcards",
	"matching",
	"ordering",
	"case_study",
	"debate_reflection",
	"cloze",
	"guided_project",
	"freeform_html",
] as const;

export type LearningActivityType = (typeof LEARNING_ACTIVITY_TYPES)[number];
export type LearningActivityScope =
	| "current_module"
	| "cumulative_until_module";
export type LearningActivityQuality = "silver" | "gold";

export interface LearningActivity {
	id: string;
	ownerId: string;
	didacticUnitId: string;
	chapterIndex: number;
	scope: LearningActivityScope;
	type: LearningActivityType;
	quality: LearningActivityQuality;
	title: string;
	instructions: string;
	content: Record<string, unknown>;
	dedupeSummary: string;
	sourceModuleIndexes: number[];
	feedbackAttemptLimit: number;
	generationRunId?: string;
	createdAt: string;
	updatedAt: string;
}

export interface LearningActivityAttempt {
	id: string;
	activityId: string;
	ownerId: string;
	answers: unknown;
	score?: number;
	feedback: string;
	completedAt: string;
}

export interface LearningActivityProgress {
	activityId: string;
	ownerId: string;
	confirmedAnswers: Record<string, {
		selectedOptionId: string;
		isCorrect: boolean;
		correctOptionId: string;
		explanation: string;
	}>;
	completed: boolean;
	updatedAt: string;
}

export interface LearningActivityCreateInput {
	scope: LearningActivityScope;
	type: LearningActivityType;
	quality: LearningActivityQuality;
}

export const OBJECTIVE_ACTIVITY_TYPES = new Set<LearningActivityType>([
	"multiple_choice",
	"flashcards",
	"matching",
	"ordering",
	"cloze",
]);

const createActivityInputSchema = z.object({
	scope: z.enum(["current_module", "cumulative_until_module"]),
	type: z.enum(LEARNING_ACTIVITY_TYPES),
	quality: z
		.enum(["silver", "gold", "cheap", "premium"])
		.transform((value) =>
			value === "cheap" ? "silver"
			: value === "premium" ? "gold"
			: value,
		),
});

export function parseCreateLearningActivityInput(
	body: unknown,
): LearningActivityCreateInput {
	return createActivityInputSchema.parse(body);
}

function normalizeText(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function normalizeRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value) ?
			(value as Record<string, unknown>)
		:	{};
}

function normalizeArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function createFeedback(score: number, correct: number, total: number): string {
	if (total === 0) {
		return "Answer received.";
	}

	if (score >= 90) {
		return `Great work: ${correct} of ${total} correct.`;
	}

	if (score >= 60) {
		return `Good progress: ${correct} of ${total} correct. Review the missed items and try again.`;
	}

	return `${correct} of ${total} correct. Revisit the activity material and try a new attempt.`;
}

export function gradeObjectiveActivity(input: {
	activity: LearningActivity;
	answers: unknown;
}): {score: number; feedback: string} {
	const content = normalizeRecord(input.activity.content);
	const answers = normalizeRecord(input.answers);
	let total = 0;
	let correct = 0;

	if (input.activity.type === "multiple_choice") {
		for (const question of normalizeArray(content.questions)) {
			const item = normalizeRecord(question);
			const id = normalizeText(item.id);
			const expected = normalizeText(item.correctOptionId);
			if (!id || !expected) {
				continue;
			}
			total += 1;
			if (normalizeText(answers[id]) === expected) {
				correct += 1;
			}
		}
	}

	if (input.activity.type === "matching") {
		for (const pair of normalizeArray(content.pairs)) {
			const item = normalizeRecord(pair);
			const id = normalizeText(item.id);
			const expected = normalizeText(item.right);
			if (!id || !expected) {
				continue;
			}
			total += 1;
			if (
				normalizeText(answers[id]).toLowerCase() ===
				expected.toLowerCase()
			) {
				correct += 1;
			}
		}
	}

	if (input.activity.type === "ordering") {
		const expected = normalizeArray(content.items)
			.map((item) => normalizeRecord(item))
			.sort(
				(left, right) =>
					Number(left.correctOrder ?? 0) - Number(right.correctOrder ?? 0),
			)
			.map((item) => normalizeText(item.id))
			.filter(Boolean);
		const submitted = normalizeArray(answers.order).map(normalizeText);
		total = expected.length;
		correct = expected.filter((id, index) => submitted[index] === id).length;
	}

	if (input.activity.type === "cloze") {
		for (const blank of normalizeArray(content.blanks)) {
			const item = normalizeRecord(blank);
			const id = normalizeText(item.id);
			const expected = normalizeText(item.answer);
			if (!id || !expected) {
				continue;
			}
			total += 1;
			if (
				normalizeText(answers[id]).toLowerCase() ===
				expected.toLowerCase()
			) {
				correct += 1;
			}
		}
	}

	if (input.activity.type === "flashcards") {
		total = normalizeArray(content.cards).length;
		const reviewed = Number(answers.reviewedCount ?? 0);
		correct = Math.max(0, Math.min(total, reviewed));
	}

	const score = total === 0 ? 0 : Math.round((correct / total) * 100);
	return {score, feedback: createFeedback(score, correct, total)};
}
