import { describe, expect, it } from 'vitest';
import {
  countWords,
  excerptFromMarkdown,
  htmlToMarkdown,
  markdownToHtml,
  normalizeUrl,
} from '@linkvault/shared';

describe('Markdown and rich text conversion', () => {
  const sample = `# Heading

A paragraph with **bold**, *italic*, ~~struck~~ and a [link](https://example.com).

- one
- two

1. first
2. second

- [x] done
- [ ] pending

| Name | Value |
| --- | --- |
| alpha | 1 |

> A quote

\`\`\`js
const answer = 42;
\`\`\`
`;

  it('renders headings, lists, checklists, tables and code blocks', () => {
    const html = markdownToHtml(sample);
    expect(html).toContain('<h1>Heading</h1>');
    expect(html).toContain('data-type="taskList"');
    expect(html).toContain('data-checked="true"');
    expect(html).toContain('<table>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<pre><code class="language-js">');
    expect(html).toContain('<a href="https://example.com">link</a>');
  });

  it('converts HTML back to Markdown without losing structure', () => {
    const markdown = htmlToMarkdown(markdownToHtml(sample));
    expect(markdown).toContain('# Heading');
    expect(markdown).toContain('**bold**');
    expect(markdown).toContain('[link](https://example.com)');
    expect(markdown).toContain('- [x] done');
    expect(markdown).toContain('- [ ] pending');
    expect(markdown).toContain('| Name | Value |');
    expect(markdown).toContain('> A quote');
    expect(markdown).toContain('```js');
    expect(markdown).toContain('const answer = 42;');
  });

  it('round-trips a second time without drift', () => {
    const once = htmlToMarkdown(markdownToHtml(sample));
    const twice = htmlToMarkdown(markdownToHtml(once));
    expect(twice).toBe(once);
  });

  it('escapes raw HTML instead of passing it through', () => {
    const html = markdownToHtml('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('counts words and builds excerpts from note text', () => {
    expect(countWords('# Hello world\n\nThis is a note.')).toBe(6);
    expect(countWords('')).toBe(0);
    expect(excerptFromMarkdown('# Title\n\nBody copy here.', 12)).toBe('Title Body c…');
  });

  it('normalization is idempotent', () => {
    const first = normalizeUrl('https://Example.com/a?b=1#c');
    expect(normalizeUrl(first)).toBe(first);
  });
});
