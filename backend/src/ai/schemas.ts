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
		};
	});

const questionnaireQuestionIdSchema = z.enum([
	"topic_knowledge_level",
	"related_knowledge_level",
	"learning_goal",
]);

const questionnaireQuestionSchema = z.object({
	id: questionnaireQuestionIdSchema,
	prompt: z.string().min(1),
	type: z.enum(["single_select", "long_text"]),
	options: z
		.array(
			z.object({
				value: z.string().min(1),
				label: z.string().min(1),
			}),
		)
		.nullable(),
});

export const questionnaireSchema = z.object({
	questions: z.array(questionnaireQuestionSchema).length(3),
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
