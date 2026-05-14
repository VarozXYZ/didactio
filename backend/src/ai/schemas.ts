import {z} from "zod";

function resolveApprovedValue(value: {
	approved?: boolean;
	isApproved?: boolean;
	approvalStatus?: string;
}): boolean | undefined {
	if (typeof value.approved === "boolean") {
		return value.approved;
	}

	if (typeof value.isApproved === "boolean") {
		return value.isApproved;
	}

	if (typeof value.approvalStatus === "string") {
		const normalizedStatus = value.approvalStatus.trim().toLowerCase();

		if (
			["approved", "approve", "accepted", "yes", "true"].includes(
				normalizedStatus,
			)
		) {
			return true;
		}

		if (
			["rejected", "reject", "denied", "no", "false"].includes(
				normalizedStatus,
			)
		) {
			return false;
		}
	}

	return undefined;
}

const STYLE_PRESET_IDS = [
	"modern",
	"classic",
	"plain",
] as const;

export const moderationSchema = z
	.object({
		approved: z.boolean().optional(),
		isApproved: z.boolean().optional(),
		approvalStatus: z.string().min(1).optional(),
		notes: z.string().min(1).optional(),
		normalizedTopic: z.string().min(1).optional(),
		normalizedTopicTitle: z.string().min(1).optional(),
		improvedTopicBrief: z.string().min(1),
		reasoningNotes: z.string().min(1),
		folderName: z.string().min(1).optional(),
		folderReasoning: z.string().min(1).optional(),
		stylePreset: z.enum(STYLE_PRESET_IDS).optional(),
		style: z.enum(STYLE_PRESET_IDS).optional(),
	})
	.transform((value, ctx) => {
		const approved = resolveApprovedValue(value);
		const notes = value.notes?.trim() || value.reasoningNotes.trim();
		const normalizedTopic =
			value.normalizedTopic?.trim() || value.normalizedTopicTitle?.trim();

		if (approved === undefined) {
			ctx.addIssue({
				code: "custom",
				message:
					"Moderation result must include approved, isApproved, or a recognizable approvalStatus.",
				path: ["approved"],
			});
			return z.NEVER;
		}

		if (!normalizedTopic) {
			ctx.addIssue({
				code: "custom",
				message:
					"Moderation result must include normalizedTopic or normalizedTopicTitle.",
				path: ["normalizedTopic"],
			});
			return z.NEVER;
		}

		return {
			approved,
			notes,
			normalizedTopic,
			improvedTopicBrief: value.improvedTopicBrief.trim(),
			reasoningNotes: value.reasoningNotes.trim(),
			folderName: value.folderName?.trim(),
			folderReasoning: value.folderReasoning?.trim(),
			stylePreset: value.stylePreset ?? value.style,
		};
	});

export const folderClassificationSchema = z
	.object({
		folderName: z.string().min(1).optional(),
		folder: z.string().min(1).optional(),
		selectedFolder: z.string().min(1).optional(),
		category: z.string().min(1).optional(),
		reasoning: z.string().min(1).optional(),
		reason: z.string().min(1).optional(),
		folderReasoning: z.string().min(1).optional(),
		reasoningNotes: z.string().min(1).optional(),
		stylePreset: z.enum(STYLE_PRESET_IDS).optional(),
		style: z.enum(STYLE_PRESET_IDS).optional(),
	})
	.transform((value, ctx) => {
		const folderName =
			value.folderName?.trim() ||
			value.folder?.trim() ||
			value.selectedFolder?.trim() ||
			value.category?.trim();
		const reasoning =
			value.reasoning?.trim() ||
			value.reason?.trim() ||
			value.folderReasoning?.trim() ||
			value.reasoningNotes?.trim();

		if (!folderName) {
			ctx.addIssue({
				code: "custom",
				message:
					"Folder classification must include folderName, folder, selectedFolder, or category.",
				path: ["folderName"],
			});
			return z.NEVER;
		}

		if (!reasoning) {
			ctx.addIssue({
				code: "custom",
				message:
					"Folder classification must include reasoning, reason, folderReasoning, or reasoningNotes.",
				path: ["reasoning"],
			});
			return z.NEVER;
		}

		return {
			folderName,
			reasoning,
			stylePreset: value.stylePreset ?? value.style,
		};
	});

export const syllabusLessonSchema = z
	.object({
		title: z.string().min(1).optional(),
		lesson_title: z.string().min(1).optional(),
		contentOutline: z.array(z.string().min(1)).min(1).optional(),
		content_outline: z.array(z.string().min(1)).min(1).optional(),
		lesson_outline: z.array(z.string().min(1)).min(1).optional(),
	})
	.transform((value, ctx) => {
		const title = value.title?.trim() || value.lesson_title?.trim();
		const contentOutline =
			value.contentOutline ??
			value.content_outline ??
			value.lesson_outline;

		if (!title) {
			ctx.addIssue({
				code: "custom",
				message: "Syllabus lesson must include title or lesson_title.",
				path: ["title"],
			});
			return z.NEVER;
		}

		if (!contentOutline?.length) {
			ctx.addIssue({
				code: "custom",
				message:
					"Syllabus lesson must include contentOutline, content_outline, or lesson_outline.",
				path: ["contentOutline"],
			});
			return z.NEVER;
		}

		return {
			title,
			contentOutline: contentOutline.map((item) => item.trim()),
		};
	});

export const syllabusModuleSchema = z
	.object({
		title: z.string().min(1).optional(),
		module_title: z.string().min(1).optional(),
		overview: z.string().min(1).optional(),
		lessons: z.array(syllabusLessonSchema).min(1),
	})
	.transform((value, ctx) => {
		const title = value.title?.trim() || value.module_title?.trim();

		if (!title) {
			ctx.addIssue({
				code: "custom",
				message: "Syllabus module must include title or module_title.",
				path: ["title"],
			});
			return z.NEVER;
		}

		const overview =
			value.overview?.trim() ||
			`Covers ${value.lessons.map((lesson) => lesson.title).join("; ")}.`;

		return {
			title,
			overview,
			lessons: value.lessons,
		};
	});

export const syllabusSchema = z
	.object({
		topic: z.string().min(1).optional(),
		title: z.string().min(1),
		keywords: z.string().min(1),
		description: z.string().min(1),
		modules: z.array(syllabusModuleSchema).min(1),
	})
	.transform((value) => ({
		topic: value.topic?.trim(),
		title: value.title.trim(),
		keywords: value.keywords.trim(),
		description: value.description.trim(),
		modules: value.modules,
	}));

const learningActivityContentSchema = z.object({
	questions: z.array(z.any()).optional(),
	prompts: z.array(z.any()).optional(),
	language: z.string().optional(),
	prompt: z.string().optional(),
	starterCode: z.string().optional(),
	expectedOutcome: z.string().optional(),
	testCases: z.array(z.any()).optional(),
	rubric: z.array(z.string()).optional(),
	cards: z.array(z.any()).optional(),
	pairs: z.array(z.any()).optional(),
	items: z.array(z.any()).optional(),
	scenario: z.string().optional(),
	positions: z.array(z.string()).optional(),
	reflectionQuestions: z.array(z.string()).optional(),
	textWithBlanks: z.string().optional(),
	blanks: z.array(z.any()).optional(),
	brief: z.string().optional(),
	steps: z.array(z.string()).optional(),
	deliverable: z.string().optional(),
	html: z.string().optional(),
});

export const learningActivitySchema = z.object({
	title: z.string().min(1),
	instructions: z.string().min(1),
	dedupeSummary: z.string().min(1),
	content: learningActivityContentSchema,
});

export const learningActivityFeedbackSchema = z.object({
	score: z.number().min(0).max(100).optional(),
	feedback: z.string().min(1),
	strengths: z.array(z.string().min(1)).default([]),
	improvements: z.array(z.string().min(1)).default([]),
	questionFeedback: z
		.array(
			z.object({
				id: z.union([z.string(), z.number()]).transform(String),
				simplifiedScore: z
					.enum(["wrong", "Almost there", "Perfect"]),
				expectedAnswer: z.string().min(1),
				improvementReason: z.string().min(1),
				score: z.number().min(0).max(100).optional(),
				feedback: z.string().min(1).optional(),
				strengths: z.array(z.string().min(1)).default([]),
				improvements: z.array(z.string().min(1)).default([]),
			}),
		)
		.default([]),
});
