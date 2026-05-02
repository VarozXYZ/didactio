# HTML Content Migration — Engineering Spec

> Canonical implementation spec for migrating module body content from Markdown to sanitized HTML.
> Supersedes `html-migration-plan.md` (kept for historical context).

## 0. Status of the project

- **Not in production. No external consumers.**
- All existing Markdown chapters in any environment will be **deleted**. There is no legacy data to preserve. There is no `contentFormat` discriminator in the API or in storage.
- All new chapters are HTML.
- This spec assumes a clean break.

---

## 1. Goal

Replace Markdown as the persisted body format of didactic-unit chapters with sanitized HTML. The HTML must be the single source of truth and produce identical visual output across:

- streaming AI generation
- reopening a previously-generated module
- manual editing
- pagination in the reader
- reading progress
- revisions

Summaries, overviews, and syllabus content are out of scope for the storage change but are rendered through the same HTML pipeline in the reader (via a small `markdown → safe HTML` bridge for these surfaces only).

---

## 2. Architectural decisions (locked)

| # | Decision | Rationale |
|---|---|---|
| 1 | HTML is the canonical persisted body. | Single source of truth. |
| 2 | `htmlBlocks`, `htmlHash`, `htmlBlocksVersion` are derived **cache** persisted alongside the HTML. | Avoid recomputing on every read; allow streaming/reopen parity. |
| 3 | **Backend is the only sanitizer.** Frontend never sanitizes. | Eliminates Node/browser parity risk. Single security boundary. |
| 4 | No `@didactio/shared` package. Sanitizer lives in backend; small block-iteration helpers exist independently in backend and frontend. | Simpler deployment, no workspace gymnastics. |
| 5 | Render frontend HTML via **`html-react-parser`** with a `replace` callback. Never `dangerouslySetInnerHTML`. | Defense in depth, allows component swap-in for code blocks/links. |
| 6 | **TipTap (ProseMirror)** replaces Lexical as the editor. | Schema-first, lossless HTML round-trip, native attribute preservation. |
| 7 | No `contentFormat` field anywhere — public API or storage. | No legacy path; HTML is implicit. |
| 8 | Reading progress is measured in **block index units**, not characters. | Stable across `htmlBlocksVersion` bumps; matches user mental model. |
| 9 | Generation/retry/refund runs as a **server-orchestrated `generation_run`**, decoupled from the HTTP request lifecycle. | Survives client disconnect; idempotent retry; auditable refund. |
| 10 | Streaming emits **complete top-level HTML blocks**, never partial chunks, using parse5 SAX. | Robust against malformed AI output; identical to reopen render. |
| 11 | Continuity between chapters = `textContent` of the **last `<p>`** (or last block) of the previous chapter. No localized fixed headings. | Simple, language-agnostic. |
| 12 | Code is highlighted **client-side post-render** with **Shiki**, lazy-loaded per language. All languages allowed. | Stored HTML stays clean; theme is configurable per unit. |
| 13 | Per-unit visual theme is exposed via **CSS custom properties** on a `.unit-page-scope` wrapper. Edited via a separate "page style" menu, distinct from the editor's "decoration" toolbar. | WYSIWYG between editor and reader; cheap to apply. |
| 14 | Single Docker image, multi-stage build, no monorepo workspace dependencies for shared packages. | Simplest deploy. |

---

## 3. Data model

### 3.1 Chapter shape (backend, persisted)

`backend/src/didactic-unit/didactic-unit-chapter.ts`

```ts
export interface HtmlContentBlock {
  id: string;                    // stable within a (chapter, htmlBlocksVersion)
  type:
    | "heading"
    | "paragraph"
    | "blockquote"
    | "list"
    | "table"
    | "code"
    | "divider";
  html: string;                  // canonical sanitized HTML for this block
  textLength: number;            // grapheme count of textContent
  textStartOffset: number;       // grapheme offset within chapter textContent
  textEndOffset: number;
}

export interface DidacticUnitGeneratedChapter {
  chapterIndex: number;
  title: string;
  html: string;                          // canonical sanitized HTML
  htmlHash: string;                      // sha256(html), recomputed on save/regen
  htmlBlocks: HtmlContentBlock[];        // derived cache
  htmlBlocksVersion: number;             // bump when extraction algorithm changes
  generatedAt: string;
  updatedAt?: string;
}
```

Theme is **not** stored on the chapter. It lives on the unit (override) and the user (default). See §8.

Removed: the `markdown` field; the `contentFormat` field. They do not exist.

### 3.2 Unit shape (theme override) and user shape (theme default)

Unit record gains:
```ts
export interface DidacticUnit {
  // ...existing fields
  presentationTheme: PresentationTheme | null;   // null = inherit from user
}
```

User record gains:
```ts
export interface User {
  // ...existing fields
  defaultPresentationTheme: PresentationTheme;   // seeded with SYSTEM_DEFAULT_THEME at signup
}
```

Resolution rule for a given chapter render:
```
unit.presentationTheme  ?? user.defaultPresentationTheme  ?? SYSTEM_DEFAULT_THEME
```

See §8 for full schema and resolution behavior.

### 3.3 Revisions

```ts
export interface DidacticUnitChapterRevision {
  id: string;
  chapterIndex: number;
  source: "ai_generation" | "ai_regeneration" | "manual_edit";
  chapter: DidacticUnitGeneratedChapter;  // full snapshot incl. html, hash, blocks
  createdAt: string;
}
```

Revisions store full HTML + metadata. Restoring a revision overwrites the current chapter fields with the revision's snapshot and recomputes the hash/blocks from the revision's HTML (idempotent — should match).

### 3.4 Reading progress

`backend/src/didactic-unit/module-reading-progress.ts`

```ts
export interface DidacticUnitModuleReadProgress {
  moduleIndex: number;
  furthestReadBlockIndex: number;           // 0-based, the highest block reached
  furthestReadBlockOffset?: number;         // graphemes into that block (optional)
  furthestReadBlocksVersion: number;        // version under which the index was recorded
  recordedTotalBlocks: number;              // total block count under that version
  chapterCompleted: boolean;                // explicit completion flag
  lastVisitedPageIndex?: number;            // derived cache for fast page restore
  lastReadAt: string;
  lastVisitedAt?: string;
}
```

`readCharacterCount` is removed. The `chapterCompleted` flag exists because index-based math alone cannot represent "100% read" — with 10 blocks, reaching the last block gives `9 / 10 = 90%`, never 100%. The flag is the source of truth for completion; the index is the source of truth for "where am I" / page restore.

**Progress percentage formula:**

```ts
function progressPercentage(p: DidacticUnitModuleReadProgress, totalBlocks: number, currentBlockTextLength: number): number {
  if (p.chapterCompleted) return 1.0;
  if (totalBlocks === 0) return 0;
  const blockFraction =
    p.furthestReadBlockOffset != null && currentBlockTextLength > 0
      ? p.furthestReadBlockOffset / currentBlockTextLength
      : 0;
  return Math.min((p.furthestReadBlockIndex + blockFraction) / totalBlocks, 0.99);
}
```

This caps at 99% until the explicit completion flag flips. Reaching the last block visually displays "almost done" rather than "done", which matches user expectation.

**When `chapterCompleted` flips to true:**
- The user clicks the existing "complete chapter" action (see `complete-didactic-unit-chapter.ts:11`). This API stays as-is semantically — it sets the flag.
- Auto-completion: when the reader detects the last block is fully visible AND the user has dwelled for ≥ 1500 ms, the frontend calls the same complete endpoint. (Optional v1; if dropped, completion is purely user-triggered.)

The existing `complete-didactic-unit-chapter.ts` handler is updated to (a) set `chapterCompleted = true` on the progress record, (b) keep its current side-effects (downstream completion analytics, etc.). It no longer reasons about character totals.

### 3.5 Version migration

When `furthestReadBlocksVersion !== current htmlBlocksVersion` on read:

1. Proportional remap: `newIndex = round(oldIndex / recordedTotalBlocks * currentTotalBlocks)`.
2. Discard `furthestReadBlockOffset` (not meaningful across versions).
3. Discard `lastVisitedPageIndex` (recomputed from the new `newIndex` at render time).
4. **Preserve `chapterCompleted`** — completion is a semantic fact independent of block layout.
5. Persist the remapped values with the current version and `recordedTotalBlocks = currentTotalBlocks`.

`recordedTotalBlocks` is required because, after `htmlBlocksVersion` changes, the old derived block array may no longer exist. Without the historical denominator, proportional remap is not well-defined.

### 3.6 Generation runs

New entity. Persisted in the same store as the unit (or a sibling store).

```ts
export type GenerationRunStatus =
  | "payment_pending"
  | "queued"
  | "running"
  | "retrying"
  | "completed"
  | "failed"
  | "payment_failed";

export interface GenerationRun {
  id: string;
  unitId: string;
  chapterIndex: number;
  userId: string;
  status: GenerationRunStatus;
  attempts: number;                       // 1 or 2; cap at 2
  coinTxId?: string;                      // original charge; set before queued/running
  refundTxId?: string;                    // compensating credit, set on final failure
  emittedBlocks: HtmlContentBlock[];      // for client reconnect/replay
  finalHtml?: string;                     // set on success
  finalHash?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

A chapter has at most one non-terminal (`payment_pending`/`queued`/`running`/`retrying`) run. Subsequent generation requests for the same chapter while a run is in flight return the existing run.

---

## 4. Allow-list (canonical reference)

This is the authoritative allow-list. The backend sanitizer, the TipTap editor configuration, and the frontend paste cleaner all align to this.

### 4.1 Block tags

`h2`, `h3`, `h4`, `p`, `ul`, `ol`, `li`, `blockquote`, `pre`, `code`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `hr`, `br`.

### 4.2 Inline tags

`strong`, `em`, `u`, `code`, `a`, `sub`, `sup`, `mark`.

### 4.3 Attributes

| Tag | Allowed attributes | Constraints |
|---|---|---|
| `a` | `href`, `title`, `target`, `rel` | `target` value must be exactly `_blank`; `rel` value must be exactly `noopener noreferrer`. Both are added by the sanitizer's link-normalization pass (§4.4); they are also accepted on input but normalized to the canonical values. Any other `target`/`rel` value is stripped. |
| `code` (and `pre > code`) | `class` matching `^language-[a-z0-9+#-]+$` | |
| `h2`, `h3`, `h4` | `id` matching `^[a-z0-9][a-z0-9-]*$` | |
| `th` | `scope` (`row`/`col`/`rowgroup`/`colgroup`), `colspan`, `rowspan` | |
| `td` | `colspan`, `rowspan` | |

All other attributes are stripped.

### 4.4 Link normalization

- Allow protocols: `http:`, `https:`, `mailto:`, anchor `#…`.
- Strip: `javascript:`, `data:`, `vbscript:`, `file:`, anything else.
- For external links (host not in `INTERNAL_HOSTS` env list, after parsing): set `target="_blank"` and `rel="noopener noreferrer"`.
- For internal/anchor/mailto: no `target`, no `rel`.
- `INTERNAL_HOSTS` is a comma-separated env var (e.g. `didactio.com,app.didactio.com`).

### 4.5 Heading `id` auto-generation

When the AI emits a heading without an `id`:
1. Slugify the heading's `textContent` (`lowercase`, ASCII-fold, `[^a-z0-9]+ → -`, trim leading/trailing `-`).
2. If empty after slugify, fall back to `section-{index}`.
3. Dedupe against earlier headings in the chapter by appending `-2`, `-3`, …

### 4.6 Repairs and orphan-content handling

- `h1` → `h2`
- `h5`, `h6` → `h4`
- `s`, `strike`, `del`, `ins` → drop tag, keep text content
- `div`, `section`, `article`, `span` → drop tag, keep children
- Anything not on the allow-list → drop tag, keep text content
- Empty inline tags after sanitization → remove
- Empty paragraphs → remove

**Orphan-text policy.** Dropping `div`/`section`/`span` while keeping children can leave bare text or inline runs at the top level (e.g., `<div>Hello</div>` becomes a top-level `Hello` text node, which is not a valid block per §4.1).

The strategy is **trust the prompt + reject on drift**, not auto-repair:

- The AI prompt explicitly forbids `div`, `section`, `article`, `span` and demands every text run be inside a block element (`<p>`, `<li>`, `<blockquote>`, etc.). This is the primary line of defense.
- The sanitizer does **not** auto-wrap orphan text in `<p>`. Auto-wrapping would mask prompt failures and produce unpredictable block structure.
- Block extraction (`extractHtmlBlocks`) treats the presence of any top-level non-block content (text node or inline element) as a structural failure. The chapter is rejected as invalid → triggers the retry path (§5.7), and the second attempt either succeeds or refunds.

Rejection criteria after sanitization:
- No block content at all → reject.
- Any top-level text node with non-whitespace content → reject.
- Any top-level inline element (`<strong>`, `<a>`, `<em>`, etc.) → reject.

This keeps the data model strict and surfaces prompt regressions immediately.

### 4.7 Explicit exclusions

`div`, `section`, `article`, `span`, `h1`, `h5`, `h6` (as final output), `img`, `style`, `script`, `iframe`, `form`, `details`, `summary`, all `style` attributes, all `on*` event handlers, all arbitrary classes, all data attributes.

---

## 5. Backend implementation

### 5.1 Sanitization

**Library:** `sanitize-html` (pinned version in `package.json`).

**File:** `backend/src/html/sanitize.ts`

```ts
export function sanitizeChapterHtml(rawHtml: string): SanitizeResult;

export interface SanitizeResult {
  html: string;          // canonical sanitized HTML
  isEmpty: boolean;      // true when nothing survived sanitization
}
```

Configuration:
- `allowedTags`, `allowedAttributes`, `allowedSchemes`, `transformTags` aligned 1:1 to §4.
- `transformTags`:
  - `h1 → h2`, `h5/h6 → h4`
  - `a` transformer applies link normalization (target/rel)
  - `h2`/`h3`/`h4` transformer assigns `id` if missing (with chapter-scope dedupe state passed in)
- `exclusiveFilter` removes empty inline/paragraph nodes.

Output is **deterministic** for a given input + sanitizer version. Pin `sanitize-html` in lockfile; bump `htmlBlocksVersion` on any sanitizer config change.

### 5.2 Block extraction

**File:** `backend/src/html/extractBlocks.ts`

```ts
export function extractHtmlBlocks(
  sanitizedHtml: string,
  chapterId: string,
): HtmlContentBlock[];
```

Implementation:
- Parse with `parse5.parseFragment`.
- Walk top-level children. For each, classify:
  - `h2`/`h3`/`h4` → `heading`
  - `p` → `paragraph`
  - `blockquote` → `blockquote`
  - `ul`/`ol` → `list`
  - `table` → `table`
  - `pre` → `code`
  - `hr` → `divider`
- Compute `textLength` from descendant text using `Intl.Segmenter` (graphemes, locale-agnostic).
- Compute `textStartOffset`/`textEndOffset` cumulatively across the block array.
- Generate `id` deterministically: `sha1Short(chapterId + ':' + blockIndex + ':' + html).slice(0, 12)`. Stable for the same chapter+content; changes when content changes.
- Re-serialize each block's HTML via `parse5.serialize` for byte-stability.

### 5.3 Hash

```ts
export function computeHtmlHash(html: string): string;
```

`sha256(html)` hex-encoded. Computed only on the canonical (post-sanitization) HTML.

### 5.4 Continuity extraction

**File:** `backend/src/html/extractContinuity.ts`

```ts
export function extractContinuitySummary(sanitizedHtml: string): string;
```

Algorithm:
1. Parse the HTML.
2. Find the last `<p>` among top-level children.
3. If found, use its full descendant `textContent`.
4. Otherwise, use `textContent` of the very last top-level block.
5. Trim, collapse whitespace, cap at 800 characters.
6. Return empty string if nothing useful.

This is the only source of inter-chapter continuity. No localized headings. No translation table.

### 5.5 AI prompt

**File:** `backend/src/ai/prompt-builders.ts`

Replace `buildChapterMarkdownPrompt` with `buildChapterHtmlPrompt`.

Output contract embedded in the prompt:
- Output is HTML only. No JSON, no Markdown, no code fences wrapping the document.
- Allowed tags: explicit list per §4.
- Heading hierarchy: only `h2`, `h3`, `h4`. No `h1`.
- Paragraphs in `<p>`. Lists in `<ul>`/`<ol>` with `<li>`. Code in `<pre><code class="language-X">`.
- The **final paragraph** must be a concise summary or conclusion of the chapter, suitable as context for the next chapter.
- No inline `style` attributes, no `class` attributes other than `language-*` on `code`.
- Headings in sentence case; never include the chapter title as a heading.

Pedagogical contract (6 components, AI-driven structure, not enforced via parsing):
- conceptual explanation
- realistic example
- contrastive analysis (effective vs ineffective approach)
- common mistakes
- reflection activity
- final recap (== final paragraph for continuity)

Removed from the previous prompt:
- fixed 3-question quiz
- separate meta-connection block to next chapter
- localized fixed-heading recap

Continuity context input: pass the previous chapter's continuity summary (from §5.4) as plain text in the prompt.

`buildContinuitySummaryPrompt` is **deleted**. `buildLearnerSummaryPrompt` is kept only if used by a non-chapter surface.

### 5.6 Streaming

**File:** `backend/src/ai/service.ts` + `backend/src/ai/ndjson.ts`

NDJSON event types:

```ts
export type NdjsonEvent =
  | { type: "start"; stage: string; provider: string; model: string }
  | { type: "partial_html_block"; block: HtmlContentBlock }
  | { type: "partial_structured"; data: unknown }
  | { type: "complete"; data: GenerationCompletePayload }
  | { type: "error"; message: string; data?: unknown };

export interface GenerationCompletePayload {
  html: string;
  htmlHash: string;
  htmlBlocks: HtmlContentBlock[];
  htmlBlocksVersion: number;
}
```

`partial_markdown` is removed entirely.

Streaming pipeline (chapter generation):

1. AI gateway returns a token stream (existing `streamText` infrastructure).
2. Pipe tokens into a **`parse5-sax-parser`** instance.
3. Maintain a depth stack of open elements.
4. When a top-level open tag arrives at depth 0, start buffering its serialized output.
5. When the matching close tag arrives (or HTML5 implicit close fires because a new top-level element opens), the block is complete:
   - Sanitize the block's raw HTML through `sanitizeChapterHtml` (block-scoped allow-list).
   - If non-empty, build an `HtmlContentBlock`, persist into `generation_run.emittedBlocks`, and emit `partial_html_block` over NDJSON.
6. On stream end:
   - Force-close any still-open elements via parse5's `_finalizeFragment`.
   - Concatenate all raw block HTML and run a **whole-document sanitization pass** to produce the final canonical HTML.
   - Compute hash, extract blocks (final canonical), extract continuity summary.
   - If final HTML differs from the concatenation of streamed blocks, the canonical version wins. Emit `complete` with the canonical payload.
   - If final HTML is empty (per §4.6): trigger retry path (§6.3).

Streaming pause behavior: emitting only on top-level close means the user may wait several seconds between blocks (especially for `<table>` or long `<pre>`). This is an accepted trade-off — content stability over speed.

**Streamed blocks are provisional, not canonical.** Per-block sanitization runs in isolation, so chapter-scoped derivations differ from the final whole-document pass:

- Heading `id` dedupe (§4.5) is chapter-scoped. Two `<h2>Intro</h2>` headings produce `id="intro"` in each block when sanitized in isolation, but `id="intro"` and `id="intro-2"` after the final whole-document pass.
- Block IDs include the block index (§5.2). The block index in a streamed block is its emission order; the index in the final canonical blocks is its position in the post-canonical-sanitization document. These usually agree but are not guaranteed to.
- The orphan-content rejection (§4.6) only fires on the whole document, not per block.

**Frontend rule:** on `complete`, the frontend **replaces** the streamed block list wholesale with `payload.htmlBlocks`. It does not merge, dedupe, or partially update. The streaming view is a preview optimized for time-to-first-paint; the canonical state on completion is the only state that matters for editing, pagination, and reopen.

### 5.7 Generation runs / coins / refund

**Files:**
- `backend/src/generation-runs/generation-run-store.ts` (replace existing historical-only store)
- `backend/src/generation-runs/generation-run-orchestrator.ts` (new)
- `backend/src/didactic-unit/generate-didactic-unit-chapter.ts` (refactor)

Lifecycle:

1. **Request received** (`POST /api/didactic-unit/:id/modules/:index/generate`):
   - If a non-terminal run exists for this chapter, return the existing `runId`.
   - Else: create a `GenerationRun` row with `status: payment_pending`, `attempts: 0`. Charge coins with metadata `{runId}`. Patch the run with `coinTxId` and `status: queued`. Return `runId` immediately and then start the orchestrator.
   - If charging fails, mark the run `payment_failed` (or delete it before response) so it cannot block future attempts.
2. **Orchestrator** (in-process worker that polls or is signaled by the store):
   - Picks up `queued` run, sets `status: running`, `attempts: 1`.
   - Runs AI streaming pipeline (§5.6). Persists each `emittedBlock` to the run row.
   - On success: set `status: completed`, persist `finalHtml`, `finalHash`. Update the chapter row.
   - On sanitization-empty failure or AI error: set `status: retrying`, `attempts: 2`, restart pipeline with the same prompt.
   - On second failure: set `status: failed`, write a compensating credit ledger entry (`refundTxId`), persist error.
3. **Streaming endpoint** (`GET /api/generation-runs/:runId/stream`):
   - Reads the run row.
   - Replays `emittedBlocks` over NDJSON.
   - Subscribes to a per-run pubsub (Node `EventEmitter` in single-process, or Postgres `LISTEN/NOTIFY` if multi-process) for live blocks.
   - On terminal status, emits `complete` or `error` and closes.
4. **Status endpoint** (`GET /api/generation-runs/:runId`): plain JSON of the run row, for clients that don't need streaming.

Coin ledger constraints:
- Append-only.
- Charge entry references `runId`.
- Refund entry references `coinTxId` (compensating).
- Never reverse the original entry.

#### 5.7.1 Decoupling generation from the HTTP request lifecycle

**Current behavior (must change):** `app.ts:606` defines `createAbortSignal(request)` which wires `request.on("close", () => controller.abort())`. That signal is passed into `streamText` so client disconnect aborts the AI call. This is exactly the wrong behavior for the new lifecycle.

**New behavior:** the orchestrator owns the AbortController, not the request handler. The request handler's only job is to **start** the run and **return the runId**. AI work runs in a detached promise that survives any HTTP disconnect.

```ts
// POST /api/didactic-unit/:id/modules/:index/generate
async function handleGenerate(req, res) {
  const existing = await runStore.findActiveRun(unitId, chapterIndex);
  if (existing) return res.json({ runId: existing.id });

  const run = await runStore.createRun({ unitId, chapterIndex, userId, status: "payment_pending" });
  try {
    const coinTxId = await coins.charge(userId, { runId: run.id });
    await runStore.updateStatus(run.id, "queued", { coinTxId });
  } catch (error) {
    await runStore.updateStatus(run.id, "payment_failed", { errorMessage: String(error) });
    throw error;
  }

  // Detached. NOT awaited. NOT bound to req.on('close').
  void orchestrator.execute(run.id);

  res.json({ runId: run.id });
}
```

Cancellation paths (the only ways the run aborts):
- Explicit `POST /api/generation-runs/:id/cancel` from the user (refund applies).
- Process shutdown signal — orchestrator catches `SIGTERM`, persists `status: failed`, refunds.

The streaming endpoint (`GET /api/generation-runs/:id/stream`) subscribes to a per-run `EventEmitter`. Disconnects on the stream do **not** affect the run. Reconnects replay `emittedBlocks` from the run record then attach to live emissions.

#### 5.7.2 GenerationRunStore replacement

The current `generation-run-store.ts:6` only persists historical completed/failed rows. It must be **replaced**, not extended. The new store supports the full lifecycle:

```ts
interface GenerationRunStore {
  createRun(input: { unitId: string; chapterIndex: number; userId: string; status: "payment_pending" }): Promise<GenerationRun>;
  findActiveRun(unitId: string, chapterIndex: number): Promise<GenerationRun | null>;
  getRun(id: string): Promise<GenerationRun | null>;
  updateStatus(id: string, status: GenerationRunStatus, patch?: Partial<GenerationRun>): Promise<void>;
  appendBlock(id: string, block: HtmlContentBlock): Promise<void>;
  setFinalPayload(id: string, html: string, hash: string): Promise<void>;
  setRefund(id: string, refundTxId: string): Promise<void>;
}
```

A unique index on `(unitId, chapterIndex) WHERE status IN ('payment_pending','queued','running','retrying')` enforces "at most one active run per chapter" at the storage layer.

Per-run pubsub: a Node `EventEmitter` registry keyed by `runId`, populated by the orchestrator and consumed by the streaming endpoint. For multi-process deployments this becomes Postgres `LISTEN/NOTIFY` or Redis pub/sub — single process is fine for v1.

Concurrency: a single in-flight run per `(unitId, chapterIndex)`. Subsequent requests get the existing `runId`.

Client disconnect: orchestrator runs independently of any HTTP connection. Reconnect = new `GET /api/generation-runs/:runId/stream` request, replays `emittedBlocks` and attaches.

### 5.8 API responses

`buildDidacticUnitModuleDetailResponse` in `backend/src/app.ts` returns:

```ts
{
  chapterIndex: number;
  title: string;
  planningOverview: string;
  html: string;                            // canonical sanitized HTML
  htmlHash: string;
  htmlBlocks: HtmlContentBlock[];
  htmlBlocksVersion: number;
  generatedAt: string;
  updatedAt?: string;
}
```

The chapter response **does not** carry theme data. The frontend reads the resolved theme from:
- the unit response (which carries `unit.presentationTheme: PresentationTheme | null`)
- the user response (which carries `user.defaultPresentationTheme: PresentationTheme`)

These are fetched on app load / unit load and cached client-side. No need to redundantly attach them per chapter.

No `content` field, no `contentFormat`, no `markdown`. Clean break.

If `htmlBlocks` are missing or `htmlBlocksVersion` is below current, the endpoint **lazily recomputes and persists** before responding. This is the only write performed by a GET, and it's idempotent.

### 5.9 Edit flow (full-chapter edits)

`backend/src/didactic-unit/update-didactic-unit-chapter.ts`

The endpoint accepts the **full chapter HTML** plus an optimistic-concurrency precondition. The editor visually scopes the user to one page (§6.2.1), but the payload is always the entire chapter. There is no splicing, no boundary repair, no per-page reasoning on the backend.

Input:
```ts
{
  chapter: {
    title: string;
    html: string;                           // full chapter HTML from editor.getHTML()
    htmlHash: string;                       // hash at edit-open time (precondition)
  }
}
```

Pipeline:
1. Load the chapter, compare `htmlHash` to the stored hash. Mismatch → **409 Conflict** (concurrent edit or `htmlBlocksVersion` bumped). Frontend re-fetches and reopens.
2. Sanitize `html` via `sanitizeChapterHtml` — the **same pipeline** used for AI generation output. Heading-id dedupe, paragraph merging, orphan-content rejection (§4.6) all run here naturally.
3. If empty or invalid structure → 422.
4. Compute hash. If the canonical hash equals the stored `htmlHash`, return the current canonical chapter unchanged and do **not** create a revision.
5. Extract blocks.
6. Persist canonical fields + create a `manual_edit` revision (storing the full new chapter snapshot).
7. Return the canonical chapter (full HTML + new blocks + new hash + new version).

Important: the editor's submitted HTML may differ from the canonical version after sanitization (e.g., normalized link `target`/`rel`, deduped heading `id`s, repaired structure). The frontend must replace its editor state with the response and re-paginate.

The page mask is a UX constraint only. Backend integrity is enforced by `htmlHash`, sanitizer, and revision history, not by diffing the edited range. A client may submit any full-chapter HTML for the current hash.

### 5.10 Theme endpoints

Routes follow the existing `/api/didactic-unit/...` and `/api/auth/...` conventions (verified against `app.ts:1166+` and `service.ts`).

Two write surfaces, one validator (§8.4).

`PATCH /api/didactic-unit/:id/theme`
```ts
{ presentationTheme: PresentationTheme | null }   // null clears the override
```
- Validates with the shared theme validator.
- Persists on the unit row.
- Returns the updated unit (which carries `presentationTheme`).

`PATCH /api/auth/me/default-theme`
```ts
{ defaultPresentationTheme: PresentationTheme }
```
- Validates with the shared theme validator.
- Persists on the user row.
- Returns the updated public user object (which carries `defaultPresentationTheme`).

**There is no GET-theme endpoint.** Theme is included in existing responses:

- The unit detail response (currently from `app.ts:1235`, `GET /api/didactic-unit/:id`) gains `presentationTheme: PresentationTheme | null`. This is a backend-additive change in `buildDidacticUnitResponse`.
- The public auth user response (currently from `authClient.ts` consumers and `auth/service.ts:386` `toPublicUser`) gains `defaultPresentationTheme: PresentationTheme`. This is an additive change in `toPublicUser`.
- Both fields land in their respective response builders before the contract switch lands in the frontend.

The frontend reads them once on app/unit load via the existing fetches; no additional round-trip.

### 5.11 Reading progress endpoints

Routes follow the existing convention (`/api/didactic-unit/...`):

`PUT /api/didactic-unit/:id/modules/:index/reading-progress`

Input:
```ts
{
  furthestReadBlockIndex: number;
  furthestReadBlockOffset?: number;
  lastVisitedPageIndex?: number;
}
```

The backend always writes the **current** `htmlBlocksVersion` alongside as `furthestReadBlocksVersion` and `recordedTotalBlocks = chapter.htmlBlocks.length`. This endpoint never sets `chapterCompleted`.

`GET /api/didactic-unit/:id/modules/:index/reading-progress` performs the version-mismatch remap (§3.5) inline before returning.

`POST /api/didactic-unit/:id/modules/:index/complete` (existing route, semantics updated) — sets `chapterCompleted = true` on the progress record and runs existing completion side-effects.

### 5.12 Files to add/modify/delete (backend)

**Add:**
- `backend/src/html/sanitize.ts`
- `backend/src/html/extractBlocks.ts`
- `backend/src/html/extractContinuity.ts`
- `backend/src/html/computeHash.ts`
- `backend/src/generation-runs/generation-run-store.ts` (replace existing store)
- `backend/src/generation-runs/generation-run-orchestrator.ts`
- `backend/src/presentation-theme/types.ts` (defines `PresentationTheme`, `SYSTEM_DEFAULT_THEME`)
- `backend/src/presentation-theme/validate.ts` (single validator used by both write endpoints)
- `backend/src/auth/update-default-theme.ts` (handler for `PATCH /api/auth/me/default-theme`)
- `backend/src/didactic-unit/update-unit-theme.ts` (handler for `PATCH /api/didactic-unit/:id/theme`)
- `backend/src/types/contentTypes.ts` (shared type defs, duplicated minimally on FE)

**Modify:**
- `backend/src/didactic-unit/didactic-unit-chapter.ts` — new shape, drop `markdown`, drop `contentFormat`, drop `presentationTheme` from chapter
- `backend/src/didactic-unit/create-didactic-unit.ts` — initialize unit with `presentationTheme: null`
- `backend/src/didactic-unit/generate-didactic-unit-chapter.ts` — orchestrator-driven now
- `backend/src/didactic-unit/update-didactic-unit-chapter.ts` — accept `html`, sanitize, persist
- `backend/src/didactic-unit/list-didactic-unit-chapters.ts`
- `backend/src/didactic-unit/summarize-didactic-unit.ts`
- `backend/src/didactic-unit/module-reading-progress.ts` — block-based progress, remove markdown counting
- `backend/src/auth/service.ts` — `toPublicUser` adds `defaultPresentationTheme`; signup seeds it with `SYSTEM_DEFAULT_THEME`
- `backend/src/auth/...` user record / store — persist `defaultPresentationTheme`
- `backend/src/ai/service.ts` — parse5-driven streaming, drop markdown normalization
- `backend/src/ai/prompt-builders.ts` — `buildChapterHtmlPrompt`
- `backend/src/ai/ndjson.ts` — `partial_html_block` event
- `backend/src/app.ts` — response shape, new endpoints for generation-run and theme writes

**Delete:**
- `backend/src/ai/markdown-parsers.ts` (any markdown-specific normalization for chapter bodies)
- `buildContinuitySummaryPrompt` if unused elsewhere
- All markdown-specific test fixtures for chapter bodies
- Any storage migration code that handled the old shape

---

## 6. Frontend implementation

### 6.1 Renderer

**Library:** `html-react-parser` (preferred over `interweave` for bundle size and React idioms).

**File:** `frontend/src/dashboard/components/ChapterRenderer.tsx`

```tsx
import parse, { Element } from "html-react-parser";

export function ChapterRenderer({ html }: { html: string }) {
  const tree = useMemo(
    () => parse(html, { replace: domToComponent }),
    [html],
  );
  return <>{tree}</>;
}

function domToComponent(node: any) {
  if (node instanceof Element && node.name === "pre") {
    const codeChild = node.children.find(
      (c: any) => c instanceof Element && c.name === "code",
    );
    if (codeChild) {
      const langClass = codeChild.attribs?.class ?? "";
      const lang = langClass.replace(/^language-/, "") || "text";
      const code = extractText(codeChild);
      return <CodeBlock language={lang} code={code} />;
    }
  }
  // pass through everything else
}
```

The renderer is used in three places, all wrapped in `.unit-page-scope`:
- the reader (paginated)
- the streaming view (block-by-block during generation)
- the editor preview (TipTap renders its own DOM, but the same scope wrapper ensures style parity)

Memoization is keyed by `block.html` for block-level rendering and `chapter.htmlHash` for full-chapter rendering.

### 6.2 TipTap editor

**Files:**
- `frontend/src/dashboard/components/Editor/TiptapEditor.tsx`
- `frontend/src/dashboard/components/Editor/EditorToolbar.tsx`
- `frontend/src/dashboard/components/Editor/extensions/PasteCleaner.ts`
- `frontend/src/dashboard/components/Editor/extensions/HeadingWithId.ts`
- `frontend/src/dashboard/components/Editor/extensions/PageMask.ts`
- `frontend/src/dashboard/components/Editor/extensions/SelectionClamp.ts`
- `frontend/src/dashboard/components/Editor/pasteAllowList.ts`

Dependencies (add):
```
@tiptap/core
@tiptap/react
@tiptap/pm
@tiptap/starter-kit
@tiptap/extension-link
@tiptap/extension-underline
@tiptap/extension-subscript
@tiptap/extension-superscript
@tiptap/extension-highlight
@tiptap/extension-table
@tiptap/extension-table-row
@tiptap/extension-table-cell
@tiptap/extension-table-header
@tiptap/extension-code-block-lowlight
lowlight
```

Dependencies (remove): all `lexical` and `@lexical/*`.

Editor configuration:

```ts
const editor = useEditor({
  content: initialHtml,
  extensions: [
    StarterKit.configure({
      heading: false,                     // use HeadingWithId instead
      codeBlock: false,                   // use CodeBlockLowlight
      strike: false,                      // not in allow-list
    }),
    HeadingWithId.configure({ levels: [2, 3, 4] }),
    Underline,
    Subscript,
    Superscript,
    Highlight.configure({ multicolor: false }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      validate: (href) => /^(https?:|mailto:|#)/.test(href),
      HTMLAttributes: { rel: "noopener noreferrer" },
    }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    CodeBlockLowlight.configure({ lowlight }),  // keeps language- class
    PasteCleaner,
  ],
  editorProps: {
    attributes: { class: "unit-page-scope tiptap-editor" },
  },
  onUpdate: ({ editor }) => {
    onHtmlChange(editor.getHTML());
  },
});
```

`HeadingWithId` extension: extends the default `Heading` by adding an `id` attribute that round-trips via `parseHTML`/`renderHTML`.

`PasteCleaner` extension: implements `transformPastedHTML` to strip everything not in the allow-list (drops `style`, `class` other than `language-*` on `code`, `id` other than on `h2`/`h3`/`h4`, `<o:p>`, MS-Office namespaces, all disallowed tags but keeps their text content).

Save flow:
1. `editor.getHTML()` on save returns the **full chapter HTML**.
2. `PATCH /api/didactic-unit/:id/modules/:index` with that full HTML + `htmlHash` precondition.
3. Backend sanitizes the whole chapter, recomputes blocks/hash, returns the canonical chapter.
4. Frontend re-paginates from the canonical response and reopens the editor at the page containing the cursor's pre-save position.

#### 6.2.1 Editing model: full-chapter document, page-masked UX

The reader is paginated and read-only. The editor **loads the full chapter HTML** as a single TipTap document but **visually exposes only the current page** to the user. Saving sends the full chapter; the backend re-sanitizes and recomputes blocks. There is no splicing, no offset arithmetic, no boundary-repair logic.

**Why not splice?** A "page" is generally not a valid independent HTML document segment. Page boundaries can fall mid-paragraph, mid-list-item, or duplicate a `<thead>` for display-only purposes. Splicing edited page fragments back into the canonical document corrupts structure in subtle ways (one paragraph becomes two, a list item is silently bisected, a synthetic repeated `<thead>` is persisted as canonical content). Editing the full document avoids every one of these failure modes by construction — the same whole-document sanitizer that handles AI output handles editor output, with zero new boundary logic.

**Model:**

- The chapter is one canonical HTML document with `htmlBlocks: HtmlContentBlock[]`.
- The reader paginates that HTML for display (§6.5). Pagination is a **read-only display concern**.
- When the user clicks "edit", TipTap loads the **entire** `chapter.html`. The user can move the cursor and select text only within the current page; everything else is visually masked and selection-locked.
- On save, `editor.getHTML()` returns the full chapter. The backend sanitizes and recomputes everything from scratch. The whole-document sanitization pass is the same one used for AI generation output (§5.6) — heading-id dedupe, paragraph merging at boundaries, orphan-content rejection (§4.6), all handled identically.

**Page masking** (`frontend/src/dashboard/components/Editor/extensions/PageMask.ts`):

A TipTap `Plugin` that:
1. At edit-open, runs the same pagination algorithm used by the reader against the editor's rendered DOM. Records both the display block/offset boundaries and the exact ProseMirror selection positions for the current page:
   ```ts
   {
     pageStartBlockIndex: number;
     pageEndBlockIndex: number;
     pageStartTextOffset?: number;
     pageEndTextOffset?: number;
     pageStartPmPos: number;
     pageEndPmPos: number;
   }
   ```
2. **Freezes those boundaries for the session.** Does not re-paginate as the user types. If typing grows content beyond the original page height, the interactive page area becomes internally scrollable. Other pages remain masked and non-interactive. Canonical pagination happens on save via the backend response.
3. Renders an absolutely-positioned mask overlay above and below the current page area (semi-opaque or themed to the page background) using `clip-path` or stacked overlays. Other pages are visually hidden but the DOM is intact (do **not** use `display: none` — it breaks contenteditable cursor math).
4. Disables scroll on the editor's outer container; only the page area is interactive.

**Selection clamping** (`frontend/src/dashboard/components/Editor/extensions/SelectionClamp.ts`):

A TipTap `Plugin` that observes selection transactions:
- If the new selection's `anchor` or `head` lies outside `[pageStartPmPos, pageEndPmPos]`, the transaction is rewritten so both endpoints clamp to the nearest in-range ProseMirror position.
- Intercepts and handles: arrow-key navigation past page bounds, `Page Up`/`Page Down`, `Ctrl+Home`/`Ctrl+End`, mouse-drag selection, mouse click in masked areas.
- Paste at the page boundary inserts content at the clamped position.

Test coverage is essential — every keystroke path that can move the cursor needs a test (§9.2 expanded).

**Edit-save payload:**

```ts
{
  chapter: {
    title: string;
    html: string;                  // editor.getHTML() — the FULL chapter
    htmlHash: string;              // chapter hash at edit-open time (optimistic-concurrency precondition)
  }
}
```

**Backend handler** (`update-didactic-unit-chapter.ts`):

1. Validate `htmlHash` matches the currently stored chapter hash. Mismatch → **409 Conflict** (someone else edited, or `htmlBlocksVersion` bumped). Frontend re-fetches and reopens.
2. Sanitize `html` via `sanitizeChapterHtml` (the same pipeline that handles AI output).
3. If empty or fails the orphan-content check (§4.6) → 422.
4. Compute hash. If unchanged, return the current canonical chapter and do not create a revision.
5. Extract blocks.
6. Persist canonical fields + create a `manual_edit` revision (full snapshot).
7. Return the canonical chapter (full HTML + new blocks + new hash + new version).

**Concurrency.** The `htmlHash` precondition prevents lost updates from concurrent tab edits. On 409, the frontend shows a non-destructive prompt: "This chapter was modified elsewhere. Reload to see the latest version." (Drafts can be recovered from the editor state if needed.)

**Integrity boundary.** The page mask is not a backend-enforced edit range. It is a UX affordance. The backend accepts a full-chapter replacement for the current `htmlHash`, then relies on sanitization, hash preconditions, and revision history.

**Cursor restoration after save.** Before save, capture the cursor's grapheme offset within the chapter's `textContent`. After the canonical response arrives, re-paginate, find the page containing that offset, and open the reader/editor there with the cursor positioned at the closest valid offset. Best-effort; one block of drift is acceptable.

**Undo history.** TipTap's undo stack covers the entire edit session and operates on the full chapter document. Closing the editor or saving discards the stack. Chapter-wide revert uses the existing revisions UI.

**What this rules out:**
- Visible cross-page editing.
- Cursor escape into masked content (selection clamp prevents this).
- Splicing complexity in the backend.

**What this requires:**
- Robust page-mask rendering (CSS, not DOM hiding).
- Robust selection clamp (every keystroke path tested).
- Loading the full chapter into TipTap on every edit-open (acceptable — chapters are bounded in size; performance budget §9.4 covers this).

### 6.3 Decoration toolbar (separate from page-style menu)

**File:** `frontend/src/dashboard/components/Editor/EditorToolbar.tsx`

Purpose: insert/remove **inline decorations and structural elements** (the "what is this content" controls).

Layout (left to right, with `|` denoting visual separators):

```
Undo  Redo  |  Block-dropdown(P, H2, H3, H4)  |  Bold  Italic  Underline  |  Mark  Sub  Sup  |  UL  OL  Blockquote  |  Link  CodeBlock  |  TableInsert  HR
```

Inline-format group order (Bold → Italic → Underline) follows the convention from Word, Docs, Notion. `<u>` sits immediately after `<i>`, separated by a divider from the more semantic marks (`<mark>`, `<sub>`, `<sup>`).

Code block button has a small caret that opens a language picker (typeahead input over Shiki's language list). Default `language-text` if the user picks none.

This menu **never** changes colors, fonts, sizes, or any visual styling. It only affects content semantics.

#### 6.3.1 Table contextual mini-toolbar

When the cursor is inside a table cell, a compact contextual toolbar appears anchored above the table (TipTap's `BubbleMenu` extension, scoped via `shouldShow: ({ editor }) => editor.isActive('table')`).

Buttons (icon-only, with tooltips):
- Add row above
- Add row below
- Add column before
- Add column after
- Toggle header row
- Delete row
- Delete column
- Delete table

This avoids cluttering the main toolbar with table actions that are only relevant ~5% of the time, while keeping discoverability when the user is actually editing a table.

### 6.4 Page-style menu (per-unit theme override)

**File:** `frontend/src/dashboard/components/Editor/PageStyleMenu.tsx`

Purpose: edit the unit-level `presentationTheme` override. When the unit has no override (`presentationTheme === null`), the menu is pre-filled with the resolved theme (user default) so the user can see the starting point before editing.

**Surface:** a single trigger button on the editor chrome (icon: `Palette` or `Type`, label "Page style") that opens a floating popover card anchored to the button — the same pattern used today by `ChapterStyleMenu` (Settings2 icon → click-out-dismissable popover). The card holds the theme controls and live-previews against `.unit-page-scope`. Closing the card persists pending changes. No modal, no full drawer — just a popover card, exactly like the current style menu.

Controls (live-preview against the same `.unit-page-scope` as the editor):
- Body font family: Sans / Serif / Mono
- Body font size: 14 / 16 / 18 / 20 px
- Heading font family: Sans / Serif / Mono
- Heading scale: Compact / Normal / Spacious
- Paragraph alignment: Left / Center / Right / Justify
- Paragraph spacing: Compact / Normal / Spacious
- Line height: 1.4 → 1.8 (slider, step 0.1)
- Body color (color picker)
- Heading color (color picker)
- Accent color (color picker — links + `<mark>`)
- Blockquote accent (color picker — left border)
- Code background (color picker)
- Page background (color picker)
- "Reset to my default" button — sets `unit.presentationTheme = null`, falls back to user default
- "Save as my default" button — copies current values to `user.defaultPresentationTheme`

This menu is presented as a **separate panel/dialog** from the decoration toolbar. The two never share UI surface area — they have different mental models and different audiences (decoration is per-edit; page style is per-unit).

Save: theme persists on `unit.presentationTheme`. Backend validates per §8.4.

### 6.4.1 User-settings theme menu (default theme)

**File:** `frontend/src/dashboard/components/UserSettings/DefaultThemeMenu.tsx`

Purpose: edit `user.defaultPresentationTheme` — the theme used by every unit that hasn't set its own override.

Controls: identical to §6.4 (same `PresentationTheme` schema). Reuse the inner form component between the two surfaces.

Save: persists on `user.defaultPresentationTheme`. Affects all units with `presentationTheme === null` immediately on next render.

Note: changing the user default does **not** retroactively modify units that have explicit overrides. Those keep their overrides until the user resets them.

### 6.5 Pagination

**File:** `frontend/src/dashboard/pageLayout.ts` (rewrite)
**Helpers:** `frontend/src/dashboard/utils/htmlBlocks.ts`, `frontend/src/dashboard/utils/blockSplit.ts`

Drop `extractMarkdownBlocks` and all markdown-related types. Replace with HTML-block consumption.

Page block type:
```ts
type ContentPageBlock =
  | { type: "heading"; level: 2 | 3 | 4; html: string; text: string; id?: string }
  | { type: "paragraph"; html: string; text: string; splittable: true }
  | { type: "blockquote"; html: string; text: string; splittable: true }
  | { type: "list"; html: string; ordered: boolean; items: HtmlListItem[] }
  | { type: "table"; html: string; clusters: HtmlTableRowCluster[]; thead?: string }
  | { type: "code"; html: string; language: string; lines: string[] }
  | { type: "divider"; html: string };
```

Splitter helpers (file: `blockSplit.ts`):

| Helper | Behavior |
|---|---|
| `cloneNodeAtTextOffset(node, offset)` | Walks the block's DOM in document order using `Intl.Segmenter` for grapheme-aware offset counting. At `offset`, clones the parent inline chain (`strong`, `em`, `u`, `code`, `a`, `mark`, `sub`, `sup`) to both sides. `id` attributes stay on the first half. `href` is duplicated (acceptable). |
| `splitTextBlock(block, availableHeight)` | Used for `paragraph`, `blockquote`. Binary-search the offset that fits in `availableHeight`. |
| `splitListBlock(block, availableHeight)` | Splits at item boundaries, never mid-item. Reconstructs `ul`/`ol` wrapper on each fragment. |
| `splitTableByClusters(block, availableHeight)` | Splits at row-cluster boundaries (a cluster = consecutive rows joined by any `rowspan`). Repeats `<thead>` on each fragment. If a single cluster is taller than the page, falls back to overflow render with a "(continued)" indicator. |
| `splitCodeByLines(block, availableHeight)` | Splits at line boundaries. Each fragment is `<pre><code class="language-X">…</code></pre>`. |
| `getBlockTextLength(block)` | Returns grapheme count of `textContent`. |

Headings, dividers: indivisible. If they don't fit in remaining page space, they push to the next page.

Table row clusters: computed during pagination block prep by walking rows, tracking active `rowspan` extents, and grouping rows whose `rowspan` overlaps.

### 6.6 Streaming consumption

**File:** `frontend/src/dashboard/components/Editor/UnitEditor.tsx` (refactor)
**Hook:** `frontend/src/dashboard/hooks/useGenerationRunStream.ts` (new)

Flow:
1. On generate click, `POST /api/didactic-unit/:id/modules/:index/generate` → receive `runId`. Store in component state.
2. Open NDJSON stream via `GET /api/generation-runs/:runId/stream`.
3. On `partial_html_block`: append to a **provisional** block list; render block via `ChapterRenderer` with a fade-in animation.
4. On `complete`: **discard the provisional list and replace** with `payload.htmlBlocks`. Set `html`/`hash`/`htmlBlocksVersion`. This is the only state that survives. Streamed blocks are previews; the canonical payload wins (see §5.6).
5. On `error`: show error UI; offer manual retry (which creates a new run if the current one is in `failed` state).
6. On disconnect: hook auto-reconnects with exponential backoff. The stream replays `emittedBlocks` from the run record before resuming live.

Animation: per-block fade-in (CSS), respecting `prefers-reduced-motion` (no animation if set). No character-by-character animation.

### 6.7 Reading progress in the reader

`frontend/src/dashboard/hooks/useReadingProgress.ts` (refactor)

- Track current visible block index based on viewport intersection (IntersectionObserver) over the rendered block elements.
- On scroll, debounce-update `furthestReadBlockIndex` (only ever moves forward — clamps to its previous value if the user scrolls back) and (optionally) `furthestReadBlockOffset`.
- The reader watches the last block; when fully visible and dwelled ≥ 1500 ms, calls `POST /api/didactic-unit/:id/modules/:index/complete` to set `chapterCompleted`. Manual "Mark complete" button calls the same endpoint.
- On version mismatch from the API, accept the remapped values and continue.

### 6.8 Files to add/modify/delete (frontend)

**Add:**
- `frontend/src/dashboard/components/ChapterRenderer.tsx`
- `frontend/src/dashboard/components/CodeBlock.tsx`
- `frontend/src/dashboard/components/CodeBlockSkeleton.tsx`
- `frontend/src/dashboard/components/UnitPageScope.tsx`
- `frontend/src/dashboard/components/Editor/TiptapEditor.tsx`
- `frontend/src/dashboard/components/Editor/EditorToolbar.tsx`
- `frontend/src/dashboard/components/Editor/PageStyleMenu.tsx`
- `frontend/src/dashboard/components/Editor/PresentationThemeForm.tsx` (shared form used by both PageStyleMenu and DefaultThemeMenu)
- `frontend/src/dashboard/components/UserSettings/DefaultThemeMenu.tsx`
- `frontend/src/dashboard/components/Editor/extensions/PasteCleaner.ts`
- `frontend/src/dashboard/components/Editor/extensions/HeadingWithId.ts`
- `frontend/src/dashboard/components/Editor/extensions/PageMask.ts`
- `frontend/src/dashboard/components/Editor/extensions/SelectionClamp.ts`
- `frontend/src/dashboard/components/Editor/pasteAllowList.ts`
- `frontend/src/dashboard/hooks/useGenerationRunStream.ts`
- `frontend/src/dashboard/hooks/useResolvedTheme.ts` (resolves unit override → user default → system default)
- `frontend/src/dashboard/utils/htmlBlocks.ts`
- `frontend/src/dashboard/utils/blockSplit.ts`
- `frontend/src/dashboard/utils/themeVars.ts`
- `frontend/src/dashboard/utils/defaultTheme.ts` (`SYSTEM_DEFAULT_THEME` constant)
- `frontend/src/dashboard/utils/shikiClient.ts` (`SHIKI_THEME` constant + lazy highlighter)
- `frontend/src/types/contentTypes.ts`
- `frontend/src/types/presentationTheme.ts`

**Modify:**
- `frontend/src/dashboard/api/dashboardApi.ts` — drop markdown-related fields; add HTML+blocks+hash+theme; add generation-run endpoints
- `frontend/src/dashboard/types.ts` — replace `DidacticUnitEditorChapter` markdown fields with HTML
- `frontend/src/dashboard/adapters.ts` — drop `normalizeStoredMarkdown` for chapter bodies; reading time from HTML text length
- `frontend/src/dashboard/components/Editor/UnitEditor.tsx` — TipTap editor, new toolbar, new page-style menu, generation-run streaming
- `frontend/src/dashboard/components/Editor/ChapterStyleMenu.tsx` — folded into `PageStyleMenu.tsx` or removed
- `frontend/src/dashboard/pageLayout.ts` — rewrite for HTML blocks
- `frontend/src/dashboard/utils/typography.ts` — extend with theme-derived CSS vars
- `frontend/src/dashboard/utils/fontLoader.ts` — load fonts based on theme
- `frontend/src/index.css` — `.unit-page-scope` styles for every allow-list tag, all driven by CSS vars
- `frontend/package.json` — add tiptap/html-react-parser/shiki/parse5 deps; remove lexical
- `backend/package.json` — add sanitize-html, parse5, parse5-sax-parser; remove markdown deps no longer used
- root `package.json` — no workspace structural change (workspaces already cover frontend/backend); only deps as needed

**Delete:**
- `frontend/src/dashboard/components/Editor/LexicalMarkdownEditor.tsx`
- `frontend/src/dashboard/components/Editor/LexicalToolbar.tsx`
- `frontend/src/dashboard/utils/markdown.ts` for **chapter body** paths only. Keep markdown utilities used by syllabus/summaries with a clear file boundary (rename if needed for clarity).
- All markdown-related dashboard tests for chapter bodies.

---

## 7. Code highlighting

### 7.1 Library and strategy

**Shiki** (TextMate-grammar-based, VS Code engine). Lazy-loaded.

Architecture: client-side, post-render. Stored HTML is plain `<pre><code class="language-X">code text</code></pre>`. Highlighting happens inside the `<CodeBlock>` React component.

### 7.2 Language coverage and theme

**All Shiki-supported languages are allowed.** No restriction list. The `class` attribute on `<code>` may be `language-X` for any `X` matching `^[a-z0-9+#-]+$`.

**Theme is a system-wide constant tied to the app's color mode.** Defined in `frontend/src/dashboard/utils/shikiClient.ts`:

```ts
export const SHIKI_THEME_LIGHT = "min-light";
export const SHIKI_THEME_DARK = "one-dark-pro";

// v1 ships light mode only. When dark mode is implemented, this constant
// becomes a function/hook that returns the active theme based on color mode.
export const SHIKI_THEME = SHIKI_THEME_LIGHT;
```

Theme is **not** configurable from the page-style menu, **not** stored on user or unit. It tracks the color mode of the app, nothing else. When dark mode is added later, the swap point is this single constant — replace the export with a hook (`useShikiTheme()`) that returns `SHIKI_THEME_LIGHT` or `SHIKI_THEME_DARK` based on the active color mode, and pass the result to `useShikiHtml`. No other call site needs to change.

Loader strategy:
- A central Shiki "highlighter" instance is lazily initialized on first code block render.
- Languages are loaded **on demand**: the first `<CodeBlock>` for language `X` triggers `shiki.loadLanguage(X)`. Subsequent uses are cached in-memory.
- If a language is unknown to Shiki, fall back to plain monospace (no highlighting), no error to the user.
- The theme bundle is loaded once at first highlight and reused. v1 only ever loads `min-light`. When dark mode arrives, both themes will load on first use of each.

### 7.3 `CodeBlock` component

While Shiki + grammar load, the component shows a **skeleton/spinner placeholder** sized to roughly match the eventual code block (number of lines × line-height). When Shiki resolves, the placeholder is replaced with the highlighted output.

```tsx
function CodeBlock({ language, code }: { language: string; code: string }) {
  const html = useShikiHtml(code, language); // cached, async; returns null while loading
  if (html === null) {
    return <CodeBlockSkeleton lineCount={code.split("\n").length} language={language} />;
  }
  return <div className="code-block" dangerouslySetInnerHTML={{ __html: html }} />;
}
```

`CodeBlockSkeleton` renders a `<pre>` with `lineCount` shimmer rows, sized to the same line-height as the final `<pre>` so there is no layout shift when the swap happens.

The `dangerouslySetInnerHTML` use here is acceptable because the input is the controlled output of Shiki on backend-sanitized text content — Shiki cannot produce a script tag, only `<span>` tokens with class names.

Cache: in-memory `Map` keyed by `${language}|${code}`. Pagination split fragments hit the cache for repeated content.

### 7.4 Pagination interaction

- Code blocks split on **complete logical lines** (`code.split('\n')`).
- Each split fragment is its own `<CodeBlock>` and is highlighted independently.
- Multi-line constructs split across pages (e.g., a string literal that wraps) may render with a slightly off color start on the second fragment. **This is an accepted trade-off.**
- The `language-X` class is repeated on every fragment.

### 7.5 Bundle impact

- Shiki core: ~30 KB gz, lazy-loaded (not in initial bundle).
- Each grammar: ~5–30 KB gz, lazy-loaded per language.
- Each theme: ~2–10 KB gz, lazy-loaded.
- The first code block in a chapter triggers a loading spinner for ~200–500 ms; subsequent blocks of the same language are instant.

---

## 8. Visual theme system (per-user default + per-unit override)

### 8.1 Schema

```ts
export interface PresentationTheme {
  // Typography
  bodyFont: "sans" | "serif" | "mono";
  bodyFontSize: 14 | 16 | 18 | 20;
  headingFont: "sans" | "serif" | "mono";
  headingScale: "compact" | "normal" | "spacious";
  paragraphAlign: "left" | "center" | "right" | "justify";
  paragraphSpacing: "compact" | "normal" | "spacious";
  lineHeight: number;            // [1.2, 2.0], step 0.1

  // Colors (CSS color strings, validated)
  bodyColor: string;
  headingColor: string;
  accentColor: string;
  blockquoteAccent: string;
  codeBackground: string;
  pageBackground: string;
}
```

The Shiki code theme is **not** part of `PresentationTheme`. It is a system-wide constant for v1 (see §7).

### 8.2 Storage and resolution

Two persistence sites, one resolution rule.

**User-level default** (per-user setting, edited from a "User Settings" surface):
```ts
// stored on the user record
defaultPresentationTheme: PresentationTheme;
```

**Per-unit override** (optional, edited from the page-style menu):
```ts
// stored on the unit record
presentationTheme: PresentationTheme | null;   // null = inherit user default
```

**Resolution at render time** (frontend hook `useResolvedTheme(unit, user)`):

```
unit.presentationTheme  ?? user.defaultPresentationTheme  ?? SYSTEM_DEFAULT_THEME
```

`SYSTEM_DEFAULT_THEME` is a hardcoded constant in `frontend/src/dashboard/utils/defaultTheme.ts` (also imported by backend for new-user seeding). It produces the v1 default appearance.

### 8.3 Defaults

- A new user has `defaultPresentationTheme = SYSTEM_DEFAULT_THEME` at signup.
- A new unit has `presentationTheme = null` (inherits the user's default).
- "Reset to user default" in the page-style menu sets `unit.presentationTheme = null`.
- "Reset to system default" in user settings sets `user.defaultPresentationTheme = SYSTEM_DEFAULT_THEME`.

### 8.3 Application

`UnitPageScope` component:

```tsx
function UnitPageScope({
  theme,
  children,
}: {
  theme: PresentationTheme;
  children: ReactNode;
}) {
  const style = themeVars(theme); // { '--unit-body-font': ..., ... }
  return (
    <div className="unit-page-scope" style={style}>
      {children}
    </div>
  );
}
```

CSS in `frontend/src/index.css`:

```css
.unit-page-scope {
  --unit-body-font: var(--font-sans);
  --unit-body-size: 16px;
  --unit-line-height: 1.6;
  --unit-body-color: #1a1a1a;
  --unit-heading-color: #0a0a0a;
  --unit-heading-font: var(--font-sans);
  --unit-accent-color: #2563eb;
  --unit-blockquote-accent: #d4d4d4;
  --unit-code-bg: #f5f5f5;
  --unit-page-bg: #ffffff;
  --unit-paragraph-align: left;
  --unit-heading-scale: 1;
  --unit-paragraph-margin: 0.85em;

  background: var(--unit-page-bg);
  color: var(--unit-body-color);
  font-family: var(--unit-body-font);
  font-size: var(--unit-body-size);
  line-height: var(--unit-line-height);
}

.unit-page-scope p {
  margin-block: var(--unit-paragraph-margin);
  text-align: var(--unit-paragraph-align);
}
.unit-page-scope h2,
.unit-page-scope h3,
.unit-page-scope h4 {
  color: var(--unit-heading-color);
  font-family: var(--unit-heading-font);
}
.unit-page-scope h2 { font-size: calc(1.5em * var(--unit-heading-scale)); }
.unit-page-scope h3 { font-size: calc(1.25em * var(--unit-heading-scale)); }
.unit-page-scope h4 { font-size: calc(1.1em * var(--unit-heading-scale)); }
.unit-page-scope a { color: var(--unit-accent-color); }
.unit-page-scope mark {
  background: var(--unit-accent-color);
  color: #fff;
  padding: 0 0.1em;
  border-radius: 2px;
}
.unit-page-scope blockquote {
  border-left: 4px solid var(--unit-blockquote-accent);
  padding-left: 1em;
  font-style: italic;
}
.unit-page-scope code {
  background: var(--unit-code-bg);
  padding: 0.1em 0.3em;
  border-radius: 3px;
  font-family: var(--font-mono);
}
.unit-page-scope pre {
  background: var(--unit-code-bg);
  padding: 1em;
  border-radius: 6px;
  overflow-x: auto;
}
.unit-page-scope ul,
.unit-page-scope ol {
  padding-left: 1.5em;
  margin: 0.5em 0;
}
.unit-page-scope table {
  border-collapse: collapse;
  width: 100%;
}
.unit-page-scope th,
.unit-page-scope td {
  border: 1px solid var(--unit-blockquote-accent);
  padding: 0.4em 0.6em;
}
.unit-page-scope hr {
  border: 0;
  border-top: 1px solid var(--unit-blockquote-accent);
  margin: 1.5em 0;
}
.unit-page-scope sub,
.unit-page-scope sup { font-size: 0.75em; }
```

`themeVars(theme)`:

```ts
export function themeVars(t: PresentationTheme): CSSProperties {
  return {
    "--unit-body-font": fontFamily(t.bodyFont),
    "--unit-body-size": `${t.bodyFontSize}px`,
    "--unit-line-height": String(t.lineHeight),
    "--unit-body-color": t.bodyColor,
    "--unit-heading-color": t.headingColor,
    "--unit-heading-font": fontFamily(t.headingFont),
    "--unit-accent-color": t.accentColor,
    "--unit-blockquote-accent": t.blockquoteAccent,
    "--unit-code-bg": t.codeBackground,
    "--unit-page-bg": t.pageBackground,
    "--unit-paragraph-align": t.paragraphAlign,
    // headingScale, paragraphSpacing translated to discrete CSS values:
    "--unit-heading-scale": headingScaleFactor(t.headingScale),
    "--unit-paragraph-margin": paragraphSpacingValue(t.paragraphSpacing),
  } as CSSProperties;
}
```

### 8.4 Validation (backend)

Validators in `backend/src/presentation-theme/validate.ts`:

- Fonts: must be one of the enum values.
- Sizes/scales/alignment/spacing: must match the enum.
- Line height: numeric, range `[1.2, 2.0]`.
- Colors: regex match against `#hex`, `rgb(...)`, `rgba(...)`, `hsl(...)`, `hsla(...)`, or named-color list. **Reject** anything containing `url(`, `expression(`, `var(`, `(` of an unrecognized function, or HTML escapes.
- Same validator runs for both write paths: `PATCH /api/didactic-unit/:id/theme` and `PATCH /api/auth/me/default-theme`.

### 8.5 Application sites

The `.unit-page-scope` wrapper is applied to:
- the **reader** (paginated view), wrapping each page.
- the **streaming view** during AI generation.
- the **editor preview** in `UnitEditor.tsx` — TipTap's content area is itself inside `.unit-page-scope`, so editing is WYSIWYG.

The decoration toolbar and page-style menu are **outside** the scope (they are tool surfaces, not content).

### 8.6 Pagination interaction

`pageLayout.ts` measurement uses `getBoundingClientRect` on a hidden DOM tree that is itself wrapped in `.unit-page-scope` with the same `themeVars`. Measurement and render are pixel-identical by construction.

---

## 9. Tests

### 9.1 Backend (`vitest`)

**Sanitizer** (`backend/src/html/sanitize.test.ts`):
- Table-driven: ~50 cases, each `{name, input, expected}`.
- Drops `<script>`, `<style>`, all `on*` event handlers.
- Strips `javascript:`, `data:`, `vbscript:` from `href`.
- Preserves `https:`, `http:`, `mailto:`, `#anchor`.
- Adds `target="_blank"` + `rel="noopener noreferrer"` to external links.
- Internal links (configured `INTERNAL_HOSTS`) get neither `target` nor `rel`.
- Degrades `h1` → `h2`, `h5`/`h6` → `h4`.
- Strips `s`/`strike`/`del`/`ins`, keeps text.
- Preserves `code class="language-*"`.
- Preserves `colspan`/`rowspan`/`scope` on table cells.
- Auto-generates `id` on headings without one; dedupes `id` collisions.
- Rejects empty post-sanitization HTML.
- Idempotent: `sanitize(sanitize(x)) === sanitize(x)`.

**Block extraction** (`extractBlocks.test.ts`):
- Headings extracted with correct `level` and `id`.
- Paragraphs, blockquotes, lists, tables, code, dividers correctly typed.
- `textLength` uses graphemes (test with emoji + skin-tone modifiers).
- Offsets are cumulative and correct.
- IDs are deterministic for identical input.
- Re-running produces identical output.

**Continuity extraction** (`extractContinuity.test.ts`):
- Returns `textContent` of last `<p>` when present.
- Falls back to last block's `textContent` when no trailing `<p>`.
- Returns empty string for empty HTML.
- Caps at 800 characters.
- Strips inline tags.

**Streaming integration** (`streaming.integration.test.ts`):
- Mock the AI gateway with canned token sequences.
- Sequences cover:
  - Clean output → all blocks emit, complete fires with payload matching reopen.
  - Unclosed `<p>` followed by `<h2>` → implicit close handled.
  - Unterminated stream (LLM cuts mid-`<table>`) → force-close, final sanitization, valid output.
  - Output with `<script>` or `<style>` → stripped, remainder valid.
  - Output below min-length → triggers retry path.
  - Two failed retries → `failed` status + refund entry written.

**Generation run lifecycle** (`generation-run.test.ts`):
- Charge on creation; refund only on terminal failure.
- Charge failure marks the run `payment_failed` (or removes it) and does not block a future retry.
- Single in-flight run per chapter — second request returns existing `runId`.
- Disconnect-reconnect: simulate dropped HTTP stream, reconnect to same `runId`, replay completes correctly.
- Idempotent retry — `coinTxId` is never written twice.

**Theme validation** (`presentation-theme.validate.test.ts`):
- Accepts every enum value combination.
- Rejects invalid font names, sizes, alignment, spacing.
- Line height clamps: rejects `1.0`, `2.5`; accepts `1.2`, `2.0`.
- Color validator: accepts `#fff`, `#abcdef`, `rgb(0,0,0)`, `hsla(...)`, named colors.
- Color validator: rejects `url(...)`, `expression(...)`, `var(--x)`, `unknown(...)`, embedded HTML.
- Same validator works for unit override input and user default input.

**Theme persistence** (`theme-endpoints.integration.test.ts`):
- `PATCH /api/didactic-unit/:id/theme` with valid theme persists; with `null` clears override.
- `PATCH /api/auth/me/default-theme` persists; new user has `SYSTEM_DEFAULT_THEME` seeded.
- Invalid payload returns 422 from both endpoints.

**Chapter edit (full-document)** (`update-chapter.test.ts`):
- No-op save after TipTap round-trip returns the current chapter unchanged and does not create a `manual_edit` revision.
- Valid full-chapter HTML → 200 with canonical chapter; new hash, new blocks.
- Stale `htmlHash` → 409 Conflict.
- HTML containing orphan top-level text → 422.
- HTML with two `<h2>Intro</h2>` headings → response has deduped ids (`intro`, `intro-2`).
- Edit response is byte-equivalent to passing the same HTML through AI generation's sanitizer (asserts the unified pipeline).

**Reading progress** (`reading-progress.test.ts`):
- Block-index storage and retrieval.
- Version-mismatch remap uses `recordedTotalBlocks` and is proportional/correct.
- `furthestReadBlockOffset` discarded on version mismatch; `chapterCompleted` preserved.
- `progressPercentage` returns `1.0` only when `chapterCompleted === true`; caps at `0.99` otherwise.

### 9.2 Frontend (`vitest` + `happy-dom`)

**HTML block extraction** (`htmlBlocks.test.ts`):
- Frontend extractor produces blocks consistent with backend output for canonical HTML inputs.

**Pagination property tests** (`pagination.property.test.ts` with `fast-check`):
- Generate ~200 random allow-list-conforming HTML chapters.
- For each: paginate → concatenate page text → assert equals source `textContent`.
- No characters lost or duplicated.

**Pagination snapshots** (`pagination.snapshot.test.ts`):
- 8–10 hand-curated chapters covering: long paragraph with inline tags, nested lists, tables with header repeat, code splitting by lines, headings pushed across pages, dividers.
- Expected page boundaries asserted explicitly.

**Block splitter unit tests** (`blockSplit.test.ts`):
- `cloneNodeAtTextOffset`: nested inline (`<strong><em>foo</em></strong>`) split — both halves valid.
- Anchor mid-split: both halves carry the same `href`.
- Grapheme-aware split (emoji at boundary not broken).
- Table cluster grouping: `rowspan` cells correctly cluster rows.
- Code line split: `language-X` class repeated.

**Editor round-trip** (`tiptap.roundtrip.test.ts`):
- Array of allow-list HTML inputs covering every supported tag/attribute.
- For each: `editor.commands.setContent(html)` → `editor.getHTML()` → run through a backend-equivalent sanitizer in test env → assert `result === sanitize(html)`.
- This is the lossless guarantee for the editor.

**Page mask** (`pageMask.test.ts`):
- At edit-open, mask boundaries equal the current page's first/last block range.
- Mask is rendered via CSS overlay; DOM of other pages is intact (assert via `document.querySelector` finds nodes).
- Typing that grows content beyond the original page extent does NOT re-paginate (boundaries frozen for session).
- `editor.getHTML()` returns the full chapter, not just the masked page.

**Selection clamp** (`selectionClamp.test.ts`):
Cover every navigation path:
- ArrowDown past last visible line of the page → cursor stops at page boundary.
- ArrowUp before first visible line → cursor stops at page top.
- `Page Down`, `Page Up` → clamped.
- `Ctrl+End`, `Ctrl+Home` → clamped to page end / page start.
- Mouse click in masked area → cursor snaps to nearest in-page position.
- Mouse-drag selection extending into masked area → selection clamps to page boundary.
- Paste at clamp boundary → content inserts at the clamped position.
- IME composition near boundary → composition completes within page bounds.

**Paste cleaner** (`pasteCleaner.test.ts`):
- Word HTML, Google Docs HTML, plain HTML samples.
- Disallowed tags removed, text content preserved.
- `<script>` content stripped, no execution.
- Office namespaces removed.

**Renderer** (`chapterRenderer.test.ts`):
- `<pre><code class="language-X">` swapped to `<CodeBlock>` component.
- Anchors render as native `<a>` with backend-set attributes.
- Memoization keyed by HTML.

**Generation-run hook** (`useGenerationRunStream.test.ts`):
- Receives `partial_html_block` events, accumulates blocks.
- Disconnect simulation: reconnect replays from `emittedBlocks`, no duplicates.
- `complete` reconciles to the canonical payload.
- `prefers-reduced-motion` disables block animation.

**Theme resolution** (`useResolvedTheme.test.ts`):
- Unit override present → returns unit override.
- Unit override `null`, user default present → returns user default.
- Both absent → returns `SYSTEM_DEFAULT_THEME`.
- Resolution is reactive: changing user default while unit has no override updates the rendered theme.
- Resolution does not mutate when user default changes if unit has an explicit override.

**CodeBlock skeleton** (`codeBlockSkeleton.test.ts`):
- Skeleton renders with line count matching the source code.
- No layout shift when Shiki resolves and replaces the skeleton (height of skeleton ≈ height of final block, asserted via `getBoundingClientRect`).

### 9.3 End-to-end (`Playwright`)

- `generate-and-reopen.spec.ts`: generate a chapter, screenshot mid-stream (after 2 blocks), screenshot stream-complete, close module, reopen, screenshot. Pixel-diff "stream-complete" vs "reopened" with small tolerance. **This is the primary visual-parity guarantee.**
- `edit-save-reopen.spec.ts`: open editor on page 2 of a multi-page chapter, type a paragraph, attempt to scroll/cursor into page 1 (assert blocked by selection clamp), save, reload, assert chapter content updated correctly and reader reopens at the page containing the edit.
- `concurrent-edit.spec.ts`: open editor in tab A, modify the chapter via tab B, attempt save in tab A, assert 409 with non-destructive prompt (no data loss).
- `paste-from-word.spec.ts`: paste sample Word HTML, assert clean content in editor and on save.
- `disconnect-reconnect.spec.ts`: start generation, kill the page mid-stream, reopen, assert generation completes and final state is correct.
- `unit-theme-override.spec.ts`: open page-style menu, change body color, assert reader and editor both reflect the change. Reset to user default → reverts.
- `user-default-theme.spec.ts`: change user default theme; assert it applies to a unit with no override and does NOT change a unit with an override.
- `code-highlight.spec.ts`: chapter with TS/Python/Bash code blocks, assert Shiki skeleton appears first, then highlighted output, no layout shift, split fragments highlight independently.

### 9.4 Performance (`vitest bench`)

- Pagination of 20k-char chapter under 50 ms (warm cache).
- Block extraction of 20k-char chapter under 30 ms.
- TipTap initial setContent of 10k-char HTML under 100 ms.
- Shiki first-language load + highlight under 600 ms.

CI fails on regression beyond 1.5×.

---

## 10. Deployment

### 10.1 Required env vars

- `INTERNAL_HOSTS` — comma-separated hostnames considered internal for link `target` policy.
- AI gateway / model env (existing).
- Coin store / DB connection (existing).
- `STATIC_DIR` — path to frontend dist served as static.

### 10.2 No npm workspace changes for shared packages

The existing root `package.json` already declares `"workspaces": ["frontend", "backend"]`. No new workspace is added. No `@didactio/shared` package is created.

Type sharing between FE and BE is done via duplicated `contentTypes.ts` files in each (small, stable). A simple snapshot test ensures they don't drift.

---

## 11. Implementation order

This is a **single big-bang milestone**, not a sequence of shippable releases. The app is not in production and will not be deployed until the full migration is finished. Intermediate states (e.g., backend HTML done, frontend still on Markdown) are not viable because the contracts on `content`, `presentationSettings`, `readCharacterCount`, and `partial_markdown` are tightly woven into the current frontend (`dashboardApi.ts`, `pageLayout.ts`, `UnitEditor.tsx`).

The phases below are an **ordering for the work**, with internal checkpoints (each phase's tests must pass before moving on). They are **not independent deployment units**.

The "contract switch" — the moment the public chapter shape changes from `{content, presentationSettings}` to `{html, htmlBlocks, htmlHash, htmlBlocksVersion}` — happens in a single coordinated change spanning backend response, API client, frontend types, renderer, pagination, and editor. Phases 4–10 below merge into one branch and land together.

### Phase 1 — Backend foundation
- New chapter shape, drop legacy fields entirely.
- Sanitizer (`sanitizeChapterHtml`).
- Block extraction.
- Hash + continuity extraction.
- Unit tests for all of the above.

### Phase 2 — Backend HTML generation
- `buildChapterHtmlPrompt`.
- parse5-driven streaming pipeline.
- Block-by-block emit; final-document sanitization on stream end.
- Updated NDJSON event types.

### Phase 3 — Generation run lifecycle
- `GenerationRun` store and orchestrator.
- `POST /api/didactic-unit/:id/modules/:index/generate`, `GET /api/generation-runs/:id`, `GET /api/generation-runs/:id/stream`.
- Idempotent retry, refund on final failure.
- Disconnect-reconnect via `emittedBlocks` replay.

### Phase 4 — Theme foundation
- `PresentationTheme` type (FE + BE), `SYSTEM_DEFAULT_THEME` constant.
- User record gains `defaultPresentationTheme`; seed at signup.
- Unit record gains `presentationTheme: PresentationTheme | null`.
- Theme validator (shared between unit + user write paths).
- `PATCH /api/didactic-unit/:id/theme` and `PATCH /api/auth/me/default-theme` endpoints.
- `useResolvedTheme` hook (FE).

### Phase 5 — Frontend rendering foundation
- API client updates.
- `ChapterRenderer` with `html-react-parser`.
- `UnitPageScope` wrapper + theme CSS vars.
- Apply scope to reader, streaming view, editor preview.

### Phase 6 — Pagination rewrite
- `htmlBlocks.ts`, `blockSplit.ts`, new `pageLayout.ts`.
- Property tests + snapshot tests.

### Phase 7 — TipTap editor
- TipTap install, configuration, custom extensions (`HeadingWithId`, `PasteCleaner`).
- New `EditorToolbar` (decoration menu).
- Round-trip test against backend sanitizer.
- Replace Lexical in `UnitEditor.tsx`.
- Delete Lexical files and deps.

### Phase 8 — Theme menus
- `PresentationThemeForm` shared component.
- `PageStyleMenu` (per-unit override) + "Reset to my default" / "Save as my default".
- `DefaultThemeMenu` in user settings (per-user default).
- Live preview wired to `UnitPageScope`.

### Phase 9 — Code highlighting
- `CodeBlock` + `CodeBlockSkeleton` components.
- Lazy Shiki loader, `SHIKI_THEME` constant.
- Integration with `ChapterRenderer` (component swap).
- Cache.

### Phase 10 — Generation streaming on the frontend
- `useGenerationRunStream` hook.
- Block-by-block render with fade-in animation.
- Disconnect/reconnect handling.
- Reduced-motion support.

### Phase 11 — Reading progress
- Block-index-based progress.
- Version-mismatch remap.
- IntersectionObserver-based tracking in the reader.

### Phase 12 — End-to-end + performance
- Playwright suites.
- Vitest bench for pagination/extraction.
- CI gates.

### Phase 13 — Cleanup
- Delete dead markdown utilities for chapter bodies.
- Confirm syllabus/summary markdown bridge is the only remaining markdown surface.
- Audit unused dependencies and remove.

---

## 12. Open questions to resolve during implementation

None outstanding. All UX and architectural decisions are locked in §1–§11. Coin cost per chapter is unchanged from the pre-migration value.

---

## 13. Definition of done

The migration is complete when:

- All chapters in the system have HTML, `htmlHash`, `htmlBlocks`, `htmlBlocksVersion`.
- Every user has a `defaultPresentationTheme`; every unit has a `presentationTheme` field (nullable).
- The resolution rule `unit.presentationTheme ?? user.defaultPresentationTheme ?? SYSTEM_DEFAULT_THEME` is applied uniformly in reader, streaming view, and editor preview.
- Page-style menu (per-unit) and user-settings default-theme menu both write through validated endpoints.
- No code path references `markdown` field on chapters or `contentFormat` discriminator.
- Streaming a new chapter and reopening it produce pixel-identical output (E2E pixel-diff test passes within tolerance).
- Editor round-trip test covers every allow-list construction and is idempotent.
- Generation runs survive client disconnect (E2E test passes).
- A failed generation refunds coins via a compensating ledger entry.
- Pagination property tests pass with N=200 random inputs.
- No `dangerouslySetInnerHTML` outside the controlled `<CodeBlock>` Shiki wrapper.
- No `lexical` packages in `package-lock.json`.
- Shiki uses the `SHIKI_THEME` constant (`min-light` for v1; `one-dark-pro` reserved for the future dark-mode swap); first highlight shows a skeleton, no layout shift on swap.
- Performance budgets met in CI.
