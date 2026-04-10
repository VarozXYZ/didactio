import type { DidacticUnitEditorChapter as UnitChapter } from './types'
import {
    extractMarkdownBlocks,
    formatModuleMarkdownForRender,
    markdownToHtml,
    type MarkdownPageBlock,
} from './utils/markdown'

const MOBILE_BREAKPOINT = 768
const HEADER_HEIGHT = 64
const OPEN_SIDEBAR_WIDTH = 260
export const ACTIVITIES_PAGE = '__ACTIVITIES_PAGE__'
const PAGE_WIDTH_RATIO = 0.72

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
}

function renderParagraphMarkdown(
    text: string,
    { continued = false, continuesNext = false }: { continued?: boolean; continuesNext?: boolean } = {}
): string {
    const normalizedText = text.trim()

    if (!normalizedText) {
        return ''
    }

    if (continued || continuesNext) {
        return normalizedText
    }

    return normalizedText
}

function renderBlock(
    block: MarkdownPageBlock,
    options: { continued?: boolean; continuesNext?: boolean } = {}
): string {
    if (block.type === 'markdown') {
        return block.markdown
    }

    if (!block.continued && !options.continued && !options.continuesNext) {
        return block.markdown
    }

    return renderParagraphMarkdown(block.text, { continued: block.continued, ...options })
}

function splitParagraphToFit({
    block,
    currentBlocks,
    currentLimit,
    fitsWithinLimit,
}: {
    block: Extract<MarkdownPageBlock, { type: 'paragraph' }>
    currentBlocks: string[]
    currentLimit: number
    fitsWithinLimit: (blocksToMeasure: string[], limit: number) => boolean
}): {
    fittingHtml: string | null
    remainder: Extract<MarkdownPageBlock, { type: 'paragraph' }> | null
} {
    const words = block.text.split(/\s+/).filter(Boolean)
    if (words.length <= 1) {
        return {
            fittingHtml: fitsWithinLimit(
                [...currentBlocks, renderBlock(block, { continuesNext: false })],
                currentLimit
            )
                ? renderBlock(block, { continuesNext: false })
                : null,
            remainder: null,
        }
    }

    let low = 1
    let high = words.length - 1
    let bestIndex = 0

    while (low <= high) {
        const middle = Math.floor((low + high) / 2)
        const candidateText = words.slice(0, middle).join(' ')
        const candidateMarkdown = renderParagraphMarkdown(candidateText, {
            continued: block.continued,
            continuesNext: middle < words.length,
        })

        if (fitsWithinLimit([...currentBlocks, candidateMarkdown], currentLimit)) {
            bestIndex = middle
            low = middle + 1
            continue
        }

        high = middle - 1
    }

    if (bestIndex === 0) {
        return {
            fittingHtml: null,
            remainder: { ...block },
        }
    }

    const splitIndex = bestIndex
    const fittingText = words.slice(0, splitIndex).join(' ')
    const remainderText = words.slice(splitIndex).join(' ')

    return {
        fittingHtml: renderParagraphMarkdown(fittingText, {
            continued: block.continued,
            continuesNext: Boolean(remainderText),
        }),
        remainder: remainderText
            ? {
                  type: 'paragraph',
                  markdown: remainderText,
                  text: remainderText,
                  continued: true,
              }
            : null,
    }
}

export function getStatusPillClass(status: UnitChapter['status']): string {
    if (status === 'ready') return 'bg-[#4ADE80]/10 text-[#2D8F4B]'
    if (status === 'pending') return 'bg-amber-50 text-amber-600'
    return 'bg-red-50 text-red-600'
}

function createHeaderMarkup(activeChapter: UnitChapter, chapterIndex: number): string {
    const overviewHtml = markdownToHtml(activeChapter.summary)

    return `
    <div class="mb-4 flex-shrink-0 space-y-2">
      <div class="flex items-center gap-2">
        <span class="rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#86868B]">
          Module ${chapterIndex + 1}
        </span>
        <span class="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${getStatusPillClass(activeChapter.status)}">
          ${escapeHtml(activeChapter.status)}
        </span>
      </div>
      <h2 class="text-xl font-bold leading-tight tracking-tight text-[#1D1D1F] md:text-2xl">
        ${escapeHtml(activeChapter.title)}
      </h2>
      <div class="text-xs font-medium italic leading-relaxed text-[#86868B] md:text-sm">
        ${overviewHtml}
      </div>
      <div class="flex items-center gap-3 pt-1 text-[10px] text-[#86868B]">
        <div class="flex items-center gap-1">
          <span>${escapeHtml(activeChapter.readingTime)}</span>
        </div>
        <div class="flex items-center gap-1">
          <span>${escapeHtml(activeChapter.level)}</span>
        </div>
      </div>
      <div class="my-3 h-[1px] w-full bg-[#E5E5E7]"></div>
    </div>
  `
}

export function measurePages({
    activeChapter,
    content,
    pageWidth,
    pageHeight,
    chapterIndex,
}: {
    activeChapter: UnitChapter
    content: string
    pageWidth: number
    pageHeight: number
    chapterIndex: number
}): string[] {
    if (!content || !pageWidth || !pageHeight) return []
    const renderedContent = formatModuleMarkdownForRender(content)
    if (!renderedContent) return []

    const isMobile = pageWidth < 420
    const horizontalPadding = isMobile ? 24 : 32
    const topPadding = isMobile ? 24 : 32
    const bottomPadding = isMobile ? 48 : 56
    const measurementBuffer = isMobile ? 10 : 14
    const contentWidth = Math.max(240, pageWidth - horizontalPadding * 2)
    const contentLimit = Math.max(160, pageHeight - topPadding - bottomPadding)

    const sandbox = document.createElement('div')
    sandbox.style.position = 'fixed'
    sandbox.style.left = '-10000px'
    sandbox.style.top = '0'
    sandbox.style.visibility = 'hidden'
    sandbox.style.pointerEvents = 'none'
    sandbox.style.opacity = '0'
    sandbox.style.zIndex = '-1'

    const proseMeasure = document.createElement('div')
    proseMeasure.className =
        'prose prose-neutral max-w-none text-sm leading-[1.9] text-[#1D1D1F] md:text-base'
    proseMeasure.style.width = `${contentWidth}px`

    const headerMeasure = document.createElement('div')
    headerMeasure.style.width = `${contentWidth}px`
    headerMeasure.innerHTML = createHeaderMarkup(activeChapter, chapterIndex)

    sandbox.appendChild(headerMeasure)
    sandbox.appendChild(proseMeasure)
    document.body.appendChild(sandbox)

    const firstPageLimit = Math.max(
        140,
        contentLimit - headerMeasure.scrollHeight - measurementBuffer
    )
    const regularPageLimit = Math.max(140, contentLimit - measurementBuffer)
    const blocks = extractMarkdownBlocks(renderedContent)
    const pages: string[] = []
    let currentBlocks: string[] = []
    let blockIndex = 0

    const fitsWithinLimit = (blocksToMeasure: string[], limit: number) => {
        proseMeasure.innerHTML = markdownToHtml(blocksToMeasure.join('\n\n'))
        return proseMeasure.scrollHeight <= limit + 1
    }

    while (blockIndex < blocks.length) {
        const block = blocks[blockIndex]
        const currentLimit = pages.length === 0 ? firstPageLimit : regularPageLimit
        const candidateHtml = renderBlock(block)
        const candidateBlocks = [...currentBlocks, candidateHtml]

        if (fitsWithinLimit(candidateBlocks, currentLimit)) {
            currentBlocks = candidateBlocks
            blockIndex += 1
            continue
        }

        if (block.type === 'paragraph') {
            const { fittingHtml, remainder } = splitParagraphToFit({
                block,
                currentBlocks,
                currentLimit,
                fitsWithinLimit,
            })

            if (fittingHtml) {
                pages.push([...currentBlocks, fittingHtml].join('\n\n'))
                currentBlocks = []

                if (remainder?.text && remainder.text !== block.text) {
                    blocks.splice(blockIndex, 1, remainder)
                } else {
                    blockIndex += 1
                }

                continue
            }
        }

        if (currentBlocks.length > 0) {
            pages.push(currentBlocks.join('\n\n'))
            currentBlocks = []
            continue
        }

        if (block.type === 'paragraph') {
            const { fittingHtml, remainder } = splitParagraphToFit({
                block,
                currentBlocks,
                currentLimit,
                fitsWithinLimit,
            })

            pages.push(fittingHtml ?? candidateHtml)

            if (remainder?.text && remainder.text !== block.text) {
                blocks.splice(blockIndex, 1, remainder)
            } else {
                blockIndex += 1
            }

            continue
        }

        pages.push(candidateHtml)
        blockIndex += 1
    }

    if (currentBlocks.length > 0) {
        pages.push(currentBlocks.join('\n\n'))
    }

    document.body.removeChild(sandbox)

    return [...pages, ACTIVITIES_PAGE]
}

export function paginateMarkdownContent({
    content,
    pageWidth,
    pageHeight,
}: {
    content: string
    pageWidth: number
    pageHeight: number
}): string[] {
    if (!content || !pageWidth || !pageHeight) return []

    const isMobile = pageWidth < 420
    const horizontalPadding = isMobile ? 24 : 32
    const topPadding = isMobile ? 24 : 32
    const bottomPadding = isMobile ? 48 : 56
    const measurementBuffer = isMobile ? 10 : 14
    const contentWidth = Math.max(240, pageWidth - horizontalPadding * 2)
    const contentLimit = Math.max(160, pageHeight - topPadding - bottomPadding)
    const regularPageLimit = Math.max(140, contentLimit - measurementBuffer)

    const sandbox = document.createElement('div')
    sandbox.style.position = 'fixed'
    sandbox.style.left = '-10000px'
    sandbox.style.top = '0'
    sandbox.style.visibility = 'hidden'
    sandbox.style.pointerEvents = 'none'
    sandbox.style.opacity = '0'
    sandbox.style.zIndex = '-1'

    const proseMeasure = document.createElement('div')
    proseMeasure.className =
        'prose prose-neutral max-w-none text-sm leading-[1.9] text-[#1D1D1F] md:text-base'
    proseMeasure.style.width = `${contentWidth}px`

    sandbox.appendChild(proseMeasure)
    document.body.appendChild(sandbox)

    const blocks = extractMarkdownBlocks(content)
    const pages: string[] = []
    let currentBlocks: string[] = []
    let blockIndex = 0

    const fitsWithinLimit = (blocksToMeasure: string[], limit: number) => {
        proseMeasure.innerHTML = markdownToHtml(blocksToMeasure.join('\n\n'))
        return proseMeasure.scrollHeight <= limit + 1
    }

    while (blockIndex < blocks.length) {
        const block = blocks[blockIndex]
        const candidateHtml = renderBlock(block)
        const candidateBlocks = [...currentBlocks, candidateHtml]

        if (fitsWithinLimit(candidateBlocks, regularPageLimit)) {
            currentBlocks = candidateBlocks
            blockIndex += 1
            continue
        }

        if (block.type === 'paragraph') {
            const { fittingHtml, remainder } = splitParagraphToFit({
                block,
                currentBlocks,
                currentLimit: regularPageLimit,
                fitsWithinLimit,
            })

            if (fittingHtml) {
                pages.push([...currentBlocks, fittingHtml].join('\n\n'))
                currentBlocks = []

                if (remainder?.text && remainder.text !== block.text) {
                    blocks.splice(blockIndex, 1, remainder)
                } else {
                    blockIndex += 1
                }

                continue
            }
        }

        if (currentBlocks.length > 0) {
            pages.push(currentBlocks.join('\n\n'))
            currentBlocks = []
            continue
        }

        pages.push(candidateHtml)
        blockIndex += 1
    }

    if (currentBlocks.length > 0) {
        pages.push(currentBlocks.join('\n\n'))
    }

    document.body.removeChild(sandbox)

    return pages
}

export function calculateSpreadMetrics({
    viewportWidth,
    viewportHeight,
}: {
    viewportWidth: number
    viewportHeight: number
}) {
    const isMobile = viewportWidth < MOBILE_BREAKPOINT
    const stagePaddingX = isMobile ? 16 : 32
    const stagePaddingTop = isMobile ? 16 : 24
    const stagePaddingBottom = isMobile ? 20 : 32
    const indicatorHeight = isMobile ? 42 : 48
    const indicatorGap = isMobile ? 12 : 16
    const arrowAllowance = isMobile ? 84 : 136
    const spreadGap = isMobile ? 16 : Math.max(28, Math.min(44, viewportWidth * 0.014))
    const availableWidth = Math.max(
        360,
        viewportWidth - OPEN_SIDEBAR_WIDTH - stagePaddingX * 2 - arrowAllowance
    )
    const availableHeight = Math.max(
        420,
        viewportHeight -
            HEADER_HEIGHT -
            stagePaddingTop -
            stagePaddingBottom -
            indicatorHeight -
            indicatorGap
    )
    const maxPageHeight = Math.min(availableHeight, isMobile ? 680 : viewportHeight * 0.82)
    const spreadWidthByHeight = maxPageHeight * PAGE_WIDTH_RATIO * 2 + spreadGap
    const spreadWidth = Math.min(availableWidth, spreadWidthByHeight, isMobile ? 980 : 1900)
    const pageWidth = (spreadWidth - spreadGap) / 2
    const pageHeight = Math.min(maxPageHeight, pageWidth / PAGE_WIDTH_RATIO)

    return {
        indicatorGap,
        isMobile,
        pageHeight,
        pageWidth,
        spreadGap,
        spreadHeight: pageHeight,
        spreadWidth: pageWidth * 2 + spreadGap,
    }
}
