import type { DidacticUnitEditorChapter as UnitChapter } from './types'

const MOBILE_BREAKPOINT = 768
const HEADER_HEIGHT = 64
const OPEN_SIDEBAR_WIDTH = 260
const CLOSED_SIDEBAR_WIDTH = 80
export const ACTIVITIES_PAGE = '__ACTIVITIES_PAGE__'
const PAGE_WIDTH_RATIO = 0.72

type PageBlock =
    | { type: 'paragraph'; text: string; continued: boolean }
    | { type: 'html'; html: string }

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
}

function extractBlocks(content: string): PageBlock[] {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    const blocks: PageBlock[] = []

    Array.from(doc.body.children).forEach((element) => {
        if (element.tagName === 'P') {
            const text = element.textContent?.replace(/\s+/g, ' ').trim()
            if (text) {
                blocks.push({ type: 'paragraph', text, continued: false })
            }
            return
        }

        blocks.push({ type: 'html', html: element.outerHTML })
    })

    return blocks
}

function renderParagraph(
    text: string,
    { continued = false, continuesNext = false }: { continued?: boolean; continuesNext?: boolean } = {}
): string {
    const classes: string[] = []

    if (continued || continuesNext) {
        classes.push('paragraph-fragment')
    }

    if (continued && !continuesNext) {
        classes.push('paragraph-fragment-last')
    }

    const className = classes.length ? ` class="${classes.join(' ')}"` : ''
    return `<p${className}>${escapeHtml(text)}</p>`
}

function renderBlock(
    block: PageBlock,
    options: { continued?: boolean; continuesNext?: boolean } = {}
): string {
    if (block.type === 'html') return block.html
    return renderParagraph(block.text, { continued: block.continued, ...options })
}

function splitParagraphToFit({
    block,
    currentBlocks,
    currentLimit,
    fitsWithinLimit,
}: {
    block: Extract<PageBlock, { type: 'paragraph' }>
    currentBlocks: string[]
    currentLimit: number
    fitsWithinLimit: (blocksToMeasure: string[], limit: number) => boolean
}): {
    fittingHtml: string | null
    remainder: Extract<PageBlock, { type: 'paragraph' }> | null
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
        const candidateHtml = renderParagraph(candidateText, {
            continued: block.continued,
            continuesNext: middle < words.length,
        })

        if (fitsWithinLimit([...currentBlocks, candidateHtml], currentLimit)) {
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
        fittingHtml: renderParagraph(fittingText, {
            continued: block.continued,
            continuesNext: Boolean(remainderText),
        }),
        remainder: remainderText
            ? { type: 'paragraph', text: remainderText, continued: true }
            : null,
    }
}

export function getStatusPillClass(status: UnitChapter['status']): string {
    if (status === 'ready') return 'bg-[#4ADE80]/10 text-[#2D8F4B]'
    if (status === 'pending') return 'bg-amber-50 text-amber-600'
    return 'bg-red-50 text-red-600'
}

function createHeaderMarkup(activeChapter: UnitChapter, chapterIndex: number): string {
    return `
    <div class="mb-4 flex-shrink-0 space-y-2">
      <div class="flex items-center gap-2">
        <span class="rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#86868B]">
          Chapter ${chapterIndex + 1}
        </span>
        <span class="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${getStatusPillClass(activeChapter.status)}">
          ${escapeHtml(activeChapter.status)}
        </span>
      </div>
      <h2 class="text-xl font-bold leading-tight tracking-tight text-[#1D1D1F] md:text-2xl">
        ${escapeHtml(activeChapter.title)}
      </h2>
      <p class="text-xs font-medium italic leading-relaxed text-[#86868B] md:text-sm">
        ${escapeHtml(activeChapter.summary)}
      </p>
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
    const blocks = extractBlocks(content)
    const pages: string[] = []
    let currentBlocks: string[] = []
    let blockIndex = 0

    const fitsWithinLimit = (blocksToMeasure: string[], limit: number) => {
        proseMeasure.innerHTML = blocksToMeasure.join('')
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
                pages.push([...currentBlocks, fittingHtml].join(''))
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
            pages.push(currentBlocks.join(''))
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
        pages.push(currentBlocks.join(''))
    }

    document.body.removeChild(sandbox)

    return [...pages, ACTIVITIES_PAGE]
}

export function calculateSpreadMetrics({
    viewportWidth,
    viewportHeight,
    isSidebarOpen,
}: {
    viewportWidth: number
    viewportHeight: number
    isSidebarOpen: boolean
}) {
    const isMobile = viewportWidth < MOBILE_BREAKPOINT
    const sidebarWidth = isSidebarOpen ? OPEN_SIDEBAR_WIDTH : CLOSED_SIDEBAR_WIDTH
    const stagePaddingX = isMobile ? 16 : 32
    const stagePaddingTop = isMobile ? 16 : 24
    const stagePaddingBottom = isMobile ? 20 : 32
    const indicatorHeight = isMobile ? 42 : 48
    const indicatorGap = isMobile ? 12 : 16
    const arrowAllowance = isMobile ? 84 : 136
    const spreadGap = isMobile ? 16 : Math.max(28, Math.min(44, viewportWidth * 0.014))
    const availableWidth = Math.max(
        360,
        viewportWidth - sidebarWidth - stagePaddingX * 2 - arrowAllowance
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
