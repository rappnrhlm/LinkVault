import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { assertResolvesPublic, assertSafeUrl, guardedLookup, UnsafeUrlError } from '../lib/net-guard.js';

const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 4;
const DEADLINE_MS = 10_000;
const TIMEOUT_MS = 7_000;

export interface PageMetadata {
  url: string;
  title: string;
  description: string;
  siteName: string;
  faviconUrl: string | null;
}

export class MetadataError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
  ) {
    super(message);
  }
}

interface FetchedPage {
  status: number;
  contentType: string;
  body: string;
  finalUrl: URL;
}

function fetchOnce(url: URL, timeout: number): Promise<FetchedPage> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const request = client(
      {
        protocol: url.protocol,
        hostname: url.hostname.replace(/^\[|\]$/g, ''),
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: {
          host: url.host,
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'accept-language': 'en;q=0.9',
          'user-agent': 'LinkVault/1.0 (local bookmark manager)',
        },
        lookup: guardedLookup as never,
        timeout,
      },
      (response: IncomingMessage) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location) {
          response.resume();
          resolve({
            status,
            contentType: String(response.headers['content-type'] ?? ''),
            body: '',
            finalUrl: new URL(location, url),
          });
          return;
        }
        const contentType = String(response.headers['content-type'] ?? '');
        if (!/text\/html|application\/xhtml\+xml/i.test(contentType) && contentType !== '') {
          response.resume();
          reject(new MetadataError('That page did not return HTML', 415));
          return;
        }
        const declared = Number(response.headers['content-length'] ?? 0);
        if (declared > MAX_BYTES) {
          response.destroy();
          reject(new MetadataError('That page is too large to read', 413));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            response.destroy();
            reject(new MetadataError('That page is too large to read', 413));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const charset = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().toLowerCase();
          const decoder = charset && charset !== 'utf-8' && charset !== 'utf8'
            ? new TextDecoder(charset, { fatal: false })
            : new TextDecoder('utf-8');
          resolve({
            status,
            contentType,
            body: decoder.decode(buffer),
            finalUrl: url,
          });
        });
        response.on('error', reject);
      },
    );
    request.on('timeout', () => {
      request.destroy(new MetadataError('The website took too long to respond', 504));
    });
    request.on('error', (error) => {
      if (error instanceof MetadataError) reject(error);
      else reject(new MetadataError('Could not reach that website', 502));
    });
    request.end();
  });
}

async function fetchPage(startUrl: URL): Promise<FetchedPage> {
  const deadline = Date.now() + DEADLINE_MS;
  let current = startUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    await assertResolvesPublic(current.hostname);
    const remaining = Math.min(TIMEOUT_MS, deadline - Date.now());
    if (remaining <= 0) throw new MetadataError('The website took too long to respond', 504);
    const page = await fetchOnce(current, remaining);
    if (page.status >= 300 && page.status < 400) {
      if (redirects === MAX_REDIRECTS) throw new MetadataError('That website redirects too many times', 502);
      current = assertSafeUrl(page.finalUrl);
      continue;
    }
    if (page.status < 200 || page.status >= 300) {
      throw new MetadataError(`That website returned HTTP ${page.status}`, 502);
    }
    return { ...page, finalUrl: current };
  }
  throw new MetadataError('That website redirects too many times', 502);
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match);
}

function clean(value: string | undefined, max = 500): string {
  if (!value) return '';
  return decodeEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(tag))) {
    result[match[1]!.toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return result;
}

export function parseMetadata(html: string, pageUrl: URL): PageMetadata {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  let title = clean(titleMatch?.[1], 300);
  let description = '';
  let siteName = '';
  let favicon: string | null = null;

  const metaRegex = /<meta\s+[^>]*>/gi;
  let meta: RegExpExecArray | null;
  while ((meta = metaRegex.exec(html))) {
    const attrs = attributes(meta[0]);
    const key = (attrs.property ?? attrs.name ?? '').toLowerCase();
    if (!key) continue;
    if ((key === 'og:title' || key === 'twitter:title') && !title) title = clean(attrs.content, 300);
    if (key === 'og:description' || key === 'description' || key === 'twitter:description') {
      if (!description) description = clean(attrs.content, 1000);
    }
    if (key === 'og:site_name' && !siteName) siteName = clean(attrs.content, 200);
  }

  const linkRegex = /<link\s+[^>]*>/gi;
  let link: RegExpExecArray | null;
  while ((link = linkRegex.exec(html))) {
    const attrs = attributes(link[0]);
    const rel = (attrs.rel ?? '').toLowerCase();
    if (!favicon && rel.split(/\s+/).some((part) => part === 'icon' || part === 'apple-touch-icon')) {
      const href = attrs.href?.trim();
      if (href) {
        try {
          const resolved = new URL(href, pageUrl);
          if (resolved.protocol === 'http:' || resolved.protocol === 'https:') favicon = resolved.toString();
        } catch {
          /* ignore malformed icon URLs */
        }
      }
    }
  }

  if (!title) title = siteName || pageUrl.hostname.replace(/^www\./, '');
  if (!siteName) siteName = pageUrl.hostname.replace(/^www\./, '');
  return { url: pageUrl.toString(), title, description, siteName, faviconUrl: favicon };
}

export async function fetchMetadata(input: string): Promise<PageMetadata> {
  const url = assertSafeUrl(input);
  const page = await fetchPage(url);
  const metadata = parseMetadata(page.body, page.finalUrl);
  if (metadata.faviconUrl) {
    try {
      const iconUrl = assertSafeUrl(metadata.faviconUrl);
      await assertResolvesPublic(iconUrl.hostname);
    } catch {
      metadata.faviconUrl = null;
    }
  }
  return metadata;
}

interface BinaryPage {
  status: number;
  contentType: string;
  body: Buffer;
  finalUrl: URL;
}

function fetchBinaryOnce(url: URL, timeout: number, maxBytes: number): Promise<BinaryPage> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const request = client(
      {
        protocol: url.protocol,
        hostname: url.hostname.replace(/^\[|\]$/g, ''),
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: {
          host: url.host,
          accept: 'image/*',
          'user-agent': 'LinkVault/1.0 (local bookmark manager)',
        },
        lookup: guardedLookup as never,
        timeout,
      },
      (response: IncomingMessage) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location) {
          response.resume();
          resolve({
            status,
            contentType: '',
            body: Buffer.alloc(0),
            finalUrl: new URL(location, url),
          });
          return;
        }
        const contentType = String(response.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
        if (!contentType.startsWith('image/')) {
          response.resume();
          reject(new MetadataError('That icon is not an image', 415));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            response.destroy();
            reject(new MetadataError('That icon is too large', 413));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          resolve({ status, contentType, body: Buffer.concat(chunks), finalUrl: url });
        });
        response.on('error', reject);
      },
    );
    request.on('timeout', () => request.destroy(new MetadataError('That icon took too long to load', 504)));
    request.on('error', (error) => {
      reject(error instanceof MetadataError ? error : new MetadataError('Could not reach that icon', 502));
    });
    request.end();
  });
}

export async function fetchFavicon(input: string): Promise<{ body: Buffer; contentType: string }> {
  const deadline = Date.now() + 6_000;
  let current = assertSafeUrl(input);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    await assertResolvesPublic(current.hostname);
    const remaining = Math.min(5_000, deadline - Date.now());
    if (remaining <= 0) throw new MetadataError('That icon took too long to load', 504);
    const page = await fetchBinaryOnce(current, remaining, 128 * 1024);
    if (page.status >= 300 && page.status < 400) {
      current = assertSafeUrl(page.finalUrl);
      continue;
    }
    if (page.status !== 200) throw new MetadataError('That icon could not be loaded', 502);
    return { body: page.body, contentType: page.contentType };
  }
  throw new MetadataError('That icon redirects too many times', 502);
}

export { UnsafeUrlError };
