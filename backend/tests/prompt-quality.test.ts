import { describe, expect, it } from 'vitest'
import {
    buildChapterMarkdownPrompt,
    buildGatewaySystemPrompt,
    buildModerationPrompt,
    resolveTargetChapterCount,
    buildSyllabusMarkdownPrompt,
} from '../src/ai/prompt-builders.js'
import {
    adaptReferenceSyllabusToDidacticUnitSyllabus,
    type DidacticUnitReferenceSyllabus,
} from '../src/didactic-unit/planning.js'

const authoring = {
    language: 'English',
    tone: 'professional' as const,
}

describe('prompt quality helpers', () => {
    it('builds a moderation prompt with the improved brief contract', () => {
        const prompt = buildModerationPrompt({
            topic: 'Python programming',
            level: 'beginner',
            additionalContext: 'Focus on beginners building small useful scripts.',
            folders: [
                {
                    name: 'Computer Science',
                    description: 'Use for units primarily focused on computer science.',
                },
                {
                    name: 'General',
                    description:
                        'Use for broad topics, mixed subjects, or units that do not clearly fit a specialized folder.',
                },
            ],
            authoring,
        })

        expect(prompt).toContain('[Role / Contract]')
        expect(prompt).toContain('improved topic brief')
        expect(prompt).toContain('Python programming')
        expect(prompt).toContain('Tone: professional')
        expect(prompt).toContain('Course level: beginner')
        expect(prompt).toContain('Available folders')
        expect(prompt).toContain('folderName exactly as written')
    })

    it('uses a dedicated folder classification system prompt', () => {
        const prompt = buildGatewaySystemPrompt('folder_classification')

        expect(prompt).toContain('classify educational units')
        expect(prompt).toContain('requested structured object')
    })

    it('builds a syllabus prompt with learner profile and strict structured output instructions', () => {
        const prompt = buildSyllabusMarkdownPrompt({
            topic: 'Python programming',
            level: 'beginner',
            improvedTopicBrief:
                'Create a practical unit that moves from syntax fundamentals to small real-world programs.',
            syllabusPrompt: 'Deterministic syllabus prompt body',
            questionnaireAnswers: [
                { questionId: 'topic_knowledge_level', value: 'basic' },
                { questionId: 'related_knowledge_level', value: 'basic' },
                { questionId: 'learning_goal', value: 'Build beginner confidence.' },
            ],
            authoring,
            depth: 'intermediate',
            length: 'long',
        })

        expect(prompt).toContain('[Learner / Profile Context]')
        expect(prompt).toContain('Improved topic brief')
        expect(prompt).toContain('Declared learner level: beginner')
        expect(prompt).toContain('Requested depth: intermediate')
        expect(prompt).toContain('Requested length: long')
        expect(prompt).toContain('Target module count: 9')
        expect(prompt).toContain('Return a strict structured syllabus object.')
        expect(prompt).toContain('Create exactly 9 modules.')
        expect(prompt).toContain('Use a keywords string, not a keywords array.')
        expect(prompt).toContain('Each module must include lessons with action-oriented content outlines.')
    })

    it('maps unit length to different syllabus chapter counts', () => {
        expect(resolveTargetChapterCount('intro')).toBe(3)
        expect(resolveTargetChapterCount('short')).toBe(6)
        expect(resolveTargetChapterCount('long')).toBe(9)
        expect(resolveTargetChapterCount('textbook')).toBe(12)
    })

    it('builds a chapter prompt with continuity, module planning, and regeneration guidance', () => {
        const prompt = buildChapterMarkdownPrompt({
            topic: 'Python programming',
            level: 'beginner',
            chapterIndex: 1,
            questionnaireAnswers: [
                { questionId: 'topic_knowledge_level', value: 'basic' },
                { questionId: 'related_knowledge_level', value: 'basic' },
                { questionId: 'learning_goal', value: 'Automate small tasks.' },
            ],
            continuitySummaries: ['- Variables introduced\n- Basic syntax covered'],
            additionalContext: 'The learner prefers script-based examples.',
            instruction: 'Use more concrete examples than the previous version.',
            authoring,
            depth: 'technical',
            length: 'textbook',
            syllabus: {
                topic: 'Python programming',
                title: 'Python programming learning path',
                description: 'From basics to practical scripting.',
                keywords: 'python, scripting, automation',
                modules: [
                    {
                        title: 'Foundations',
                        overview: 'Core concepts and syntax.',
                        lessons: [
                            {
                                title: 'Variables',
                                contentOutline: ['Declare values', 'Use expressions'],
                            },
                        ],
                    },
                    {
                        title: 'Control Flow',
                        overview: 'Make programs branch and repeat.',
                        lessons: [
                            {
                                title: 'Conditionals',
                                contentOutline: ['if statements', 'Decision making'],
                            },
                            {
                                title: 'Loops',
                                contentOutline: ['for loops', 'while loops'],
                            },
                        ],
                    },
                    {
                        title: 'Applied Scripts',
                        overview: 'Use the language in practical automations.',
                        lessons: [
                            {
                                title: 'Mini scripts',
                                contentOutline: ['Automate a simple task'],
                            },
                        ],
                    },
                ],
            },
        })

        expect(prompt).toContain('1. Foundations (COMPLETED)')
        expect(prompt).toContain('2. Control Flow (CURRENT MODULE)')
        expect(prompt).toContain('3. Applied Scripts (UPCOMING)')
        expect(prompt).toContain('### Module 1 Concepts:')
        expect(prompt).toContain('Regeneration instruction from the user')
        expect(prompt).toContain('The learner prefers script-based examples.')
        expect(prompt).toContain('Requested depth: technical')
        expect(prompt).toContain('Requested length: textbook')
        expect(prompt).toContain('1. Conditionals')
        expect(prompt).toContain('Do not use generic headings like "Concept Explanation"')
    })

    it('falls back to not provided when questionnaire answers are skipped', () => {
        const syllabusPrompt = buildSyllabusMarkdownPrompt({
            topic: 'The history of the Silk Road',
            level: 'beginner',
            improvedTopicBrief:
                'Create an introductory unit that explains the Silk Road as a network of trade, ideas, and cultural exchange.',
            syllabusPrompt: 'Deterministic syllabus prompt body',
            questionnaireAnswers: [],
            authoring,
            depth: 'basic',
            length: 'short',
        })

        const chapterPrompt = buildChapterMarkdownPrompt({
            topic: 'The history of the Silk Road',
            level: 'beginner',
            chapterIndex: 0,
            questionnaireAnswers: [],
            continuitySummaries: [],
            authoring,
            depth: 'basic',
            length: 'short',
            syllabus: {
                topic: 'The history of the Silk Road',
                title: 'The Silk Road learning path',
                description: 'An introduction to trade routes and cultural exchange.',
                keywords: 'Silk Road, trade, history',
                modules: [
                    {
                        title: 'Origins of the routes',
                        overview: 'How the network emerged and expanded.',
                        lessons: [
                            {
                                title: 'Early exchanges',
                                contentOutline: ['Trade routes', 'Goods and ideas'],
                            },
                        ],
                    },
                ],
            },
        })

        expect(syllabusPrompt).toContain('Topic knowledge: not provided')
        expect(syllabusPrompt).toContain('Related knowledge: not provided')
        expect(syllabusPrompt).toContain('Learning goal: not provided')
        expect(chapterPrompt).toContain('Topic knowledge: not provided')
        expect(chapterPrompt).toContain('Related knowledge: not provided')
        expect(chapterPrompt).toContain('Learning goal: not provided')
    })

    it('adapts the reference syllabus schema into the compatibility syllabus object', () => {
        const referenceSyllabus: DidacticUnitReferenceSyllabus = {
            topic: 'Python programming',
            title: 'Python Programming Learning Path',
            description: 'A practical path from fundamentals to useful scripts.',
            keywords: 'python, scripting, automation',
            modules: [
                {
                    title: 'Foundations',
                    overview: 'Learn the core syntax and vocabulary.',
                    lessons: [
                        {
                            title: 'Variables',
                            contentOutline: ['Declare variables', 'Use expressions'],
                        },
                        {
                            title: 'Data Types',
                            contentOutline: [
                                'Compare strings and numbers',
                                'Convert between values',
                            ],
                        },
                    ],
                },
                {
                    title: 'Control Flow',
                    overview: 'Guide execution with conditions and loops.',
                    lessons: [
                        {
                            title: 'Conditionals',
                            contentOutline: ['Use if statements', 'Compare outcomes'],
                        },
                        {
                            title: 'Loops',
                            contentOutline: ['Iterate through data', 'Repeat safely'],
                        },
                    ],
                },
                {
                    title: 'Applied Scripts',
                    overview: 'Turn the concepts into small useful tools.',
                    lessons: [
                        {
                            title: 'Mini scripts',
                            contentOutline: [
                                'Automate a basic task',
                                'Reflect on tradeoffs',
                            ],
                        },
                    ],
                },
            ],
        }

        const syllabus = adaptReferenceSyllabusToDidacticUnitSyllabus(referenceSyllabus)

        expect(buildGatewaySystemPrompt('syllabus')).toContain('curriculum designer')
        expect(syllabus.keywords).toEqual(['python', 'scripting', 'automation'])
        expect(syllabus.chapters[0].lessons[0].contentOutline).toEqual([
            'Declare variables',
            'Use expressions',
        ])
        expect(syllabus.chapters).toHaveLength(3)
        expect(syllabus.learningGoals.length).toBeGreaterThan(0)
    })
})
