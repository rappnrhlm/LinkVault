import { z } from 'zod';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

export type ItemType = 'bookmark' | 'note';
export type EditorMode = 'markdown' | 'rich';
export type ItemStatus = 'active' | 'archived' | 'trash';

export interface Tag {
  id: string;
  name: string;
  color: string;
  count?: number;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkData {
  url: string;
  normalizedUrl: string;
  description: string;
  siteName: string;
  faviconUrl: string | null;
  isRead: boolean;
  lastAccessedAt: string | null;
}

export interface NoteData {
  contentMd: string;
  editorMode: EditorMode;
  wordCount: number;
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  bookmark?: BookmarkData;
  note?: NoteData;
  tags: Tag[];
  collections: Pick<Collection, 'id' | 'name'>[];
  excerpt?: string;
}

export interface Relationship {
  id: string;
  sourceItemId: string;
  targetItemId: string;
  kind: string;
  createdAt: string;
  target?: Pick<Item, 'id' | 'type' | 'title'>;
}

export interface ItemDetail extends Item {
  relationships: Relationship[];
  backlinks: Relationship[];
}

export const itemTypeSchema = z.enum(['bookmark', 'note']);
export const editorModeSchema = z.enum(['markdown', 'rich']);
export const itemStatusSchema = z.enum(['active', 'archived', 'trash']);

const title = z.string().trim().min(1).max(300);
const optionalTitle = z.string().trim().max(300).optional();
const noteTitle = z.string().trim().min(1).max(300).optional();
const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex colour')
  .optional();
const id = z.string().uuid();

export const createBookmarkSchema = z.object({
  url: z.string().trim().min(1).max(4096),
  title: optionalTitle,
  description: z.string().max(4000).optional(),
  siteName: z.string().max(200).optional(),
  faviconUrl: z.string().max(2048).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  collectionIds: z.array(id).max(20).optional(),
});

export const updateBookmarkSchema = z.object({
  title: title.optional(),
  url: z.string().trim().min(1).max(4096).optional(),
  description: z.string().max(4000).optional(),
  siteName: z.string().max(200).optional(),
  faviconUrl: z.string().max(2048).nullable().optional(),
  isRead: z.boolean().optional(),
});

export const createNoteSchema = z.object({
  title: noteTitle,
  contentMd: z.string().max(2_000_000).optional(),
  editorMode: editorModeSchema.optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  collectionIds: z.array(id).max(20).optional(),
});

export const updateItemSchema = z.object({
  title: title.optional(),
  favorite: z.boolean().optional(),
  archived: z.boolean().optional(),
  deleted: z.boolean().optional(),
  bookmark: updateBookmarkSchema.optional(),
});

export const noteContentSchema = z.object({
  contentMd: z.string().max(2_000_000),
  editorMode: editorModeSchema,
  baseUpdatedAt: z.string().datetime().optional(),
});

export const tagInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: color,
});

export const tagUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const collectionInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(1000).optional(),
});

export const collectionUpdateSchema = collectionInputSchema.partial();

export const relationshipInputSchema = z.object({
  targetItemId: id,
  kind: z.enum(['related', 'references']).default('related'),
});

export const listQuerySchema = z.object({
  type: itemTypeSchema.optional(),
  status: itemStatusSchema.default('active'),
  favorite: z.enum(['true', 'false']).optional(),
  read: z.enum(['true', 'false']).optional(),
  tag: z.string().optional(),
  collection: z.string().optional(),
  q: z.string().max(300).optional(),
  sort: z.enum(['updated', 'created', 'title']).default('updated'),
  limit: z.coerce.number().int().min(1).max(200).default(60),
  offset: z.coerce.number().int().min(0).default(0),
});

export const importSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      type: itemTypeSchema,
      title: z.string(),
      favorite: z.boolean(),
      createdAt: z.string(),
      updatedAt: z.string(),
      archivedAt: z.string().nullable().optional(),
      deletedAt: z.string().nullable().optional(),
      bookmark: z
        .object({
          url: z.string(),
          description: z.string().optional(),
          siteName: z.string().optional(),
          faviconUrl: z.string().nullable().optional(),
          isRead: z.boolean().optional(),
        })
        .optional(),
      note: z
        .object({
          contentMd: z.string(),
          editorMode: editorModeSchema,
        })
        .optional(),
      tags: z.array(z.object({ name: z.string(), color: z.string() })).optional(),
      collections: z.array(z.object({ name: z.string(), description: z.string().optional() })).optional(),
      relationships: z.array(z.object({ targetItemId: z.string(), kind: z.string() })).optional(),
    }),
  ),
  tags: z.array(z.object({ name: z.string(), color: z.string() })).optional(),
  collections: z.array(z.object({ name: z.string(), description: z.string().optional() })).optional(),
});

export type ImportPayload = z.infer<typeof importSchema>;

export function normalizeUrl(input: string): string {
  const url = new URL(input.trim());
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are supported');
  }
  if (url.username || url.password) {
    throw new Error('URLs with embedded credentials are not allowed');
  }
  url.hash = '';
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) {
    url.port = '';
  }
  if (url.pathname === '') url.pathname = '/';
  return url.toString();
}

export function isValidHttpUrl(input: string): boolean {
  try {
    normalizeUrl(input);
    return true;
  } catch {
    return false;
  }
}

export function countWords(markdown: string): number {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+\[(x|X| )\]\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/[#>*_~|]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

marked.setOptions({ gfm: true, breaks: false });

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const renderer = new marked.Renderer();
renderer.html = ({ text }) => escapeHtml(text);

interface MarkedItem {
  task?: boolean;
  checked?: boolean;
  tokens: unknown[];
}

interface MarkedList {
  ordered: boolean;
  start?: number | string;
  items: MarkedItem[];
}

renderer.list = function (token: MarkedList) {
  const tag = token.ordered ? 'ol' : 'ul';
  const taskList = token.items.some((item) => item.task);
  const start = token.ordered && token.start && Number(token.start) !== 1 ? ` start="${token.start}"` : '';
  const body = token.items.map((item) => this.listitem(item as never)).join('');
  return `<${tag}${taskList ? ' data-type="taskList"' : ''}${start}>\n${body}</${tag}>\n`;
};

renderer.listitem = function (item: MarkedItem) {
  if (item.task) {
    const inner = marked.parser(item.tokens as never, { renderer, gfm: true });
    return `<li data-type="taskItem" data-checked="${item.checked ? 'true' : 'false'}"><label><input type="checkbox"${item.checked ? ' checked' : ''} disabled><span></span></label><div>${inner}</div></li>`;
  }
  const inner = marked.parser(item.tokens as never, { renderer, gfm: true });
  return `<li>${inner}</li>`;
};

export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false, renderer }) as string;
}

let turndown: TurndownService | null = null;
function service(): TurndownService {
  if (!turndown) {
    turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
    });
    turndown.use(gfm);
    turndown.addRule('strikethrough', {
      filter: ['del', 's'],
      replacement: (content) => `~~${content}~~`,
    });
    turndown.addRule('taskItem', {
      filter: (node) =>
        node.nodeName === 'LI' && (node as HTMLElement).getAttribute('data-type') === 'taskItem',
      replacement: (content, node) => {
        const checked = (node as HTMLElement).getAttribute('data-checked') === 'true';
        const text = content.replace(/^\s*\[[ xX]\]\s*/, '').trim();
        return `- [${checked ? 'x' : ' '}] ${text}\n`;
      },
    });
  }
  return turndown;
}

export function htmlToMarkdown(html: string): string {
  return service().turndown(html).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function plainTextFromMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*/g, ' '))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[-*+]\s+\[(x|X| )\]\s+/gm, '')
    .replace(/^\s*\|?[\s:-]+\|[\s:|-]*$/gm, ' ')
    .replace(/\|/g, ' ')
    .replace(/[#>*_~`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function excerptFromMarkdown(markdown: string, length = 180): string {
  const text = plainTextFromMarkdown(markdown);
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}
