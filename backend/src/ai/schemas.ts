import { z } from 'zod'

export const moderationSchema = z.object({
    approved: z.boolean(),
    notes: z.string().min(1),
    normalizedTopic: z.string().min(1),
    improvedTopicBrief: z.string().min(1),
    reasoningNotes: z.string().min(1),
    folderName: z.string().min(1).optional(),
    folderReasoning: z.string().min(1).optional(),
})

export const questionnaireSchema = z.object({
    questions: z
        .array(
            z.object({
                id: z.string().min(1),
                prompt: z.string().min(1),
                type: z.string().min(1),
                options: z
                    .array(
                        z.object({
                            value: z.string().min(1),
                            label: z.string().min(1),
                        })
                    )
                    .nullish(),
            })
        )
        .min(1),
})

export const folderClassificationSchema = z.object({
    folderName: z.string().min(1),
    reasoning: z.string().min(1),
})

export const syllabusLessonSchema = z.object({
    title: z.string().min(1),
    contentOutline: z.array(z.string().min(1)).min(1),
})

export const syllabusModuleSchema = z.object({
    title: z.string().min(1),
    overview: z.string().min(1),
    lessons: z.array(syllabusLessonSchema).min(1),
})

export const syllabusSchema = z.object({
    topic: z.string().min(1),
    title: z.string().min(1),
    keywords: z.string().min(1),
    description: z.string().min(1),
    modules: z.array(syllabusModuleSchema).min(1),
})
