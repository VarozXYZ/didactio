import { z } from 'zod'

export const moderationSchema = z.object({
    approved: z.boolean(),
    notes: z.string().min(1),
    normalizedTopic: z.string().min(1),
    improvedTopicBrief: z.string().min(1),
    reasoningNotes: z.string().min(1),
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

export const syllabusLessonSchema = z.object({
    title: z.string().min(1),
    contentOutline: z.array(z.string().min(1)).min(1),
})

export const syllabusChapterSchema = z.object({
    title: z.string().min(1),
    overview: z.string().min(1),
    keyPoints: z.array(z.string().min(1)).min(1),
    estimatedDurationMinutes: z.number().int().positive(),
    lessons: z.array(syllabusLessonSchema).min(1),
})

export const syllabusSchema = z.object({
    title: z.string().min(1),
    overview: z.string().min(1),
    learningGoals: z.array(z.string().min(1)).min(1),
    keywords: z.array(z.string().min(1)).min(1),
    estimatedDurationMinutes: z.number().int().positive(),
    chapters: z.array(syllabusChapterSchema).min(1),
})

export const chapterSchema = z.object({
    title: z.string().min(1),
    overview: z.string().min(1),
    content: z.string().min(1),
    keyTakeaways: z.array(z.string().min(1)).min(1),
})
