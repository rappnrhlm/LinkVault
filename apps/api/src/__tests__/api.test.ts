import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { FastifyInstance } from 'fastify';

vi.mock('../services/metadata.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/metadata.js')>();
  return {
    ...actual,
    fetchMetadata: vi.fn(async (url: string) => ({
      url: new URL(url).toString(),
      title: 'Fetched page title',
      description: 'Fetched description',
      siteName: 'Fetched Site',
      faviconUrl: 'https://example.com/favicon.ico',
    })),
  };
});

const { createApp } = await import('../app.js');

function tempDb(): string {
  return join(mkdtempSync(join(tmpdir(), 'linkvault-api-')), 'test.db');
}

let app: FastifyInstance;

async function call(
  method: string,
  url: string,
  payload?: unknown,
  headers: Record<string, string> = {},
) {
  const response = await app.inject({
    method: method as 'GET',
    url,
    payload: payload as Record<string, unknown> | undefined,
    headers: { host: '127.0.0.1:4317', ...headers },
  });
  return { status: response.statusCode, body: response.body ? JSON.parse(response.body) : null, raw: response.body };
}

beforeEach(async () => {
  app = await createApp({ dbPath: tempDb() });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('API: bookmarks', () => {
  it('creates a bookmark with fetched metadata, tags and a normalized URL', async () => {
    const response = await call('POST', '/api/items/bookmarks', {
      url: 'https://example.com/article?utm_source=test#section',
      tags: ['Design', 'reading'],
    });
    expect(response.status).toBe(201);
    expect(response.body.item.title).toBe('Fetched page title');
    expect(response.body.item.bookmark.normalizedUrl).toBe(
      'https://example.com/article?utm_source=test',
    );
    expect(response.body.item.tags).toHaveLength(2);
    expect(response.body.warning).toBeNull();
  });

  it('detects duplicates conservatively and keeps query parameters distinct', async () => {
    await call('POST', '/api/items/bookmarks', { url: 'https://example.com/a?id=1' });
    const duplicate = await call('POST', '/api/items/bookmarks', {
      url: 'https://EXAMPLE.com/a?id=1#fragment',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('DUPLICATE_URL');
    expect(duplicate.body.details.existingItemId).toBeTruthy();

    const different = await call('POST', '/api/items/bookmarks', {
      url: 'https://example.com/a?id=2',
    });
    expect(different.status).toBe(201);
  });

  it('rejects invalid URLs and non-http schemes', async () => {
    expect((await call('POST', '/api/items/bookmarks', { url: 'not a url' })).status).toBe(400);
    expect((await call('POST', '/api/items/bookmarks', { url: 'file:///etc/passwd' })).status).toBe(400);
    expect((await call('POST', '/api/items/bookmarks', { url: 'https://u:p@example.com' })).status).toBe(400);
  });

  it('updates metadata and read state', async () => {
    const created = await call('POST', '/api/items/bookmarks', { url: 'https://example.com/one' });
    const id = created.body.item.id;
    const updated = await call('PATCH', `/api/items/${id}`, {
      title: 'My own title',
      bookmark: { description: 'Edited by hand', isRead: true, siteName: 'Example' },
    });
    expect(updated.body.item.title).toBe('My own title');
    expect(updated.body.item.bookmark.description).toBe('Edited by hand');
    expect(updated.body.item.bookmark.isRead).toBe(true);
    const visited = await call('POST', `/api/items/${id}/visit`);
    expect(visited.body.item.bookmark.lastAccessedAt).toBeTruthy();
  });
});

describe('API: notes', () => {
  it('creates, saves and reads a note in both editor modes', async () => {
    const created = await call('POST', '/api/items/notes', {
      title: 'A note',
      contentMd: '# Hello\n\n- [x] one\n- [ ] two',
    });
    const id = created.body.item.id;
    expect(created.body.item.note.wordCount).toBe(3);

    const saved = await call('PUT', `/api/items/${id}/note`, {
      contentMd: '| a | b |\n| - | - |\n| 1 | 2 |',
      editorMode: 'rich',
      baseUpdatedAt: created.body.item.updatedAt,
    });
    expect(saved.status).toBe(200);
    expect(saved.body.item.note.editorMode).toBe('rich');

    const fetched = await call('GET', `/api/items/${id}`);
    expect(fetched.body.item.note.contentMd).toContain('| a | b |');
  });

  it('rejects stale writes and returns the current content', async () => {
    const created = await call('POST', '/api/items/notes', { title: 'Race', contentMd: 'first' });
    const id = created.body.item.id;
    const base = created.body.item.updatedAt;
    const first = await call('PUT', `/api/items/${id}/note`, {
      contentMd: 'second',
      editorMode: 'markdown',
      baseUpdatedAt: base,
    });
    expect(first.status).toBe(200);
    const stale = await call('PUT', `/api/items/${id}/note`, {
      contentMd: 'third',
      editorMode: 'markdown',
      baseUpdatedAt: base,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('STALE_WRITE');
    expect(stale.body.details.currentContentMd).toBe('second');
  });

  it('rejects empty titles and oversized payloads', async () => {
    expect((await call('POST', '/api/items/notes', { title: '' })).status).toBe(400);
    const huge = 'x'.repeat(2_000_001);
    expect((await call('POST', '/api/items/notes', { title: 'Big', contentMd: huge })).status).toBe(400);
  });
});

describe('API: organization and relationships', () => {
  it('adds tags and collections and exposes them on the item', async () => {
    const bookmark = await call('POST', '/api/items/bookmarks', { url: 'https://example.com/org' });
    const note = await call('POST', '/api/items/notes', { title: 'Org note' });
    const collection = await call('POST', '/api/collections', { name: 'Shelf', description: 'A shelf' });
    const id = bookmark.body.item.id;

    const tagged = await call('PUT', `/api/items/${id}/tags`, { names: ['alpha', 'Beta'] });
    expect(tagged.body.item.tags.map((tag: { name: string }) => tag.name)).toEqual(['alpha', 'Beta']);

    const collected = await call('PUT', `/api/items/${id}/collections`, {
      collectionIds: [collection.body.collection.id],
    });
    expect(collected.body.item.collections[0].name).toBe('Shelf');

    const listed = await call('GET', `/api/items?collection=${collection.body.collection.id}`);
    expect(listed.body.total).toBe(1);
    const filtered = await call('GET', '/api/items?tag=beta');
    expect(filtered.body.total).toBe(1);
    expect(note.status).toBe(201);
  });

  it('links items, shows backlinks and refuses duplicates and self-links', async () => {
    const bookmark = await call('POST', '/api/items/bookmarks', { url: 'https://example.com/link' });
    const note = await call('POST', '/api/items/notes', { title: 'Linked note' });
    const source = note.body.item.id;
    const target = bookmark.body.item.id;

    const linked = await call('POST', `/api/items/${source}/relationships`, { targetItemId: target });
    expect(linked.status).toBe(201);
    expect(linked.body.item.relationships).toHaveLength(1);

    const duplicate = await call('POST', `/api/items/${source}/relationships`, { targetItemId: target });
    expect(duplicate.status).toBe(409);

    const self = await call('POST', `/api/items/${source}/relationships`, { targetItemId: source });
    expect(self.status).toBe(400);

    const backlink = await call('GET', `/api/items/${target}`);
    expect(backlink.body.item.backlinks).toHaveLength(1);
    expect(backlink.body.item.backlinks[0].target.title).toBe('Linked note');

    const removed = await call('DELETE', `/api/relationships/${linked.body.item.relationships[0].id}`);
    expect(removed.status).toBe(200);
    const after = await call('GET', `/api/items/${target}`);
    expect(after.body.item.backlinks).toHaveLength(0);
  });

  it('updates and deletes tags without deleting items', async () => {
    const note = await call('POST', '/api/items/notes', { title: 'Tagged', tags: ['old'] });
    const tags = await call('GET', '/api/tags');
    const tag = tags.body.tags.find((entry: { name: string }) => entry.name === 'old');
    const renamed = await call('PATCH', `/api/tags/${tag.id}`, { name: 'new', color: '#123456' });
    expect(renamed.status).toBe(200);
    const item = await call('GET', `/api/items/${note.body.item.id}`);
    expect(item.body.item.tags[0].name).toBe('new');
    expect(item.body.item.tags[0].color).toBe('#123456');
    await call('DELETE', `/api/tags/${tag.id}`);
    const after = await call('GET', `/api/items/${note.body.item.id}`);
    expect(after.body.item.tags).toHaveLength(0);
  });
});

describe('API: search, archive and trash', () => {
  it('finds items by title, URL, tag, collection and note body', async () => {
    const bookmark = await call('POST', '/api/items/bookmarks', {
      url: 'https://example.com/sqlite-fts',
      title: 'Full text search',
      tags: ['database'],
    });
    const note = await call('POST', '/api/items/notes', {
      title: 'Tokenizer notes',
      contentMd: 'The unicode61 tokenizer removes diacritics.',
    });
    const collection = await call('POST', '/api/collections', { name: 'Search shelf' });
    await call('PUT', `/api/collections/${collection.body.collection.id}/items`, {
      itemIds: [bookmark.body.item.id, note.body.item.id],
    });

    const byBody = await call('GET', '/api/search?q=diacritics');
    expect(byBody.body.results.map((r: { item: { id: string } }) => r.item.id)).toContain(
      note.body.item.id,
    );
    const byUrl = await call('GET', '/api/search?q=sqlite-fts');
    expect(byUrl.body.results).toHaveLength(1);
    const byTag = await call('GET', '/api/search?q=database');
    expect(byTag.body.results).toHaveLength(1);
    const byCollection = await call('GET', '/api/search?q=shelf');
    expect(byCollection.body.results.length).toBeGreaterThanOrEqual(2);
    const filtered = await call('GET', '/api/items?q=tokenizer');
    expect(filtered.body.total).toBe(1);
  });

  it('archives, trashes, restores and permanently deletes', async () => {
    const created = await call('POST', '/api/items/notes', { title: 'Lifecycle' });
    const id = created.body.item.id;

    const archived = await call('PATCH', `/api/items/${id}`, { archived: true });
    expect(archived.body.item.archivedAt).toBeTruthy();
    expect((await call('GET', '/api/items')).body.total).toBe(0);
    expect((await call('GET', '/api/items?status=archived')).body.total).toBe(1);

    const restored = await call('POST', `/api/items/${id}/restore`);
    expect(restored.body.item.archivedAt).toBeNull();

    const trashed = await call('DELETE', `/api/items/${id}`);
    expect(trashed.body.item.deletedAt).toBeTruthy();
    expect((await call('GET', '/api/items?status=trash')).body.total).toBe(1);
    expect((await call('GET', '/api/search?q=lifecycle')).body.results).toHaveLength(0);

    const restoredFromTrash = await call('POST', `/api/items/${id}/restore`);
    expect(restoredFromTrash.body.item.deletedAt).toBeNull();

    expect((await call('DELETE', `/api/items/${id}?permanent=true`)).status).toBe(409);
    await call('DELETE', `/api/items/${id}`);
    const permanent = await call('DELETE', `/api/items/${id}?permanent=true`);
    expect(permanent.status).toBe(200);
    expect((await call('GET', `/api/items/${id}`)).status).toBe(404);
  });
});

describe('API: import and export', () => {
  it('exports everything and reimports it into an empty database without duplicates', async () => {
    const bookmark = await call('POST', '/api/items/bookmarks', {
      url: 'https://example.com/exported',
      tags: ['keep'],
    });
    const note = await call('POST', '/api/items/notes', { title: 'Exported note', contentMd: 'body' });
    const collection = await call('POST', '/api/collections', { name: 'Exported shelf' });
    await call('PUT', `/api/items/${note.body.item.id}/collections`, {
      collectionIds: [collection.body.collection.id],
    });
    await call('POST', `/api/items/${note.body.item.id}/relationships`, {
      targetItemId: bookmark.body.item.id,
    });

    const exported = await call('GET', '/api/export');
    expect(exported.status).toBe(200);
    expect(exported.body.version).toBe(1);
    expect(exported.body.items).toHaveLength(2);
    expect(exported.body.items.some((item: { relationships?: unknown[] }) => item.relationships?.length)).toBe(true);

    const fresh = await createApp({ dbPath: tempDb() });
    await fresh.ready();
    const imported = await fresh.inject({
      method: 'POST',
      url: '/api/import',
      headers: { host: '127.0.0.1:4317' },
      payload: { mode: 'merge', data: exported.body },
    });
    expect(imported.statusCode).toBe(200);
    expect(JSON.parse(imported.body).imported).toBe(2);

    const items = await fresh.inject({ method: 'GET', url: '/api/items', headers: { host: '127.0.0.1:4317' } });
    const body = JSON.parse(items.body);
    expect(body.total).toBe(2);
    const importedNote = body.items.find((item: { type: string }) => item.type === 'note');
    const detail = await fresh.inject({
      method: 'GET',
      url: `/api/items/${importedNote.id}`,
      headers: { host: '127.0.0.1:4317' },
    });
    const detailBody = JSON.parse(detail.body);
    expect(detailBody.item.collections[0].name).toBe('Exported shelf');
    expect(detailBody.item.relationships).toHaveLength(1);

    const again = await fresh.inject({
      method: 'POST',
      url: '/api/import',
      headers: { host: '127.0.0.1:4317' },
      payload: { mode: 'merge', data: exported.body },
    });
    expect(JSON.parse(again.body).imported).toBe(0);
    await fresh.close();
  });

  it('rejects malformed imports without touching existing data', async () => {
    await call('POST', '/api/items/notes', { title: 'Survivor' });
    const bad = await call('POST', '/api/import', { mode: 'merge', data: { version: 99 } });
    expect(bad.status).toBe(400);
    expect((await call('GET', '/api/items')).body.total).toBe(1);
  });
});

describe('API: security', () => {
  it('rejects requests whose Host is not localhost', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/items',
      headers: { host: 'evil.example.com' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('rejects cross-origin writes', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/items/notes',
      headers: { host: '127.0.0.1:4317', origin: 'https://evil.example.com' },
      payload: { title: 'CSRF' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('accepts localhost origins', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/items/notes',
      headers: { host: '127.0.0.1:4317', origin: 'http://localhost:5173' },
      payload: { title: 'Local' },
    });
    expect(response.statusCode).toBe(201);
  });

  it('returns 400 rather than 500 for unknown fields and wrong types', async () => {
    const response = await call('POST', '/api/items/notes', { title: 42 });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION');
  });

  it('rejects a malformed metadata request', async () => {
    const response = await call('POST', '/api/metadata', {});
    expect(response.status).toBe(400);
  });
});
