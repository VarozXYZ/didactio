import { describe, expect, it } from 'vitest'
import { normalizeGeneratedChapterMarkdown } from '../src/ai/markdown-parsers.js'

describe('markdown parsers', () => {
    it('normalizes generated chapter markdown without requiring overview or key takeaways sections', () => {
        const parsed = normalizeGeneratedChapterMarkdown(
            [
                '## Core concepts',
                'Start with the foundations and build toward examples.',
                '',
                '## Guided practice',
                'Apply the concept in a practical example.',
            ].join('\n'),
            0,
            { fallbackTitle: 'Module 1' }
        )

        expect(parsed.title).toBe('Module 1')
        expect(parsed.markdown).toContain('## Core concepts')
        expect(parsed.markdown).toContain('## Guided practice')
    })

    it('strips an accidental top-level title heading before saving the canonical markdown', () => {
        const parsed = normalizeGeneratedChapterMarkdown(
            ['# Module 1', '', '## Core concepts', 'Explain the fundamentals clearly.'].join(
                '\n'
            ),
            0,
            { fallbackTitle: 'Fallback title' }
        )

        expect(parsed.title).toBe('Module 1')
        expect(parsed.markdown).toBe('## Core concepts\nExplain the fundamentals clearly.')
    })

    it('ignores heading-like lines inside fenced code blocks', () => {
        const parsed = normalizeGeneratedChapterMarkdown(
            [
                '## Variables in practice',
                'We can annotate examples with inline Python comments.',
                '',
                '```python',
                'headline = "DataCraft Studio"',
                '# This prints: DataCraft Studio - Transforming ideas into digital content',
                'print(headline)',
                '```',
                '',
                '## Why this matters',
                'The rest of the module should still be preserved.',
            ].join('\n'),
            0,
            { fallbackTitle: 'Module 1' }
        )

        expect(parsed.title).toBe('Module 1')
        expect(parsed.markdown).toContain('## Variables in practice')
        expect(parsed.markdown).toContain(
            '# This prints: DataCraft Studio - Transforming ideas into digital content'
        )
        expect(parsed.markdown).toContain('## Why this matters')
    })
})
