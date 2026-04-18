import type { ChapterPresentationSettings, DidacticUnitEditorChapter as UnitChapter } from './types'
import {
    extractMarkdownBlocks,
    formatModuleMarkdownForRender,
    markdownToHtml,
    type MarkdownPageBlock,
} from './utils/markdown'
import {
    prepareParagraphBlock,
    prepareH1Block,
    prepareH2Block,
    prepareH3Block,
    prepareListItemBlock,
    measureBlockHeight,
    getBlockLines,
    type BlockMeasurement,
} from './utils/pretextMeasure'
import {
    resolveTypography,
    defaultTypography,
    applyTypographyVars,
    type ResolvedTypography,
    type FontId,
    type SizeProfile,
} from './utils/typography'

const MOBILE_BREAKPOINT = 768
const HEADER_HEIGHT = 64
// Must match the editor aside (`w-[280px]` in UnitEditor).
const OPEN_SIDEBAR_WIDTH = 280
// Page width ÷ page height. Desktop is tuned for a balance between readable line length and card shape.
const PAGE_WIDTH_RATIO_DESKTOP = 0.76
// Mobile is a rough default only; dedicated mobile layout is planned separately.
const PAGE_WIDTH_RATIO_MOBILE = 0.72
const POST_MODULE_ACTION_GAP = 24

type ContentMeasuredModulePage = {
    kind: 'content'
    markdown: string
    startCharacterOffset: number
    endCharacterOffset: number
}

type ContentWithActionsMeasuredModulePage = {
    kind: 'content_with_actions'
    markdown: string
    startCharacterOffset: number
    endCharacterOffset: number
    hasNextModule: boolean
    primaryActionLabel: string
}

type PostModuleActionsMeasuredPage = {
    kind: 'post_module_actions'
    startCharacterOffset: number
    endCharacterOffset: number
    hasNextModule: boolean
    primaryActionLabel: string
}

export type MeasuredModulePage =
    | ContentMeasuredModulePage
    | ContentWithActionsMeasuredModulePage
    | PostModuleActionsMeasuredPage

type MeasurePageChapter = Pick<
    UnitChapter,
    'title' | 'summary' | 'status' | 'readingTime' | 'level'
>

type AnnotatedMarkdownPageBlock = MarkdownPageBlock & {
    startCharacterOffset: number
    endCharacterOffset: number
    // Present for paragraphs and h1-h3 headings.
    blockMeasurement?: BlockMeasurement
    // Present for splittable_list — one entry per item.
    itemMeasurements?: BlockMeasurement[]
}

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
    if (block.type === 'markdown' || block.type === 'splittable_list') {
        return block.markdown
    }

    if (!block.continued && !options.continued && !options.continuesNext) {
        return block.markdown
    }

    return renderParagraphMarkdown(block.text, { continued: block.continued, ...options })
}

function isMeasuredPageWithMarkdown(
    page: MeasuredModulePage
): page is ContentMeasuredModulePage | ContentWithActionsMeasuredModulePage {
    return page.kind === 'content' || page.kind === 'content_with_actions'
}

function isMeasuredPageWithReadableContent(
    page: MeasuredModulePage
): page is ContentMeasuredModulePage | ContentWithActionsMeasuredModulePage {
    return isMeasuredPageWithMarkdown(page)
}

function annotateBlocks(
    blocks: MarkdownPageBlock[],
    typography: ResolvedTypography,
): AnnotatedMarkdownPageBlock[] {
    let characterOffset = 0

    return blocks.map((block) => {
        const startCharacterOffset = characterOffset
        const endCharacterOffset = startCharacterOffset + block.text.length
        characterOffset = endCharacterOffset

        if (block.type === 'paragraph') {
            return {
                ...block,
                startCharacterOffset,
                endCharacterOffset,
                blockMeasurement: prepareParagraphBlock(block.inlineChildren, block.text, typography),
            }
        }

        if (block.type === 'markdown') {
            const hl = block.headingLevel
            if (hl === 1) {
                return { ...block, startCharacterOffset, endCharacterOffset, blockMeasurement: prepareH1Block(block.inlineChildren, block.text, typography) }
            }
            if (hl === 2) {
                return { ...block, startCharacterOffset, endCharacterOffset, blockMeasurement: prepareH2Block(block.inlineChildren, block.text, typography) }
            }
            if (hl === 3) {
                return { ...block, startCharacterOffset, endCharacterOffset, blockMeasurement: prepareH3Block(block.inlineChildren, block.text, typography) }
            }
            return { ...block, startCharacterOffset, endCharacterOffset }
        }

        if (block.type === 'splittable_list') {
            const itemMeasurements = block.items.map((item) =>
                prepareListItemBlock(item.inlineChildren, item.text, typography)
            )
            return { ...block, startCharacterOffset, endCharacterOffset, itemMeasurements }
        }

        // All union members handled above; this is unreachable.
        return { ...(block as object), startCharacterOffset, endCharacterOffset } as AnnotatedMarkdownPageBlock
    })
}

/** Join blocks for storage / HTML render. Continued paragraph fragments use MD hard breaks so they stay one `<p>`. */
function joinBlocksMarkdown(blocks: MarkdownPageBlock[]): string {
    if (blocks.length === 0) return ''
    let out = renderBlock(blocks[0])
    for (let i = 1; i < blocks.length; i++) {
        const prev = blocks[i - 1]
        const curr = blocks[i]
        const continuedPara =
            curr.type === 'paragraph' &&
            curr.continued &&
            prev.type === 'paragraph'
        out += continuedPara ? '  \n' : '\n\n'
        out += renderBlock(curr)
    }
    return out
}

function splitParagraphToFit({
    block,
    currentBlocksHeight,
    currentLimit,
    contentWidth,
    typography,
}: {
    block: Extract<AnnotatedMarkdownPageBlock, { type: 'paragraph' }>
    currentBlocksHeight: number
    currentLimit: number
    contentWidth: number
    typography: ResolvedTypography
}): {
    fittingBlock: Extract<AnnotatedMarkdownPageBlock, { type: 'paragraph' }> | null
    remainder: Extract<AnnotatedMarkdownPageBlock, { type: 'paragraph' }> | null
} {
    const measurement = block.blockMeasurement ?? prepareParagraphBlock(block.inlineChildren, block.text, typography)
    const lines = getBlockLines(measurement, contentWidth)
    if (lines.length === 0) {
        return { fittingBlock: null, remainder: { ...block } }
    }

    const availableHeight = currentLimit - currentBlocksHeight
    if (availableHeight <= 0) {
        return { fittingBlock: null, remainder: { ...block } }
    }

    // Count lines that fit including this block's vertical margins (must match measureBlockHeight).
    const verticalMargins = measurement.marginTopPx + measurement.marginBottomPx
    const fittingLineCount = Math.floor((availableHeight - verticalMargins) / measurement.lineHeightPx)
    if (fittingLineCount <= 0) {
        return { fittingBlock: null, remainder: { ...block } }
    }

    if (fittingLineCount >= lines.length) {
        return { fittingBlock: block, remainder: null }
    }

    const fittingText = lines.slice(0, fittingLineCount).join(' ')
    const remainderText = lines.slice(fittingLineCount).join(' ')
    const fittingEndCharacterOffset = Math.min(
        block.endCharacterOffset,
        block.startCharacterOffset + fittingText.length
    )
    const remainderStartCharacterOffset = remainderText
        ? Math.min(block.endCharacterOffset, fittingEndCharacterOffset + 1)
        : fittingEndCharacterOffset

    return {
        fittingBlock: {
            ...block,
            markdown: renderParagraphMarkdown(fittingText, {
                continued: block.continued,
                continuesNext: Boolean(remainderText),
            }),
            text: fittingText,
            endCharacterOffset: fittingEndCharacterOffset,
            blockMeasurement: prepareParagraphBlock(undefined, fittingText, typography),
        },
        remainder: remainderText
            ? {
                  ...block,
                  markdown: remainderText,
                  text: remainderText,
                  continued: true,
                  startCharacterOffset: remainderStartCharacterOffset,
                  blockMeasurement: prepareParagraphBlock(undefined, remainderText, typography),
              }
            : null,
    }
}

type SplittableListAnnotated = Extract<AnnotatedMarkdownPageBlock, { type: 'splittable_list' }>

function measureListHeight(
    _block: SplittableListAnnotated,
    itemMeasurements: BlockMeasurement[],
    itemContentWidth: number,
    typography: ResolvedTypography,
): number {
    let total = typography.list.marginTopPx + typography.list.marginBottomPx
    for (const m of itemMeasurements) {
        total += measureBlockHeight(m, itemContentWidth)
    }
    return total
}

function splitListToFit({
    block,
    currentBlocksHeight,
    currentLimit,
    contentWidth,
    typography,
}: {
    block: SplittableListAnnotated
    currentBlocksHeight: number
    currentLimit: number
    contentWidth: number
    typography: ResolvedTypography
}): {
    fittingBlock: SplittableListAnnotated | null
    remainder: SplittableListAnnotated | null
} {
    const { items, spread } = block
    const itemMeasurements = block.itemMeasurements ?? items.map((item) =>
        prepareListItemBlock(item.inlineChildren, item.text, typography)
    )
    if (items.length <= 1) {
        return { fittingBlock: null, remainder: block }
    }

    const itemContentWidth = Math.max(1, contentWidth - typography.list.paddingLeftPx)
    const separator = spread ? '\n\n' : '\n'

    const makeSubBlock = (slicedItems: typeof items, slicedMeasurements: BlockMeasurement[]): SplittableListAnnotated => ({
        ...block,
        items: slicedItems,
        markdown: slicedItems.map((item) => item.markdown.trim()).join(separator),
        text: slicedItems.map((item) => item.text).join(' '),
        itemMeasurements: slicedMeasurements,
    })

    // Greedy forward scan — O(n) instead of binary search, allowing accurate Pretext heights.
    let bestK = 0
    let runningHeight = currentBlocksHeight + typography.list.marginTopPx + typography.list.marginBottomPx

    for (let k = 0; k < items.length - 1; k++) {
        runningHeight += measureBlockHeight(itemMeasurements[k], itemContentWidth)
        if (runningHeight <= currentLimit + 1) {
            bestK = k + 1
        } else {
            break
        }
    }

    if (bestK === 0) {
        return { fittingBlock: null, remainder: block }
    }

    if (bestK >= items.length) {
        return { fittingBlock: block, remainder: null }
    }

    const fittingItems = items.slice(0, bestK)
    const remainderItems = items.slice(bestK)
    const fittingTextLength = fittingItems.reduce((sum, item) => sum + item.text.length, 0)
    const fittingEndOffset = Math.min(block.endCharacterOffset, block.startCharacterOffset + fittingTextLength)

    return {
        fittingBlock: { ...makeSubBlock(fittingItems, itemMeasurements.slice(0, bestK)), startCharacterOffset: block.startCharacterOffset, endCharacterOffset: fittingEndOffset },
        remainder: { ...makeSubBlock(remainderItems, itemMeasurements.slice(bestK)), startCharacterOffset: fittingEndOffset, endCharacterOffset: block.endCharacterOffset },
    }
}

function estimateBlockHeight(
    block: AnnotatedMarkdownPageBlock,
    contentWidth: number,
    typography: ResolvedTypography,
    domMeasure: (block: MarkdownPageBlock) => number,
): number {
    if (block.blockMeasurement) {
        return measureBlockHeight(block.blockMeasurement, contentWidth)
    }

    if (block.type === 'splittable_list' && block.itemMeasurements) {
        const itemContentWidth = Math.max(1, contentWidth - typography.list.paddingLeftPx)
        return measureListHeight(block as unknown as SplittableListAnnotated, block.itemMeasurements, itemContentWidth, typography)
    }

    return domMeasure(block)
}

function paginateBlocks({
    blocks,
    firstPageLimit,
    regularPageLimit,
    contentWidth,
    typography,
    domMeasureBlock,
}: {
    blocks: AnnotatedMarkdownPageBlock[]
    firstPageLimit: number
    regularPageLimit: number
    contentWidth: number
    typography: ResolvedTypography
    domMeasureBlock: (block: MarkdownPageBlock) => number
}): AnnotatedMarkdownPageBlock[][] {
    const mutableBlocks = [...blocks]
    const pages: AnnotatedMarkdownPageBlock[][] = []
    let currentBlocks: AnnotatedMarkdownPageBlock[] = []
    let currentHeight = 0
    let blockIndex = 0

    while (blockIndex < mutableBlocks.length) {
        const block = mutableBlocks[blockIndex]
        const currentLimit = pages.length === 0 ? firstPageLimit : regularPageLimit
        const blockHeight = estimateBlockHeight(block, contentWidth, typography, domMeasureBlock)

        if (currentHeight + blockHeight <= currentLimit + 1) {
            currentBlocks.push(block)
            currentHeight += blockHeight
            blockIndex += 1
            continue
        }

        if (block.type === 'paragraph') {
            const { fittingBlock, remainder } = splitParagraphToFit({
                block,
                currentBlocksHeight: currentHeight,
                currentLimit,
                contentWidth,
                typography,
            })

            if (fittingBlock) {
                pages.push([...currentBlocks, fittingBlock])
                currentBlocks = []
                currentHeight = 0

                if (remainder?.text && remainder.text !== block.text) {
                    mutableBlocks.splice(blockIndex, 1, remainder)
                } else {
                    blockIndex += 1
                }

                continue
            }
        }

        if (block.type === 'splittable_list') {
            const { fittingBlock, remainder } = splitListToFit({
                block,
                currentBlocksHeight: currentHeight,
                currentLimit,
                contentWidth,
                typography,
            })

            if (fittingBlock) {
                pages.push([...currentBlocks, fittingBlock])
                currentBlocks = []
                currentHeight = 0

                if (remainder) {
                    mutableBlocks.splice(blockIndex, 1, remainder)
                } else {
                    blockIndex += 1
                }

                continue
            }
        }

        if (currentBlocks.length > 0) {
            // Prevent orphaned headings / short intros at the bottom of a page.
            // When a heading (or heading + short intro paragraph) ends up as the
            // last content on a page with no following content, move it forward so
            // it stays with what comes next.
            const isHeading = (b: AnnotatedMarkdownPageBlock) =>
                b.type === 'markdown' && /^#{1,6}\s/.test(b.markdown)
            const isShortIntro = (b: AnnotatedMarkdownPageBlock) =>
                b.type === 'paragraph' && b.text.length < 80

            const lastBlock = currentBlocks.at(-1)!
            const secondLastBlock = currentBlocks.at(-2)

            if (
                currentBlocks.length >= 2 &&
                secondLastBlock &&
                isHeading(secondLastBlock) &&
                isShortIntro(lastBlock)
            ) {
                currentBlocks.splice(-2)
                mutableBlocks.splice(blockIndex, 0, secondLastBlock, lastBlock)
            } else if (currentBlocks.length >= 2 && isHeading(lastBlock)) {
                currentBlocks.pop()
                mutableBlocks.splice(blockIndex, 0, lastBlock)
            }

            pages.push(currentBlocks)
            currentBlocks = []
            currentHeight = 0
            continue
        }

        if (block.type === 'paragraph') {
            const { fittingBlock, remainder } = splitParagraphToFit({
                block,
                currentBlocksHeight: 0,
                currentLimit,
                contentWidth,
                typography,
            })

            pages.push(fittingBlock ? [fittingBlock] : [block])
            currentBlocks = []
            currentHeight = 0

            if (remainder?.text && remainder.text !== block.text) {
                mutableBlocks.splice(blockIndex, 1, remainder)
            } else {
                blockIndex += 1
            }

            continue
        }

        if (block.type === 'splittable_list') {
            const { fittingBlock, remainder } = splitListToFit({
                block,
                currentBlocksHeight: 0,
                currentLimit,
                contentWidth,
                typography,
            })

            pages.push(fittingBlock ? [fittingBlock] : [block])
            currentBlocks = []
            currentHeight = 0

            if (remainder) {
                mutableBlocks.splice(blockIndex, 1, remainder)
            } else {
                blockIndex += 1
            }

            continue
        }

        pages.push([block])
        currentBlocks = []
        currentHeight = 0
        blockIndex += 1
    }

    if (currentBlocks.length > 0) {
        pages.push(currentBlocks)
    }

    return pages
}

function validatePagesWithDom(
    pages: AnnotatedMarkdownPageBlock[][],
    firstPageLimit: number,
    regularPageLimit: number,
    proseMeasure: HTMLDivElement,
): AnnotatedMarkdownPageBlock[][] {
    const validated: AnnotatedMarkdownPageBlock[][] = []

    for (let i = 0; i < pages.length; i++) {
        const page = pages[i]
        const limit = (validated.length === 0 ? firstPageLimit : regularPageLimit) + 1
        proseMeasure.innerHTML = markdownToHtml(joinBlocksMarkdown(page))

        if (proseMeasure.scrollHeight <= limit) {
            validated.push(page)
            continue
        }

        if (page.length <= 1) {
            validated.push(page)
            continue
        }

        const overflow = page.at(-1)!
        validated.push(page.slice(0, -1))

        const nextPage = pages[i + 1]
        if (nextPage) {
            pages[i + 1] = [overflow, ...nextPage]
        } else {
            pages.push([overflow])
        }
    }

    return validated
}

function buildMeasuredPage(blocks: AnnotatedMarkdownPageBlock[]): ContentMeasuredModulePage {
    return {
        kind: 'content',
        markdown: joinBlocksMarkdown(blocks),
        startCharacterOffset: blocks[0]?.startCharacterOffset ?? 0,
        endCharacterOffset: blocks.at(-1)?.endCharacterOffset ?? 0,
    }
}

function createPostModuleActionMeasurementMarkup(input: {
    hasNextModule: boolean
    primaryActionLabel: string
}): string {
    const eyebrow = input.hasNextModule ? 'Ready to continue' : 'Unit complete'
    const body = input.hasNextModule
        ? 'You can keep your momentum going with the next module, or come back later for practice exercises.'
        : 'You have reached the end of this unit. Practice exercises are coming soon, and you can wrap up for now.'

    return `
        <div class="space-y-4">
            <div class="space-y-2">
                <p class="text-[10px] font-bold uppercase tracking-[0.24em] text-[#86868B]">
                    ${escapeHtml(eyebrow)}
                </p>
                <p class="text-sm font-medium leading-[1.6] text-[#4B5563]">
                    ${escapeHtml(body)}
                </p>
            </div>
            <div class="grid gap-2">
                <button type="button" disabled class="w-full rounded-2xl border border-[#E5E5E7] bg-[#F8F8F9] px-4 py-3 text-left text-sm font-semibold text-[#A1A1AA]">
                    Quick Check · Coming soon
                </button>
                <button type="button" disabled class="w-full rounded-2xl border border-[#E5E5E7] bg-[#F8F8F9] px-4 py-3 text-left text-sm font-semibold text-[#A1A1AA]">
                    Applied Practice · Coming soon
                </button>
                <button type="button" class="w-full rounded-2xl bg-[#111827] px-4 py-3 text-sm font-semibold text-white">
                    ${escapeHtml(input.primaryActionLabel)}
                </button>
            </div>
        </div>
    `
}

function canMergeTerminalActionPage({
    lastPage,
    pageLimit,
    proseMeasure,
    actionMeasure,
}: {
    lastPage: ContentMeasuredModulePage
    pageLimit: number
    proseMeasure: HTMLDivElement
    actionMeasure: HTMLDivElement
}): boolean {
    proseMeasure.innerHTML = markdownToHtml(lastPage.markdown)
    const proseHeight = proseMeasure.scrollHeight
    const actionHeight = actionMeasure.scrollHeight

    return proseHeight + POST_MODULE_ACTION_GAP + actionHeight <= pageLimit + 1
}

export function getReadCharacterCountForSpread(
    pages: MeasuredModulePage[],
    spreadIndex: number
): number {
    const spreadPages = pages.slice(spreadIndex * 2, spreadIndex * 2 + 2)
    const contentPages = spreadPages.filter(isMeasuredPageWithReadableContent)

    if (contentPages.length === 0) {
        return 0
    }

    return Math.max(...contentPages.map((page) => page.endCharacterOffset))
}

export function findResumeSpreadIndex(
    pages: MeasuredModulePage[],
    readCharacterCount: number
): number {
    if (pages.length === 0) {
        return 0
    }

    const firstUnreadPageIndex = pages.findIndex(
        (page) =>
            isMeasuredPageWithReadableContent(page) &&
            page.endCharacterOffset > readCharacterCount
    )

    if (firstUnreadPageIndex === -1) {
        return Math.max(0, Math.floor((pages.length - 1) / 2))
    }

    return Math.floor(firstUnreadPageIndex / 2)
}

export function getStatusPillClass(status: UnitChapter['status']): string {
    if (status === 'ready') return 'bg-[#4ADE80]/10 text-[#2D8F4B]'
    if (status === 'pending') return 'bg-amber-50 text-amber-600'
    return 'bg-red-50 text-red-600'
}

function createHeaderMarkup(activeChapter: MeasurePageChapter, chapterIndex: number): string {
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
    hasNextModule,
    presentationSettings,
}: {
    activeChapter: MeasurePageChapter
    content: string
    pageWidth: number
    pageHeight: number
    chapterIndex: number
    hasNextModule: boolean
    presentationSettings?: ChapterPresentationSettings
}): MeasuredModulePage[] {
    if (!content || !pageWidth || !pageHeight) return []
    const renderedContent = formatModuleMarkdownForRender(content)
    if (!renderedContent) return []

    const isMobile = pageWidth < 420

    // Padding constants must exactly match the page card wrapper CSS:
    //   mobile:   p-6 pb-12  → 24px top/sides, 48px bottom
    //   desktop:  md:p-8 md:pb-14 → 32px top/sides, 56px bottom
    const pagePaddingSide   = isMobile ? 24 : 32
    const pagePaddingTop    = isMobile ? 24 : 32
    const pagePaddingBottom = isMobile ? 48 : 56
    const measurementBuffer = isMobile ? 8 : 6

    const contentWidth = Math.max(240, pageWidth - pagePaddingSide * 2)
    const contentLimit = Math.max(160, pageHeight - pagePaddingTop - pagePaddingBottom)
    const primaryActionLabel = hasNextModule ? 'Next module' : 'Finish unit 🎉'

    const typography = presentationSettings
        ? resolveTypography({
              sizeProfile: (presentationSettings.sizeProfile ?? 'regular') as SizeProfile,
              bodyFontId: (presentationSettings.bodyFontFamily ?? 'inter') as FontId,
              headingFontId: (presentationSettings.headingFontFamily ?? 'inter') as FontId,
              isMobile,
          })
        : defaultTypography(isMobile)

    const sandbox = document.createElement('div')
    sandbox.style.position = 'fixed'
    sandbox.style.left = '-10000px'
    sandbox.style.top = '0'
    sandbox.style.visibility = 'hidden'
    sandbox.style.pointerEvents = 'none'
    sandbox.style.opacity = '0'
    sandbox.style.zIndex = '-1'

    const proseMeasure = document.createElement('div')
    proseMeasure.className = 'prose prose-neutral max-w-none leading-[1.9] text-[#1D1D1F]'
    proseMeasure.style.width = `${contentWidth}px`
    proseMeasure.style.overflow = 'hidden'
    applyTypographyVars(proseMeasure, typography)

    const headerMeasure = document.createElement('div')
    headerMeasure.style.width = `${contentWidth}px`
    headerMeasure.style.overflow = 'hidden'
    headerMeasure.innerHTML = createHeaderMarkup(activeChapter, chapterIndex)

    // Measure the "Module Content" label that sits above the content area on
    // every non-first page (matches the label in renderContentPage).
    const labelMeasure = document.createElement('div')
    labelMeasure.style.width = `${contentWidth}px`
    labelMeasure.innerHTML = '<div class="mb-3 text-[11px] font-semibold uppercase tracking-wide">Module Content</div>'

    const actionMeasure = document.createElement('div')
    actionMeasure.style.width = `${contentWidth}px`
    actionMeasure.innerHTML = createPostModuleActionMeasurementMarkup({
        hasNextModule,
        primaryActionLabel,
    })

    sandbox.appendChild(headerMeasure)
    sandbox.appendChild(labelMeasure)
    sandbox.appendChild(proseMeasure)
    sandbox.appendChild(actionMeasure)
    document.body.appendChild(sandbox)

    const firstPageLimit = Math.max(
        140,
        contentLimit - headerMeasure.scrollHeight - measurementBuffer
    )
    const regularPageLimit = Math.max(140, contentLimit - labelMeasure.scrollHeight - measurementBuffer)
    const blocks = annotateBlocks(extractMarkdownBlocks(renderedContent), typography)

    const domMeasureBlock = (block: MarkdownPageBlock): number => {
        proseMeasure.innerHTML = markdownToHtml(renderBlock(block))
        return proseMeasure.scrollHeight
    }

    const rawPages = paginateBlocks({
        blocks,
        firstPageLimit,
        regularPageLimit,
        contentWidth,
        typography,
        domMeasureBlock,
    })

    const contentPages = validatePagesWithDom(rawPages, firstPageLimit, regularPageLimit, proseMeasure).map(
        (pageBlocks) => buildMeasuredPage(pageBlocks)
    )

    const totalCharacterCount = contentPages.at(-1)?.endCharacterOffset ?? 0
    const lastContentPage = contentPages.at(-1)
    const canCollapseTerminalPage =
        lastContentPage !== undefined &&
        canMergeTerminalActionPage({
            lastPage: lastContentPage,
            pageLimit: contentPages.length === 1 ? firstPageLimit : regularPageLimit,
            proseMeasure,
            actionMeasure,
        })

    document.body.removeChild(sandbox)

    if (lastContentPage && canCollapseTerminalPage) {
        return [
            ...contentPages.slice(0, -1),
            {
                ...lastContentPage,
                kind: 'content_with_actions',
                hasNextModule,
                primaryActionLabel,
            },
        ]
    }

    return [
        ...contentPages,
        {
            kind: 'post_module_actions',
            startCharacterOffset: totalCharacterCount,
            endCharacterOffset: totalCharacterCount,
            hasNextModule,
            primaryActionLabel,
        },
    ]
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
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    const horizontalPadding = clamp(Math.round(pageWidth  * 0.06), 20, 40)
    const topPadding        = clamp(Math.round(pageHeight * 0.04), 20, 36)
    const bottomPadding     = clamp(Math.round(pageHeight * 0.055), 30, 50)
    const measurementBuffer = isMobile ? 10 : 14
    const contentWidth = Math.max(240, pageWidth - horizontalPadding * 2)
    const contentLimit = Math.max(160, pageHeight - topPadding - bottomPadding)
    const regularPageLimit = Math.max(140, contentLimit - measurementBuffer)

    const typography = defaultTypography(isMobile)

    const sandbox = document.createElement('div')
    sandbox.style.position = 'fixed'
    sandbox.style.left = '-10000px'
    sandbox.style.top = '0'
    sandbox.style.visibility = 'hidden'
    sandbox.style.pointerEvents = 'none'
    sandbox.style.opacity = '0'
    sandbox.style.zIndex = '-1'

    const proseMeasure = document.createElement('div')
    proseMeasure.className = 'prose prose-neutral max-w-none leading-[1.9] text-[#1D1D1F]'
    proseMeasure.style.width = `${contentWidth}px`
    proseMeasure.style.overflow = 'hidden'
    applyTypographyVars(proseMeasure, typography)

    sandbox.appendChild(proseMeasure)
    document.body.appendChild(sandbox)

    const blocks = annotateBlocks(extractMarkdownBlocks(content), typography)

    const domMeasureBlock = (block: MarkdownPageBlock): number => {
        proseMeasure.innerHTML = markdownToHtml(renderBlock(block))
        return proseMeasure.scrollHeight
    }

    const rawPages = paginateBlocks({
        blocks,
        firstPageLimit: regularPageLimit,
        regularPageLimit,
        contentWidth,
        typography,
        domMeasureBlock,
    })

    const pages = validatePagesWithDom(rawPages, regularPageLimit, regularPageLimit, proseMeasure).map(
        (pageBlocks) => joinBlocksMarkdown(pageBlocks)
    )

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
    const pageWidthRatio = isMobile ? PAGE_WIDTH_RATIO_MOBILE : PAGE_WIDTH_RATIO_DESKTOP
    const stagePaddingTop = isMobile ? 16 : 24
    const stagePaddingBottom = isMobile ? 20 : 32
    const indicatorHeight = isMobile ? 42 : 48
    const indicatorGap = isMobile ? 12 : 16
    const arrowAllowance = isMobile ? 64 : 84
    // Horizontal padding inside main below header (keep in sync with UnitEditor stage `px-*`).
    const mainStageHorizontalGutter = isMobile ? 24 : 48
    // Must match the flex `gap` between the two page cards (`gap-4 md:gap-8` in UnitEditor).
    const spreadGap = isMobile ? 16 : 32
    const availableWidth = Math.max(
        360,
        viewportWidth -
            OPEN_SIDEBAR_WIDTH -
            mainStageHorizontalGutter -
            arrowAllowance
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
    const maxPageHeight = Math.min(availableHeight, isMobile ? 680 : viewportHeight * 0.88)
    const spreadWidthByHeight = maxPageHeight * pageWidthRatio * 2 + spreadGap
    const spreadWidth = Math.min(availableWidth, spreadWidthByHeight, isMobile ? 980 : 2000)
    const pageWidth = (spreadWidth - spreadGap) / 2
    const pageHeight = Math.min(maxPageHeight, pageWidth / pageWidthRatio)

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
