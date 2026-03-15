import { subjectStyles } from './subjectStyles'

const subjectKeywordMap: Array<{ subject: keyof typeof subjectStyles; keywords: string[] }> = [
    {
        subject: 'Computer Science',
        keywords: ['javascript', 'typescript', 'react', 'next.js', 'programming', 'software'],
    },
    {
        subject: 'Physics & Computer Science',
        keywords: ['quantum', 'computing'],
    },
    {
        subject: 'Mathematics',
        keywords: ['math', 'algebra', 'calculus', 'statistics'],
    },
    {
        subject: 'Biology',
        keywords: ['biology', 'cell', 'genetics'],
    },
    {
        subject: 'History',
        keywords: ['history', 'war', 'ancient', 'civilization'],
    },
    {
        subject: 'Literature',
        keywords: ['literature', 'english', 'writing', 'shakespeare'],
    },
    {
        subject: 'Physics',
        keywords: ['physics', 'thermodynamics', 'mechanics'],
    },
    {
        subject: 'Chemistry',
        keywords: ['chemistry', 'chemical'],
    },
    {
        subject: 'Geography',
        keywords: ['geography', 'earth', 'climate'],
    },
]

export function deriveSubjectFromTopic(topic: string): keyof typeof subjectStyles {
    const normalizedTopic = topic.toLowerCase()

    const match = subjectKeywordMap.find(({ keywords }) =>
        keywords.some((keyword) => normalizedTopic.includes(keyword))
    )

    return match?.subject ?? 'Mathematics'
}

export function formatRelativeTimestamp(isoDate: string): string {
    const now = Date.now()
    const value = Date.parse(isoDate)

    if (Number.isNaN(value)) {
        return isoDate
    }

    const diffMinutes = Math.max(0, Math.round((now - value) / 60000))

    if (diffMinutes < 1) return 'just now'
    if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`

    const diffHours = Math.round(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`

    const diffDays = Math.round(diffHours / 24)
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`

    return new Date(isoDate).toLocaleDateString()
}

export function estimateReadingTimeFromText(value: string | null | undefined): string {
    if (!value) {
        return 'Pending'
    }

    const words = value.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length
    const minutes = Math.max(1, Math.round(words / 180))
    return `${minutes} min`
}

export function deriveEffortFromReadingTime(readingTime: string): string {
    const minutes = Number.parseInt(readingTime, 10)

    if (!Number.isInteger(minutes)) {
        return 'Medium'
    }

    if (minutes <= 5) return 'Low'
    if (minutes <= 12) return 'Medium'
    return 'High'
}
