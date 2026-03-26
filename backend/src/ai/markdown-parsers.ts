import type { DidacticUnitGeneratedChapter } from '../didactic-unit/didactic-unit-chapter.js'
import type { DidacticUnitSyllabus } from '../didactic-unit/planning.js'

function cleanHeading(value: string): string {
    return value.replace(/^#+\s*/, '').trim()
}

function cleanLine(value: string): string {
    return value.trim()
}

function stripNumericPrefix(value: string): string {
    return value.replace(/^\d+[\).\-\s]+/, '').trim()
}

function splitSections(
    markdown: string,
    headingDepth: number
): Array<{ heading: string; body: string }> {
    const lines = markdown.split(/\r?\n/)
    const sections: Array<{ heading: string; body: string }> = []
    let currentHeading = ''
    let currentBody: string[] = []
    const prefix = '#'.repeat(headingDepth)

    const pushCurrent = () => {
        if (!currentHeading) {
            return
        }

        sections.push({
            heading: currentHeading,
            body: currentBody.join('\n').trim(),
        })
    }

    for (const line of lines) {
        if (line.startsWith(`${prefix} `)) {
            pushCurrent()
            currentHeading = cleanHeading(line)
            currentBody = []
            continue
        }

        currentBody.push(line)
    }

    pushCurrent()
    return sections
}

function parseBulletList(block: string): string[] {
    return block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^[-*]\s+/.test(line))
        .map((line) => line.replace(/^[-*]\s+/, '').trim())
        .filter(Boolean)
}

function parseOrderedHeading(value: string): string {
    return stripNumericPrefix(cleanHeading(value))
}

function parseNumericBlock(block: string, fieldName: string): number {
    const joined = block
        .split(/\r?\n/)
        .map(cleanLine)
        .filter(Boolean)
        .join(' ')
    const matched = joined.match(/\d+/)

    if (!matched) {
        throw new Error(`${fieldName} is missing a numeric value.`)
    }

    return Number.parseInt(matched[0], 10)
}

function parseParagraph(block: string): string {
    return block
        .split(/\r?\n/)
        .map(cleanLine)
        .filter(Boolean)
        .join(' ')
        .trim()
}

export function parseSyllabusMarkdown(markdown: string): DidacticUnitSyllabus {
    const trimmed = markdown.trim()
    if (!trimmed) {
        throw new Error('Generated syllabus markdown is empty.')
    }

    const topSections = splitSections(trimmed, 1)
    const titleSection = topSections[0]

    if (!titleSection) {
        throw new Error('Generated syllabus markdown is missing a title heading.')
    }

    const secondLevelSections = splitSections(titleSection.body, 2)
    const overviewSection = secondLevelSections.find((section) => /overview/i.test(section.heading))
    const learningGoalsSection = secondLevelSections.find((section) =>
        /learning goals?/i.test(section.heading)
    )
    const keywordsSection = secondLevelSections.find((section) => /keywords?/i.test(section.heading))
    const estimatedDurationSection = secondLevelSections.find((section) =>
        /estimated duration/i.test(section.heading)
    )
    const chaptersSection = secondLevelSections.find((section) => /chapters?/i.test(section.heading))

    if (
        !overviewSection ||
        !learningGoalsSection ||
        !keywordsSection ||
        !estimatedDurationSection ||
        !chaptersSection
    ) {
        throw new Error(
            'Generated syllabus markdown is missing overview, learning goals, keywords, estimated duration, or chapters.'
        )
    }

    const chapters = splitSections(chaptersSection.body, 3).map((section) => {
        const innerSections = splitSections(section.body, 4)
        const chapterOverviewSection = innerSections.find((entry) => /overview/i.test(entry.heading))
        const estimatedDurationEntry = innerSections.find((entry) =>
            /estimated duration/i.test(entry.heading)
        )
        const keyPointsSection = innerSections.find((entry) => /key points?/i.test(entry.heading))
        const lessonsSection = innerSections.find((entry) => /lessons?/i.test(entry.heading))

        if (
            !chapterOverviewSection ||
            !estimatedDurationEntry ||
            !keyPointsSection ||
            !lessonsSection
        ) {
            throw new Error(`Generated syllabus chapter "${section.heading}" is incomplete.`)
        }

        const lessons = splitSections(lessonsSection.body, 5).map((lessonSection) => ({
            title: parseOrderedHeading(lessonSection.heading),
            contentOutline: parseBulletList(lessonSection.body),
        }))

        if (lessons.length === 0) {
            throw new Error(`Generated syllabus chapter "${section.heading}" is missing lessons.`)
        }

        return {
            title: stripNumericPrefix(section.heading),
            overview: parseParagraph(chapterOverviewSection.body),
            keyPoints: parseBulletList(keyPointsSection.body),
            estimatedDurationMinutes: parseNumericBlock(
                estimatedDurationEntry.body,
                `Generated syllabus chapter "${section.heading}" estimated duration`
            ),
            lessons,
        }
    })

    if (chapters.length === 0) {
        throw new Error('Generated syllabus markdown did not include any chapters.')
    }

    return {
        title: cleanHeading(titleSection.heading),
        overview: parseParagraph(overviewSection.body),
        learningGoals: parseBulletList(learningGoalsSection.body),
        keywords: parseBulletList(keywordsSection.body),
        estimatedDurationMinutes: parseNumericBlock(
            estimatedDurationSection.body,
            'Generated syllabus estimated duration'
        ),
        chapters,
    }
}

export function parseChapterMarkdown(
    markdown: string,
    chapterIndex: number
): Omit<DidacticUnitGeneratedChapter, 'generatedAt' | 'updatedAt' | 'chapterIndex'> {
    const trimmed = markdown.trim()
    if (!trimmed) {
        throw new Error('Generated chapter markdown is empty.')
    }

    const topSections = splitSections(trimmed, 1)
    const titleSection = topSections[0]

    if (!titleSection) {
        throw new Error('Generated chapter markdown is missing a title heading.')
    }

    const secondLevelSections = splitSections(titleSection.body, 2)
    const overviewSection = secondLevelSections.find((section) => /overview/i.test(section.heading))
    const contentSection = secondLevelSections.find((section) => /lesson|content/i.test(section.heading))
    const keyTakeawaysSection = secondLevelSections.find((section) =>
        /key takeaways?/i.test(section.heading)
    )

    if (!overviewSection || !contentSection || !keyTakeawaysSection) {
        throw new Error(
            `Generated chapter markdown for chapter ${chapterIndex + 1} is missing overview, content, or key takeaways.`
        )
    }

    return {
        title: cleanHeading(titleSection.heading),
        overview: parseParagraph(overviewSection.body),
        content: contentSection.body.trim(),
        keyTakeaways: parseBulletList(keyTakeawaysSection.body),
    }
}
