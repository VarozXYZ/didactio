import { describe, expect, it } from 'vitest'
import {
    folderClassificationSchema,
    moderationSchema,
    questionnaireSchema,
    syllabusSchema,
} from '../src/ai/schemas.js'

describe('moderation schema', () => {
    it('accepts the canonical moderation result shape', () => {
        const parsed = moderationSchema.parse({
            approved: true,
            notes: 'Approved for generation.',
            normalizedTopic: 'Graphic Design for Beginners',
            improvedTopicBrief: 'A practical introduction to graphic design for beginners.',
            reasoningNotes: 'The topic is educational and safe.',
            folderName: 'General',
            folderReasoning: 'Broad creative topic.',
        })

        expect(parsed).toEqual({
            approved: true,
            notes: 'Approved for generation.',
            normalizedTopic: 'Graphic Design for Beginners',
            improvedTopicBrief: 'A practical introduction to graphic design for beginners.',
            reasoningNotes: 'The topic is educational and safe.',
            folderName: 'General',
            folderReasoning: 'Broad creative topic.',
        })
    })

    it('normalizes known gateway moderation field aliases', () => {
        const parsed = moderationSchema.parse({
            isApproved: true,
            normalizedTopicTitle: 'Introduction to Graphic Design Fundamentals',
            improvedTopicBrief:
                'This beginner-level course introduces the core principles of graphic design.',
            reasoningNotes:
                'The original request is safe and educational, so it was approved with clearer structure.',
            folderName: 'General',
            folderReasoning: 'Broad interdisciplinary creative topic.',
        })

        expect(parsed).toEqual({
            approved: true,
            notes:
                'The original request is safe and educational, so it was approved with clearer structure.',
            normalizedTopic:
                'Introduction to Graphic Design Fundamentals',
            improvedTopicBrief:
                'This beginner-level course introduces the core principles of graphic design.',
            reasoningNotes:
                'The original request is safe and educational, so it was approved with clearer structure.',
            folderName: 'General',
            folderReasoning: 'Broad interdisciplinary creative topic.',
        })
    })

    it('maps approvalStatus strings into the canonical approved boolean', () => {
        const parsed = moderationSchema.parse({
            approvalStatus: 'Approved',
            normalizedTopicTitle: 'Fundamentals of Graphic Design',
            improvedTopicBrief:
                'A foundational introduction to graphic design tailored for absolute beginners.',
            reasoningNotes:
                'The request was approved and refined to create a clearer beginner path.',
        })

        expect(parsed.approved).toBe(true)
        expect(parsed.normalizedTopic).toBe('Fundamentals of Graphic Design')
        expect(parsed.notes).toBe(
            'The request was approved and refined to create a clearer beginner path.'
        )
    })
})

describe('questionnaire schema', () => {
    it('accepts the canonical questionnaire array shape', () => {
        const parsed = questionnaireSchema.parse({
            questions: [
                {
                    id: 'topic_knowledge_level',
                    prompt: 'What is your current knowledge level?',
                    type: 'single_select',
                    options: [
                        { value: 'none', label: 'No prior knowledge' },
                        { value: 'basic', label: 'Basic understanding' },
                    ],
                },
                {
                    id: 'related_knowledge_level',
                    prompt: 'How comfortable are you with related concepts?',
                    type: 'single_select',
                    options: [
                        { value: 'none', label: 'No prior knowledge' },
                        { value: 'basic', label: 'Basic understanding' },
                    ],
                },
                {
                    id: 'learning_goal',
                    prompt: 'What do you want to achieve?',
                    type: 'long_text',
                },
            ],
        })

        expect(parsed.questions).toHaveLength(3)
        expect(parsed.questions[0]?.id).toBe('topic_knowledge_level')
        expect(parsed.questions[2]?.id).toBe('learning_goal')
    })

    it('normalizes keyed questionnaire objects from the gateway', () => {
        const parsed = questionnaireSchema.parse({
            topic_knowledge_level: {
                question: 'How much do you already know about graphic design?',
                type: 'single_select',
                options: [
                    'I am a complete beginner.',
                    'I have a little experience.',
                    'I know some basics already.',
                ],
            },
            related_knowledge_level: {
                question: 'Do you have experience with related areas?',
                type: 'single_select',
                options: [
                    'None of these.',
                    'Some art experience.',
                    'Some digital tool experience.',
                ],
            },
            learning_goal: {
                question: 'What do you hope to achieve by the end of the course?',
                type: 'long_text',
            },
        })

        expect(parsed.questions.map((question) => question.id)).toEqual([
            'topic_knowledge_level',
            'related_knowledge_level',
            'learning_goal',
        ])
        expect(parsed.questions[0]?.prompt).toBe('How much do you already know about graphic design?')
        expect(parsed.questions[0]?.options).toEqual([
            {
                value: 'I am a complete beginner.',
                label: 'I am a complete beginner.',
            },
            {
                value: 'I have a little experience.',
                label: 'I have a little experience.',
            },
            {
                value: 'I know some basics already.',
                label: 'I know some basics already.',
            },
        ])
    })
})

describe('folder classification schema', () => {
    it('accepts the canonical folder classification shape', () => {
        const parsed = folderClassificationSchema.parse({
            folderName: 'General',
            reasoning: 'The topic is broad and does not fit a specialized folder.',
        })

        expect(parsed).toEqual({
            folderName: 'General',
            reasoning: 'The topic is broad and does not fit a specialized folder.',
        })
    })

    it('normalizes gemma-style folder classification aliases', () => {
        const parsed = folderClassificationSchema.parse({
            category: 'Computer Science',
            reason: 'The request is primarily about software and programming concepts.',
        })

        expect(parsed).toEqual({
            folderName: 'Computer Science',
            reasoning: 'The request is primarily about software and programming concepts.',
        })
    })
})

describe('syllabus schema', () => {
    it('accepts the canonical syllabus shape', () => {
        const parsed = syllabusSchema.parse({
            topic: 'Introduction to graphic design principles',
            title: 'Introduction to graphic design principles',
            description: 'A beginner course on core design ideas.',
            keywords: 'graphic design, composition, color',
            modules: [
                {
                    title: 'Foundations of visual language',
                    overview: 'Learn the core building blocks.',
                    lessons: [
                        {
                            title: 'Lines and shapes',
                            contentOutline: ['Identify line types', 'Use shapes intentionally'],
                        },
                    ],
                },
            ],
        })

        expect(parsed.topic).toBe('Introduction to graphic design principles')
        expect(parsed.modules[0]?.title).toBe('Foundations of visual language')
        expect(parsed.modules[0]?.lessons[0]?.contentOutline).toEqual([
            'Identify line types',
            'Use shapes intentionally',
        ])
    })

    it('normalizes gemma-style syllabus aliases', () => {
        const parsed = syllabusSchema.parse({
            title: 'Introduction to graphic design principles',
            description:
                'A technical foundation course for beginners that builds from visual elements to composition.',
            keywords: 'graphic design, composition, color theory',
            modules: [
                {
                    module_title: 'The building blocks of visual language',
                    lessons: [
                        {
                            lesson_title: 'Deconstructing line and shape',
                            content_outline: [
                                'Defining geometric vs. organic shapes',
                                'Using positive and negative space to define form',
                            ],
                        },
                        {
                            lesson_title: 'Color theory and texture application',
                            lesson_outline: [
                                'Understanding hue, saturation, and value',
                                'Using texture to add visual depth',
                            ],
                        },
                    ],
                },
            ],
        })

        expect(parsed.topic).toBeUndefined()
        expect(parsed.modules[0]?.title).toBe('The building blocks of visual language')
        expect(parsed.modules[0]?.overview).toContain('Deconstructing line and shape')
        expect(parsed.modules[0]?.lessons[0]?.title).toBe('Deconstructing line and shape')
        expect(parsed.modules[0]?.lessons[0]?.contentOutline).toEqual([
            'Defining geometric vs. organic shapes',
            'Using positive and negative space to define form',
        ])
        expect(parsed.modules[0]?.lessons[1]?.contentOutline).toEqual([
            'Understanding hue, saturation, and value',
            'Using texture to add visual depth',
        ])
    })
})
