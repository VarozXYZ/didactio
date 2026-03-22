import { toMarkdown } from 'mdast-util-to-markdown'
import { toString } from 'mdast-util-to-string'
import type { RootContent } from 'mdast'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

const markdownParser = unified().use(remarkParse).use(remarkGfm)
const htmlProcessor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)

export type MarkdownPageBlock =
    | {
          type: 'paragraph'
          markdown: string
          text: string
          continued: boolean
      }
    | {
          type: 'markdown'
          markdown: string
      }

const TITLE_STOP_WORDS = new Set([
    'a',
    'an',
    'and',
    'at',
    'by',
    'for',
    'from',
    'in',
    'of',
    'on',
    'or',
    'the',
    'to',
    'with',
])

const TITLE_END_STOP_WORDS = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with'])

function cleanToken(token: string): string {
    return token.replace(/^[`"'([{]+|[`"',.:;!?)}\]]+$/g, '')
}

function isTitleLikeToken(token: string): boolean {
    const cleaned = cleanToken(token)

    if (!cleaned) {
        return false
    }

    const lower = cleaned.toLowerCase()

    if (TITLE_STOP_WORDS.has(lower)) {
        return true
    }

    if (/^[A-Z][a-z0-9/-]*$/.test(cleaned)) {
        return true
    }

    if (/^[A-Z][A-Za-z0-9-]*\.[A-Za-z0-9.-]+$/.test(cleaned)) {
        return false
    }

    return false
}

function repairRunOnHeading(line: string): string {
    const match = line.match(/^(#{1,6})\s+(.+)$/)

    if (!match) {
        return line
    }

    const marker = match[1]
    const body = match[2].trim()

    if (body.length < 50) {
        return line
    }

    const words = body.split(/\s+/)
    let bestSplitIndex = -1
    let bestScore = Number.NEGATIVE_INFINITY

    for (let index = 2; index <= Math.min(6, words.length - 1); index += 1) {
        const prefix = words.slice(0, index)
        const rest = words.slice(index)

        if (rest.join(' ').length < 24) {
            continue
        }

        let score = 0

        prefix.forEach((word) => {
            score += isTitleLikeToken(word) ? 1 : -2
        })

        const lastPrefix = cleanToken(prefix[prefix.length - 1] ?? '').toLowerCase()
        if (TITLE_END_STOP_WORDS.has(lastPrefix)) {
            score -= 1.5
        }

        const firstRest = cleanToken(rest[0] ?? '')
        const secondRest = cleanToken(rest[1] ?? '')

        if (/^[a-z]/.test(firstRest)) {
            score += 2
        } else if (/^[a-z]/.test(secondRest)) {
            score += 1.5
        }

        if (/[.]/.test(prefix.join(' '))) {
            score -= 1
        }

        if (score > bestScore) {
            bestScore = score
            bestSplitIndex = index
        }
    }

    if (bestSplitIndex === -1 || bestScore < 2) {
        return line
    }

    const heading = words.slice(0, bestSplitIndex).join(' ')
    const remainder = words.slice(bestSplitIndex).join(' ')

    return `${marker} ${heading}\n\n${remainder}`
}

function repairAiMarkdown(markdown: string): string {
    return markdown
        .replace(/\*\*([^\n*]+)\n\s*\n([^\n*]+)\*\*/g, '**$1 $2**')
        .replace(/:\s+(1\.\s+)/g, ':\n\n$1')
        .replace(/([.!?])\s+(\d+\.\s+)/g, '$1\n\n$2')
        .split('\n')
        .map((line) => repairRunOnHeading(line))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function htmlToMarkdown(value: string): string {
    const parser = new DOMParser()
    const document = parser.parseFromString(value, 'text/html')
    const blocks = Array.from(document.body.children)

    if (blocks.length === 0) {
        return document.body.textContent?.trim() ?? ''
    }

    return blocks
        .map((element) => {
            const text = element.textContent?.trim() ?? ''

            switch (element.tagName) {
                case 'H1':
                    return text ? `# ${text}` : ''
                case 'H2':
                    return text ? `## ${text}` : ''
                case 'H3':
                    return text ? `### ${text}` : ''
                case 'LI':
                    return text ? `- ${text}` : ''
                case 'UL':
                case 'OL':
                    return Array.from(element.children)
                        .map((child) => {
                            const childText = child.textContent?.trim() ?? ''
                            return childText ? `- ${childText}` : ''
                        })
                        .filter(Boolean)
                        .join('\n')
                default:
                    return text
            }
        })
        .filter(Boolean)
        .join('\n\n')
        .trim()
}

function normalizeTopLevelMarkdown(node: RootContent): string {
    return toMarkdown(node).trim()
}

export function normalizeStoredMarkdown(value: string | null | undefined): string {
    if (!value) {
        return ''
    }

    const trimmedValue = value.trim()

    if (!trimmedValue) {
        return ''
    }

    if (!trimmedValue.includes('<')) {
        return repairAiMarkdown(trimmedValue)
    }

    return repairAiMarkdown(htmlToMarkdown(trimmedValue))
}

export function markdownToHtml(markdown: string): string {
    const normalizedMarkdown = normalizeStoredMarkdown(markdown)

    if (!normalizedMarkdown) {
        return ''
    }

    return String(htmlProcessor.processSync(normalizedMarkdown))
}

export function markdownToPlainText(markdown: string | null | undefined): string {
    const html = markdownToHtml(markdown ?? '')

    if (!html) {
        return ''
    }

    const parser = new DOMParser()
    const document = parser.parseFromString(html, 'text/html')

    return document.body.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

export function extractMarkdownBlocks(markdown: string): MarkdownPageBlock[] {
    const normalizedMarkdown = normalizeStoredMarkdown(markdown)

    if (!normalizedMarkdown) {
        return []
    }

    const tree = markdownParser.parse(normalizedMarkdown)

    const blocks: MarkdownPageBlock[] = []

    tree.children.forEach((node) => {
        const nodeMarkdown = normalizeTopLevelMarkdown(node)

        if (!nodeMarkdown) {
            return
        }

        if (node.type === 'paragraph') {
            blocks.push({
                type: 'paragraph',
                continued: false,
                markdown: nodeMarkdown,
                text: toString(node).replace(/\s+/g, ' ').trim(),
            })
            return
        }

        blocks.push({
            type: 'markdown',
            markdown: nodeMarkdown,
        })
    })

    return blocks
}

export function normalizeMarkdownForStorage(markdown: string): string {
    return markdown.replace(/\u00a0/g, ' ').trim()
}

export function keyTakeawaysToMarkdown(items: string[]): string {
    return items.map((item) => `- ${item}`).join('\n')
}

export function markdownToKeyTakeaways(markdown: string): string[] {
    const normalizedMarkdown = normalizeStoredMarkdown(markdown)

    if (!normalizedMarkdown) {
        return []
    }

    const tree = markdownParser.parse(normalizedMarkdown)
    const takeaways: string[] = []

    tree.children.forEach((node) => {
        if (node.type === 'list') {
            node.children.forEach((item) => {
                const text = toString(item).replace(/\s+/g, ' ').trim()
                if (text) {
                    takeaways.push(text)
                }
            })
            return
        }

        if (node.type === 'paragraph') {
            const lines = normalizeTopLevelMarkdown(node)
                .split('\n')
                .map((line) => line.replace(/^[-*+]\s+/, '').trim())
                .filter(Boolean)

            takeaways.push(...lines)
        }
    })

    return takeaways
}
