import { describe, expect, it } from 'vitest'
import {
    buildChapterMarkdownPrompt,
    buildModerationPrompt,
    buildSyllabusMarkdownPrompt,
} from '../src/ai/prompt-builders.js'
import { parseSyllabusMarkdown } from '../src/ai/markdown-parsers.js'

const authoring = {
    language: 'English',
    tone: 'professional' as const,
}

describe('prompt quality helpers', () => {
    it('builds a moderation prompt with the improved brief contract', () => {
        const prompt = buildModerationPrompt({
            topic: 'Python programming',
            authoring,
        })

        expect(prompt).toContain('[Role / Contract]')
        expect(prompt).toContain('improved topic brief')
        expect(prompt).toContain('Python programming')
        expect(prompt).toContain('Tone: professional')
    })

    it('builds a syllabus prompt with learner profile and strict markdown structure', () => {
        const prompt = buildSyllabusMarkdownPrompt({
            topic: 'Python programming',
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
        expect(prompt).toContain('Requested depth: intermediate')
        expect(prompt).toContain('Requested length: long')
        expect(prompt).toContain('## Keywords')
        expect(prompt).toContain('#### Lessons')
        expect(prompt).toContain('##### 1. <Lesson Title>')
    })

    it('builds a chapter prompt with continuity, lesson plan, and regeneration guidance', () => {
        const prompt = buildChapterMarkdownPrompt({
            topic: 'Python programming',
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
                title: 'Python programming learning path',
                overview: 'From basics to practical scripting.',
                learningGoals: ['Understand syntax', 'Write scripts', 'Practice debugging'],
                keywords: ['python', 'scripting', 'automation'],
                estimatedDurationMinutes: 180,
                chapters: [
                    {
                        title: 'Foundations',
                        overview: 'Core concepts and syntax.',
                        keyPoints: ['Variables', 'Types', 'Expressions'],
                        estimatedDurationMinutes: 60,
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
                        keyPoints: ['Conditionals', 'Loops', 'Branching'],
                        estimatedDurationMinutes: 60,
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
                        keyPoints: ['Files', 'Utilities', 'Examples'],
                        estimatedDurationMinutes: 60,
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

        expect(prompt).toContain('1. Foundations (PREVIOUS)')
        expect(prompt).toContain('2. Control Flow (CURRENT CHAPTER)')
        expect(prompt).toContain('3. Applied Scripts (UPCOMING)')
        expect(prompt).toContain('Chapter 1 continuity summary')
        expect(prompt).toContain('Regeneration instruction from the user')
        expect(prompt).toContain('The learner prefers script-based examples.')
        expect(prompt).toContain('Requested depth: technical')
        expect(prompt).toContain('Requested length: textbook')
        expect(prompt).toContain('Lesson plan:')
        expect(prompt).toContain('1. Conditionals')
    })

    it('parses richer syllabus markdown into the strict syllabus object', () => {
        const syllabus = parseSyllabusMarkdown([
            '# Python Programming Learning Path',
            '## Overview',
            'A practical path from fundamentals to useful scripts.',
            '## Learning Goals',
            '- Understand Python syntax',
            '- Build working scripts',
            '- Practice debugging',
            '## Keywords',
            '- python',
            '- scripting',
            '- automation',
            '## Estimated Duration',
            '180',
            '## Chapters',
            '### 1. Foundations',
            '#### Overview',
            'Learn the core syntax and vocabulary.',
            '#### Estimated Duration',
            '60',
            '#### Key Points',
            '- Variables',
            '- Types',
            '- Expressions',
            '#### Lessons',
            '##### 1. Variables',
            '- Declare variables',
            '- Use expressions',
            '##### 2. Data Types',
            '- Compare strings and numbers',
            '- Convert between values',
            '### 2. Control Flow',
            '#### Overview',
            'Guide execution with conditions and loops.',
            '#### Estimated Duration',
            '60',
            '#### Key Points',
            '- Conditionals',
            '- Loops',
            '- Branching',
            '#### Lessons',
            '##### 1. Conditionals',
            '- Use if statements',
            '- Compare outcomes',
            '##### 2. Loops',
            '- Iterate through data',
            '- Repeat safely',
            '### 3. Applied Scripts',
            '#### Overview',
            'Turn the concepts into small useful tools.',
            '#### Estimated Duration',
            '60',
            '#### Key Points',
            '- Files',
            '- Utilities',
            '- Examples',
            '#### Lessons',
            '##### 1. Mini scripts',
            '- Automate a basic task',
            '- Reflect on tradeoffs',
        ].join('\n'))

        expect(syllabus.keywords).toEqual(['python', 'scripting', 'automation'])
        expect(syllabus.estimatedDurationMinutes).toBe(180)
        expect(syllabus.chapters[0].estimatedDurationMinutes).toBe(60)
        expect(syllabus.chapters[0].lessons[0].contentOutline).toEqual([
            'Declare variables',
            'Use expressions',
        ])
    })
})
