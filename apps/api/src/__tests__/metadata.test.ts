import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../services/metadata.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/metadata.js')>();
  return {
    ...actual,
    fetchMetadata: vi.fn(async (url: string) => ({
      url: new URL(url).toString(),
      title: 'Fetched page title',
      description: 'Fetched description',
      siteName: 'Example Site',
      faviconUrl: 'https://example.com/favicon.ico',
    })),
  };
});

const { parseMetadata } = await import('../services/metadata.js');

describe('metadata parsing', () => {
  it('reads title, description, site name and favicon', () => {
    const html = `<html><head>
      <title>Plain &amp; Simple</title>
      <meta name="description" content="A &lt;useful&gt; page">
      <meta property="og:site_name" content="Example">
      <link rel="icon" href="/favicon.png">
    </head></html>`;
    const result = parseMetadata(html, new URL('https://example.com/articles/1'));
    expect(result.title).toBe('Plain & Simple');
    expect(result.description).toBe('A page');
    expect(result.siteName).toBe('Example');
    expect(result.faviconUrl).toBe('https://example.com/favicon.png');
  });

  it('falls back to the hostname when there is no title', () => {
    const result = parseMetadata('<html><head></head></html>', new URL('https://www.example.org/x'));
    expect(result.title).toBe('example.org');
    expect(result.siteName).toBe('example.org');
    expect(result.description).toBe('');
  });

  it('strips markup and scripts from metadata values', () => {
    const html = `<title>Hi <script>alert(1)</script></title>
      <meta name="description" content="Clean &amp; useful">`;
    const result = parseMetadata(html, new URL('https://example.com'));
    expect(result.title).not.toContain('<script>');
    expect(result.title).toContain('Hi');
    expect(result.description).toBe('Clean & useful');
  });

  it('ignores non-http favicon URLs', () => {
    const html = '<link rel="icon" href="javascript:alert(1)">';
    const result = parseMetadata(html, new URL('https://example.com'));
    expect(result.faviconUrl).toBeNull();
  });
});
