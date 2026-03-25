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
    const chaptersSection = secondLevelSections.find((section) => /chapters?/i.test(section.heading))

    if (!overviewSection || !learningGoalsSection || !chaptersSection) {
        throw new Error('Generated syllabus markdown is missing overview, learning goals, or chapters.')
    }

    const chapters = splitSections(chaptersSection.body, 3).map((section) => {
        const innerSections = splitSections(section.body, 4)
        const chapterOverviewSection = innerSections.find((entry) => /overview/i.test(entry.heading))
        const keyPointsSection = innerSections.find((entry) => /key points?/i.test(entry.heading))

        if (!chapterOverviewSection || !keyPointsSection) {
            throw new Error(`Generated syllabus chapter "${section.heading}" is incomplete.`)
        }

        return {
            title: stripNumericPrefix(section.heading),
            overview: parseParagraph(chapterOverviewSection.body),
            keyPoints: parseBulletList(keyPointsSection.body),
        }
    })

    if (chapters.length === 0) {
        throw new Error('Generated syllabus markdown did not include any chapters.')
    }

    return {
        title: cleanHeading(titleSection.heading),
        overview: parseParagraph(overviewSection.body),
        learningGoals: parseBulletList(learningGoalsSection.body),
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
