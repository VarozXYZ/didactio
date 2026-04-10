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

function promoteStandaloneNumberedHeading(
    line: string,
    previousLine: string | undefined,
    nextLine: string | undefined
): string {
    const trimmedLine = line.trim()

    if (!trimmedLine || /^#{1,6}\s/.test(trimmedLine)) {
        return line
    }

    const match = trimmedLine.match(/^(\d+(?:\.\d+)+)\.?\s+(.+)$/)
    if (!match) {
        return line
    }

    const body = match[2].trim()
    if (
        body.length < 4 ||
        body.length > 90 ||
        /[.!?]$/.test(body)
    ) {
        return line
    }

    const previousTrimmed = previousLine?.trim() ?? ''
    const nextTrimmed = nextLine?.trim() ?? ''

    if (
        previousTrimmed &&
        !/[.!?:]$/.test(previousTrimmed) &&
        !/^#{1,6}\s/.test(previousTrimmed)
    ) {
        return line
    }

    if (!nextTrimmed || /^(?:[-*]\s|\d+\.\s)/.test(nextTrimmed)) {
        return line
    }

    const level = Math.min(6, match[1].split('.').length)
    return `${'#'.repeat(level)} ${trimmedLine}`
}

function repairAiMarkdown(markdown: string): string {
    const repairedMarkdown = markdown
        .replace(/\*\*([^\n*]+)\n\s*\n([^\n*]+)\*\*/g, '**$1 $2**')
        .replace(/:\s+(1\.\s+)/g, ':\n\n$1')
        .replace(/([.!?])\s+(\d+\.\s+)/g, '$1\n\n$2')
    const repairedLines = repairedMarkdown.split('\n')

    return repairedLines
        .map((line, index, lines) =>
            promoteStandaloneNumberedHeading(
                repairRunOnHeading(line),
                lines[index - 1],
                lines[index + 1]
            )
        )
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function renumberMarkdownHeadings(markdown: string): string {
    const lines = markdown.split('\n')
    let activeFenceMarker: '```' | '~~~' | null = null
    let minimumHeadingDepth: number | null = null

    for (const line of lines) {
        const trimmedLine = line.trimStart()

        if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~')) {
            const fenceMarker = trimmedLine.startsWith('```') ? '```' : '~~~'
            activeFenceMarker =
                activeFenceMarker === fenceMarker
                    ? null
                    : activeFenceMarker === null
                      ? fenceMarker
                      : activeFenceMarker
        }

        if (activeFenceMarker !== null) {
            continue
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
        if (!headingMatch) {
            continue
        }

        const depth = headingMatch[1].length
        minimumHeadingDepth =
            minimumHeadingDepth === null ? depth : Math.min(minimumHeadingDepth, depth)
    }

    if (minimumHeadingDepth === null) {
        return markdown
    }

    activeFenceMarker = null
    const headingCounters = [0, 0, 0, 0, 0, 0]

    return lines
        .map((line) => {
            const trimmedLine = line.trimStart()

            if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~')) {
                const fenceMarker = trimmedLine.startsWith('```') ? '```' : '~~~'
                activeFenceMarker =
                    activeFenceMarker === fenceMarker
                        ? null
                        : activeFenceMarker === null
                          ? fenceMarker
                          : activeFenceMarker
                return line
            }

            if (activeFenceMarker !== null) {
                return line
            }

            const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
            if (!headingMatch) {
                return line
            }

            const hashes = headingMatch[1]
            const body = headingMatch[2]
                .replace(/^\d+(?:\.\d+)*\.\s+/, '')
                .trim()

            const normalizedLevel = Math.max(
                1,
                Math.min(6, hashes.length - minimumHeadingDepth + 1)
            )

            headingCounters[normalizedLevel - 1] += 1
            for (let index = normalizedLevel; index < headingCounters.length; index += 1) {
                headingCounters[index] = 0
            }

            const prefix = headingCounters.slice(0, normalizedLevel).join('.')
            return `${hashes} ${prefix}. ${body}`
        })
        .join('\n')
}

function collapseWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
}

function escapeMarkdownText(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/\|/g, '\\|')
}

function escapeInlineCode(value: string): string {
    return value.replace(/`/g, '\\`')
}

function serializeInlineNode(node: ChildNode): string {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ?? ''
    }

    if (!(node instanceof HTMLElement)) {
        return ''
    }

    const content = serializeInlineChildren(node)

    switch (node.tagName) {
        case 'STRONG':
        case 'B':
            return content ? `**${content}**` : ''
        case 'EM':
        case 'I':
            return content ? `*${content}*` : ''
        case 'CODE':
            return node.closest('pre')
                ? node.textContent ?? ''
                : `\`${escapeInlineCode(content)}\``
        case 'A': {
            const href = node.getAttribute('href')
            if (!href) {
                return content
            }

            return `[${content || href}](${href})`
        }
        case 'BR':
            return '\n'
        default:
            return content
    }
}

function serializeInlineChildren(element: ParentNode): string {
    return Array.from(element.childNodes)
        .map((child) => serializeInlineNode(child))
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
}

function serializeListElement(
    element: HTMLElement,
    depth = 0
): string {
    const isOrdered = element.tagName === 'OL'
    const items = Array.from(element.children).filter(
        (child): child is HTMLLIElement => child instanceof HTMLLIElement
    )

    return items
        .map((item, index) => {
            const prefix = isOrdered ? `${index + 1}. ` : '- '
            const indent = '  '.repeat(depth)
            const inlineParts: string[] = []
            const nestedBlocks: string[] = []

            Array.from(item.childNodes).forEach((child) => {
                if (
                    child instanceof HTMLElement &&
                    (child.tagName === 'UL' || child.tagName === 'OL')
                ) {
                    nestedBlocks.push(serializeListElement(child, depth + 1))
                    return
                }

                inlineParts.push(serializeInlineNode(child))
            })

            const line = `${indent}${prefix}${collapseWhitespace(inlineParts.join(''))}`
            return [line, ...nestedBlocks.filter(Boolean)].filter(Boolean).join('\n')
        })
        .filter(Boolean)
        .join('\n')
}

function serializeTableElement(table: HTMLTableElement): string {
    const rows = Array.from(table.rows)
    if (rows.length === 0) {
        return ''
    }

    const serializeRow = (row: HTMLTableRowElement) =>
        Array.from(row.cells).map((cell) =>
            escapeMarkdownText(collapseWhitespace(serializeInlineChildren(cell)))
        )

    const headerCells = serializeRow(rows[0])
    if (headerCells.length === 0) {
        return ''
    }

    const separatorCells = headerCells.map((cell) => '-'.repeat(Math.max(3, cell.length || 3)))

    return [
        `| ${headerCells.join(' | ')} |`,
        `| ${separatorCells.join(' | ')} |`,
        ...rows.slice(1).map((row) => `| ${serializeRow(row).join(' | ')} |`),
    ].join('\n')
}

function serializeBlockElement(element: HTMLElement): string {
    switch (element.tagName) {
        case 'H1':
            return collapseWhitespace(`# ${serializeInlineChildren(element)}`)
        case 'H2':
            return collapseWhitespace(`## ${serializeInlineChildren(element)}`)
        case 'H3':
            return collapseWhitespace(`### ${serializeInlineChildren(element)}`)
        case 'H4':
            return collapseWhitespace(`#### ${serializeInlineChildren(element)}`)
        case 'H5':
            return collapseWhitespace(`##### ${serializeInlineChildren(element)}`)
        case 'H6':
            return collapseWhitespace(`###### ${serializeInlineChildren(element)}`)
        case 'P':
            return collapseWhitespace(serializeInlineChildren(element))
        case 'UL':
        case 'OL':
            return serializeListElement(element)
        case 'BLOCKQUOTE':
            return serializeInlineChildren(element)
                .split('\n')
                .map((line) => `> ${collapseWhitespace(line)}`)
                .join('\n')
        case 'PRE':
            return `\`\`\`\n${element.textContent?.trimEnd() ?? ''}\n\`\`\``
        case 'TABLE':
            return serializeTableElement(element as HTMLTableElement)
        default: {
            const nestedBlocks = Array.from(element.children)
                .map((child) => serializeBlockElement(child as HTMLElement))
                .filter(Boolean)

            if (nestedBlocks.length > 0) {
                return nestedBlocks.join('\n\n')
            }

            return collapseWhitespace(serializeInlineChildren(element))
        }
    }
}

function htmlToMarkdown(value: string): string {
    const parser = new DOMParser()
    const document = parser.parseFromString(value, 'text/html')
    const blocks = Array.from(document.body.children)

    if (blocks.length === 0) {
        return collapseWhitespace(document.body.textContent ?? '')
    }

    return blocks
        .map((element) => serializeBlockElement(element as HTMLElement))
        .filter(Boolean)
        .join('\n\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

type TableCellNode = {
    children?: RootContent[]
}

type TableRowNode = {
    children?: TableCellNode[]
}

type TableNode = RootContent & {
    type: 'table'
    children?: TableRowNode[]
}

function isTableNode(node: RootContent): node is TableNode {
    return node.type === 'table'
}

function escapeTableCell(value: string): string {
    return value.replace(/\|/g, '\\|')
}

function serializeTableNode(node: TableNode): string {
    const rows = node.children ?? []

    if (rows.length === 0) {
        return ''
    }

    const serializeRow = (row: TableRowNode) =>
        (row.children ?? []).map((cell) =>
            escapeTableCell(
                toString({
                    type: 'root',
                    children: cell.children ?? [],
                }).replace(/\s+/g, ' ').trim()
            )
        )

    const headerCells = serializeRow(rows[0])
    if (headerCells.length === 0) {
        return ''
    }

    const separatorCells = headerCells.map((cell) => '-'.repeat(Math.max(3, cell.length)))
    const markdownRows = [
        `| ${headerCells.join(' | ')} |`,
        `| ${separatorCells.join(' | ')} |`,
        ...rows.slice(1).map((row) => `| ${serializeRow(row).join(' | ')} |`),
    ]

    return markdownRows.join('\n').trim()
}

function normalizeTopLevelMarkdown(node: RootContent): string {
    if (isTableNode(node)) {
        return serializeTableNode(node)
    }

    try {
        return toMarkdown(node).trim()
    } catch {
        return toString(node).replace(/\s+/g, ' ').trim()
    }
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

export function formatModuleMarkdownForRender(markdown: string): string {
    const normalizedMarkdown = normalizeStoredMarkdown(markdown)

    if (!normalizedMarkdown) {
        return ''
    }

    return renumberMarkdownHeadings(normalizedMarkdown)
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

export function markdownToDom(markdown: string): Document {
    const parser = new DOMParser()
    return parser.parseFromString(markdownToHtml(markdown), 'text/html')
}

export function htmlToStoredMarkdown(html: string): string {
    return repairAiMarkdown(htmlToMarkdown(html))
}

