import { z } from 'zod'

function resolveApprovedValue(value: {
    approved?: boolean
    isApproved?: boolean
    approvalStatus?: string
}): boolean | undefined {
    if (typeof value.approved === 'boolean') {
        return value.approved
    }

    if (typeof value.isApproved === 'boolean') {
        return value.isApproved
    }

    if (typeof value.approvalStatus === 'string') {
        const normalizedStatus = value.approvalStatus.trim().toLowerCase()

        if (['approved', 'approve', 'accepted', 'yes', 'true'].includes(normalizedStatus)) {
            return true
        }

        if (['rejected', 'reject', 'denied', 'no', 'false'].includes(normalizedStatus)) {
            return false
        }
    }

    return undefined
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
        const approved = resolveApprovedValue(value)
        const notes = value.notes?.trim() || value.reasoningNotes.trim()
        const normalizedTopic = value.normalizedTopic?.trim() || value.normalizedTopicTitle?.trim()

        if (approved === undefined) {
            ctx.addIssue({
                code: 'custom',
                message:
                    'Moderation result must include approved, isApproved, or a recognizable approvalStatus.',
                path: ['approved'],
            })
            return z.NEVER
        }

        if (!normalizedTopic) {
            ctx.addIssue({
                code: 'custom',
                message:
                    'Moderation result must include normalizedTopic or normalizedTopicTitle.',
                path: ['normalizedTopic'],
            })
            return z.NEVER
        }

        return {
            approved,
            notes,
            normalizedTopic,
            improvedTopicBrief: value.improvedTopicBrief.trim(),
            reasoningNotes: value.reasoningNotes.trim(),
            folderName: value.folderName?.trim(),
            folderReasoning: value.folderReasoning?.trim(),
        }
    })

const questionnaireQuestionSchema = z
    .object({
        id: z.string().min(1).optional(),
        prompt: z.string().min(1).optional(),
        question: z.string().min(1).optional(),
        type: z.string().min(1),
        options: z
            .array(
                z.union([
                    z.string().min(1),
                    z.object({
                        value: z.string().min(1),
                        label: z.string().min(1),
                    }),
                ])
            )
            .nullish(),
    })
    .transform((value, ctx) => {
        const prompt = value.prompt?.trim() || value.question?.trim()

        if (!prompt) {
            ctx.addIssue({
                code: 'custom',
                message: 'Questionnaire question must include prompt or question.',
                path: ['prompt'],
            })
            return z.NEVER
        }

        return {
            id: value.id?.trim(),
            prompt,
            type: value.type.trim(),
            options: value.options?.map((option) =>
                typeof option === 'string'
                    ? {
                          value: option.trim(),
                          label: option.trim(),
                      }
                    : {
                          value: option.value.trim(),
                          label: option.label.trim(),
                      }
            ),
        }
    })

export const questionnaireSchema = z
    .object({
        questions: z.array(questionnaireQuestionSchema).min(1).optional(),
        topic_knowledge_level: questionnaireQuestionSchema.optional(),
        related_knowledge_level: questionnaireQuestionSchema.optional(),
        learning_goal: questionnaireQuestionSchema.optional(),
    })
    .transform((value, ctx) => {
        if (value.questions?.length) {
            const normalizedQuestions = value.questions.map((question) => {
                if (!question.id) {
                    ctx.addIssue({
                        code: 'custom',
                        message: 'Each questionnaire question in the questions array must include an id.',
                        path: ['questions'],
                    })
                    return z.NEVER
                }

                return {
                    id: question.id,
                    prompt: question.prompt,
                    type: question.type,
                    options: question.options ?? null,
                }
            })

            if (normalizedQuestions.some((question) => question === z.NEVER)) {
                return z.NEVER
            }

            return { questions: normalizedQuestions }
        }

        const orderedEntries = [
            ['topic_knowledge_level', value.topic_knowledge_level],
            ['related_knowledge_level', value.related_knowledge_level],
            ['learning_goal', value.learning_goal],
        ] as const

        const questions = orderedEntries.flatMap(([id, question]) =>
            question
                ? [
                      {
                          id,
                          prompt: question.prompt,
                          type: question.type,
                          options: question.options ?? null,
                      },
                  ]
                : []
        )

        if (questions.length === 0) {
            ctx.addIssue({
                code: 'custom',
                message: 'Questionnaire result must include a questions array or canonical keyed questions.',
                path: ['questions'],
            })
            return z.NEVER
        }

        return { questions }
    })

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
            value.category?.trim()
        const reasoning =
            value.reasoning?.trim() ||
            value.reason?.trim() ||
            value.folderReasoning?.trim() ||
            value.reasoningNotes?.trim()

        if (!folderName) {
            ctx.addIssue({
                code: 'custom',
                message:
                    'Folder classification must include folderName, folder, selectedFolder, or category.',
                path: ['folderName'],
            })
            return z.NEVER
        }

        if (!reasoning) {
            ctx.addIssue({
                code: 'custom',
                message:
                    'Folder classification must include reasoning, reason, folderReasoning, or reasoningNotes.',
                path: ['reasoning'],
            })
            return z.NEVER
        }

        return {
            folderName,
            reasoning,
        }
    })

export const syllabusLessonSchema = z
    .object({
        title: z.string().min(1).optional(),
        lesson_title: z.string().min(1).optional(),
        contentOutline: z.array(z.string().min(1)).min(1).optional(),
        content_outline: z.array(z.string().min(1)).min(1).optional(),
        lesson_outline: z.array(z.string().min(1)).min(1).optional(),
    })
    .transform((value, ctx) => {
        const title = value.title?.trim() || value.lesson_title?.trim()
        const contentOutline =
            value.contentOutline ?? value.content_outline ?? value.lesson_outline

        if (!title) {
            ctx.addIssue({
                code: 'custom',
                message: 'Syllabus lesson must include title or lesson_title.',
                path: ['title'],
            })
            return z.NEVER
        }

        if (!contentOutline?.length) {
            ctx.addIssue({
                code: 'custom',
                message:
                    'Syllabus lesson must include contentOutline, content_outline, or lesson_outline.',
                path: ['contentOutline'],
            })
            return z.NEVER
        }

        return {
            title,
            contentOutline: contentOutline.map((item) => item.trim()),
        }
    })

export const syllabusModuleSchema = z
    .object({
        title: z.string().min(1).optional(),
        module_title: z.string().min(1).optional(),
        overview: z.string().min(1).optional(),
        lessons: z.array(syllabusLessonSchema).min(1),
    })
    .transform((value, ctx) => {
        const title = value.title?.trim() || value.module_title?.trim()

        if (!title) {
            ctx.addIssue({
                code: 'custom',
                message: 'Syllabus module must include title or module_title.',
                path: ['title'],
            })
            return z.NEVER
        }

        const overview =
            value.overview?.trim() ||
            `Covers ${value.lessons.map((lesson) => lesson.title).join('; ')}.`

        return {
            title,
            overview,
            lessons: value.lessons,
        }
    })

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
    }))
