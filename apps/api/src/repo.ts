import { randomUUID } from 'node:crypto';
import { excerptFromMarkdown, normalizeUrl, type Collection, type ImportPayload, type Item, type ItemDetail, type ItemStatus, type ItemType, type Relationship, type Tag } from '@linkvault/shared';
import { bool, now, tx, type DB } from './db.js';

type Row = Record<string, unknown>;

const TAG_COLORS = ['#1b6e66', '#7c5a2e', '#5b5f97', '#8a3f4a', '#3d6b3f', '#4f5b62', '#7a4b75', '#2f5d7c'];

export function tagColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length]!;
}

export function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function baseItem(row: Row): Item {
  return {
    id: row.id as string,
    type: row.type as ItemType,
    title: row.title as string,
    favorite: bool(row.favorite),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    archivedAt: (row.archived_at as string | null) ?? null,
    deletedAt: (row.deleted_at as string | null) ?? null,
    tags: [],
    collections: [],
  };
}

function bookmarkData(row: Row) {
  return {
    url: row.url as string,
    normalizedUrl: row.normalized_url as string,
    description: (row.description as string) ?? '',
    siteName: (row.site_name as string) ?? '',
    faviconUrl: (row.favicon_url as string | null) ?? null,
    isRead: bool(row.is_read),
    lastAccessedAt: (row.last_accessed_at as string | null) ?? null,
  };
}

function noteData(row: Row) {
  return {
    contentMd: (row.content_md as string) ?? '',
    editorMode: (row.editor_mode as 'markdown' | 'rich') ?? 'markdown',
    wordCount: Number(row.word_count ?? 0),
  };
}

export function hydrateItems(db: DB, rows: Row[]): Item[] {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id as string);
  const placeholders = ids.map(() => '?').join(',');
  const tagRows = db
    .prepare(
      `select it.item_id, t.id, t.name, t.color from item_tags it join tags t on t.id = it.tag_id
       where it.item_id in (${placeholders}) order by t.name collate nocase`,
    )
    .all(...ids) as Row[];
  const collectionRows = db
    .prepare(
      `select ci.item_id, c.id, c.name from collection_items ci join collections c on c.id = ci.collection_id
       where ci.item_id in (${placeholders}) order by c.name collate nocase`,
    )
    .all(...ids) as Row[];
  const tagsByItem = new Map<string, Tag[]>();
  for (const row of tagRows) {
    const list = tagsByItem.get(row.item_id as string) ?? [];
    list.push({ id: row.id as string, name: row.name as string, color: row.color as string });
    tagsByItem.set(row.item_id as string, list);
  }
  const collectionsByItem = new Map<string, Pick<Collection, 'id' | 'name'>[]>();
  for (const row of collectionRows) {
    const list = collectionsByItem.get(row.item_id as string) ?? [];
    list.push({ id: row.id as string, name: row.name as string });
    collectionsByItem.set(row.item_id as string, list);
  }
  return rows.map((row) => {
    const item = baseItem(row);
    item.tags = tagsByItem.get(item.id) ?? [];
    item.collections = collectionsByItem.get(item.id) ?? [];
    if (item.type === 'bookmark' && row.url !== undefined) item.bookmark = bookmarkData(row);
    if (item.type === 'note' && row.content_md !== undefined) {
      item.note = noteData(row);
      item.excerpt = excerptFromMarkdown(item.note.contentMd);
    }
    if (item.type === 'bookmark' && item.bookmark) {
      item.excerpt = item.bookmark.description || item.bookmark.siteName || item.bookmark.url;
    }
    return item;
  });
}

function itemSelect(): string {
  return `select i.*, b.url, b.normalized_url, b.description, b.site_name, b.favicon_url,
            b.is_read, b.last_accessed_at, n.content_md, n.editor_mode, n.word_count
          from items i
          left join bookmarks b on b.item_id = i.id
          left join notes n on n.item_id = i.id`;
}

export function getItemRow(db: DB, id: string): Row | undefined {
  return db.prepare(`${itemSelect()} where i.id = ?`).get(id) as Row | undefined;
}

export function getItem(db: DB, id: string): ItemDetail | null {
  const row = getItemRow(db, id);
  if (!row) return null;
  const [item] = hydrateItems(db, [row]);
  if (!item) return null;
  const outgoing = db
    .prepare(
      `select r.*, i.type as target_type, i.title as target_title
       from relationships r join items i on i.id = r.target_item_id
       where r.source_item_id = ? order by r.created_at desc`,
    )
    .all(id) as Row[];
  const incoming = db
    .prepare(
      `select r.*, i.type as target_type, i.title as target_title
       from relationships r join items i on i.id = r.source_item_id
       where r.target_item_id = ? order by r.created_at desc`,
    )
    .all(id) as Row[];
  const mapRel = (row: Row): Relationship => ({
    id: row.id as string,
    sourceItemId: row.source_item_id as string,
    targetItemId: row.target_item_id as string,
    kind: row.kind as string,
    createdAt: row.created_at as string,
    target: {
      id: row.target_item_id as string,
      type: row.target_type as ItemType,
      title: row.target_title as string,
    },
  });
  return {
    ...item,
    relationships: outgoing.map(mapRel),
    backlinks: incoming.map((row) =>
      mapRel({
        ...row,
        target_item_id: row.source_item_id,
        target_type: row.target_type,
        target_title: row.target_title,
      }),
    ),
  };
}

export interface ListOptions {
  type?: ItemType;
  status: ItemStatus;
  favorite?: boolean;
  read?: boolean;
  tag?: string;
  collection?: string;
  q?: string;
  sort: 'updated' | 'created' | 'title';
  limit: number;
  offset: number;
}

export function listItems(db: DB, options: ListOptions): { items: Item[]; total: number } {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (options.status === 'active') where.push('i.deleted_at is null and i.archived_at is null');
  if (options.status === 'archived') where.push('i.deleted_at is null and i.archived_at is not null');
  if (options.status === 'trash') where.push('i.deleted_at is not null');
  if (options.type) {
    where.push('i.type = ?');
    params.push(options.type);
  }
  if (options.favorite) where.push('i.favorite = 1');
  if (options.read !== undefined) {
    where.push(
      "i.type = 'bookmark' and exists (select 1 from bookmarks b where b.item_id = i.id and b.is_read = ?)",
    );
    params.push(options.read ? 1 : 0);
  }
  if (options.tag) {
    where.push(
      'exists (select 1 from item_tags it join tags t on t.id = it.tag_id where it.item_id = i.id and t.normalized_name = ?)',
    );
    params.push(normalizeTagName(options.tag));
  }
  if (options.collection) {
    where.push(
      'exists (select 1 from collection_items ci where ci.item_id = i.id and ci.collection_id = ?)',
    );
    params.push(options.collection);
  }
  if (options.q) {
    const match = ftsQuery(options.q);
    if (match) {
      where.push('i.id in (select item_id from items_fts where items_fts match ?)');
      params.push(match);
    }
  }
  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const order =
    options.sort === 'title'
      ? 'i.title collate nocase asc'
      : options.sort === 'created'
        ? 'i.created_at desc'
        : 'i.updated_at desc';
  const total = Number(
    (db.prepare(`select count(*) as c from items i ${whereSql}`).get(...params) as Row).c,
  );
  const rows = db
    .prepare(`${itemSelect()} ${whereSql} order by ${order} limit ? offset ?`)
    .all(...params, options.limit, options.offset) as Row[];
  return { items: hydrateItems(db, rows), total };
}

export function ftsQuery(q: string): string | null {
  const tokens = q
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_-]/gu, ''))
    .filter((token) => token.length > 0)
    .slice(0, 12);
  if (tokens.length === 0) return null;
  return tokens.map((token) => `"${token.replace(/"/g, '""')}"*`).join(' AND ');
}

export function searchItems(
  db: DB,
  q: string,
  limit = 30,
): { item: Item; snippet: string; rank: number }[] {
  const match = ftsQuery(q);
  if (!match) return [];
  const rows = db
    .prepare(
      `select i.*, b.url, b.normalized_url, b.description, b.site_name, b.favicon_url,
              b.is_read, b.last_accessed_at, n.content_md, n.editor_mode, n.word_count,
              snippet(items_fts, 2, char(1), char(2), '…', 14) as snip,
              bm25(items_fts) as rank
       from items_fts f
       join items i on i.id = f.item_id
       left join bookmarks b on b.item_id = i.id
       left join notes n on n.item_id = i.id
       where items_fts match ? and i.deleted_at is null
       order by rank limit ?`,
    )
    .all(match, limit) as Row[];
  const items = hydrateItems(db, rows);
  return items.map((item, index) => ({
    item,
    snippet: (rows[index]!.snip as string) ?? '',
    rank: Number(rows[index]!.rank ?? 0),
  }));
}

export function reindexItem(db: DB, itemId: string): void {
  const row = getItemRow(db, itemId);
  db.prepare('delete from items_fts where item_id = ?').run(itemId);
  if (!row) return;
  const tags = (
    db
      .prepare(
        'select t.name from item_tags it join tags t on t.id = it.tag_id where it.item_id = ?',
      )
      .all(itemId) as Row[]
  )
    .map((tag) => tag.name as string)
    .join(' ');
  const collections = (
    db
      .prepare(
        'select c.name from collection_items ci join collections c on c.id = ci.collection_id where ci.item_id = ?',
      )
      .all(itemId) as Row[]
  )
    .map((collection) => collection.name as string)
    .join(' ');
  const isBookmark = row.type === 'bookmark';
  const body = isBookmark
    ? [row.url, row.description, row.site_name].filter(Boolean).join(' ')
    : (row.content_md as string) ?? '';
  db.prepare('insert into items_fts (item_id, title, body, meta) values (?, ?, ?, ?)').run(
    itemId,
    row.title as string,
    body,
    [row.type, tags, collections].filter(Boolean).join(' '),
  );
}

export function reindexAll(db: DB): void {
  db.exec('delete from items_fts');
  const ids = db.prepare('select id from items').all() as Row[];
  for (const row of ids) reindexItem(db, row.id as string);
}

export function createBaseItem(
  db: DB,
  input: { type: ItemType; title: string; favorite?: boolean; archived?: boolean; deleted?: boolean },
): string {
  const id = randomUUID();
  const timestamp = now();
  db.prepare(
    `insert into items (id, type, title, favorite, created_at, updated_at, archived_at, deleted_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.type,
    input.title,
    input.favorite ? 1 : 0,
    timestamp,
    timestamp,
    input.archived ? timestamp : null,
    input.deleted ? timestamp : null,
  );
  return id;
}

export function touchItem(db: DB, id: string, timestamp = now()): void {
  db.prepare('update items set updated_at = ? where id = ?').run(timestamp, id);
}

export function findBookmarkByNormalized(db: DB, normalized: string, excludeId?: string) {
  const row = db
    .prepare(
      `select i.*, b.url, b.normalized_url, b.description, b.site_name, b.favicon_url,
              b.is_read, b.last_accessed_at
       from bookmarks b join items i on i.id = b.item_id
       where b.normalized_url = ? and i.deleted_at is null and i.id <> ? limit 1`,
    )
    .get(normalized, excludeId ?? '') as Row | undefined;
  if (!row) return null;
  return hydrateItems(db, [row])[0] ?? null;
}

export function setItemTags(db: DB, itemId: string, names: string[]): void {
  db.prepare('delete from item_tags where item_id = ?').run(itemId);
  for (const name of names) {
    const tag = ensureTag(db, name);
    db.prepare('insert or ignore into item_tags (item_id, tag_id) values (?, ?)').run(itemId, tag.id);
  }
  reindexItem(db, itemId);
}

export function ensureTag(db: DB, name: string, color?: string): Tag {
  const normalized = normalizeTagName(name);
  const existing = db
    .prepare('select id, name, color from tags where normalized_name = ?')
    .get(normalized) as Row | undefined;
  if (existing) {
    return { id: existing.id as string, name: existing.name as string, color: existing.color as string };
  }
  const id = randomUUID();
  const clean = name.trim().replace(/\s+/g, ' ');
  const chosen = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : tagColor(clean);
  db.prepare('insert into tags (id, name, normalized_name, color) values (?, ?, ?, ?)').run(
    id,
    clean,
    normalized,
    chosen,
  );
  return { id, name: clean, color: chosen };
}

export function setItemCollections(db: DB, itemId: string, collectionIds: string[]): void {
  db.prepare('delete from collection_items where item_id = ?').run(itemId);
  for (const collectionId of new Set(collectionIds)) {
    db.prepare(
      'insert or ignore into collection_items (collection_id, item_id) values (?, ?)',
    ).run(collectionId, itemId);
  }
  reindexItem(db, itemId);
}

export function listTags(db: DB): Tag[] {
  return (
    db
      .prepare(
        `select t.id, t.name, t.color, count(it.item_id) as count
         from tags t
         left join item_tags it on it.tag_id = t.id
         left join items i on i.id = it.item_id and i.deleted_at is null
         group by t.id order by t.name collate nocase`,
      )
      .all() as Row[]
  ).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    color: row.color as string,
    count: Number(row.count ?? 0),
  }));
}

export function listCollections(db: DB): Collection[] {
  return (
    db
      .prepare(
        `select c.*, count(ci.item_id) as item_count
         from collections c
         left join collection_items ci on ci.collection_id = c.id
         left join items i on i.id = ci.item_id and i.deleted_at is null
         group by c.id order by c.name collate nocase`,
      )
      .all() as Row[]
  ).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    itemCount: Number(row.item_count ?? 0),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

export function getCollection(db: DB, id: string): Collection | null {
  return listCollections(db).find((collection) => collection.id === id) ?? null;
}

export function addRelationship(
  db: DB,
  sourceItemId: string,
  targetItemId: string,
  kind: string,
): Relationship {
  if (sourceItemId === targetItemId) throw new Error('An item cannot link to itself');
  const existing = db
    .prepare('select * from relationships where source_item_id = ? and target_item_id = ?')
    .get(sourceItemId, targetItemId) as Row | undefined;
  if (existing) throw new Error('These items are already linked');
  const id = randomUUID();
  const createdAt = now();
  db.prepare(
    'insert into relationships (id, source_item_id, target_item_id, kind, created_at) values (?, ?, ?, ?, ?)',
  ).run(id, sourceItemId, targetItemId, kind, createdAt);
  return { id, sourceItemId, targetItemId, kind, createdAt };
}

export function deleteRelationship(db: DB, id: string): boolean {
  return db.prepare('delete from relationships where id = ?').run(id).changes > 0;
}

export function stats(db: DB) {
  const count = (sql: string, ...params: (string | number)[]) =>
    Number((db.prepare(sql).get(...params) as Row).c);
  const recent = hydrateItems(
    db,
    db
      .prepare(
        `${itemSelect()} where i.deleted_at is null and i.archived_at is null
         order by i.created_at desc limit 5`,
      )
      .all() as Row[],
  );
  const unread = hydrateItems(
    db,
    db
      .prepare(
        `${itemSelect()} where i.deleted_at is null and i.archived_at is null
         and i.type = 'bookmark' and b.is_read = 0 order by i.created_at desc limit 4`,
      )
      .all() as Row[],
  );
  const recentNotes = hydrateItems(
    db,
    db
      .prepare(
        `${itemSelect()} where i.deleted_at is null and i.archived_at is null and i.type = 'note'
         order by i.updated_at desc limit 3`,
      )
      .all() as Row[],
  );
  return {
    counts: {
      active: count('select count(*) as c from items where deleted_at is null and archived_at is null'),
      bookmarks: count(
        "select count(*) as c from items where deleted_at is null and archived_at is null and type = 'bookmark'",
      ),
      notes: count(
        "select count(*) as c from items where deleted_at is null and archived_at is null and type = 'note'",
      ),
      unread: count(
        "select count(*) as c from bookmarks b join items i on i.id = b.item_id where i.deleted_at is null and i.archived_at is null and b.is_read = 0",
      ),
      favorites: count('select count(*) as c from items where deleted_at is null and favorite = 1'),
      archived: count('select count(*) as c from items where deleted_at is null and archived_at is not null'),
      trash: count('select count(*) as c from items where deleted_at is not null'),
      tags: count('select count(*) as c from tags'),
      collections: count('select count(*) as c from collections'),
    },
    recent,
    unread,
    recentNotes,
    tags: listTags(db)
      .filter((tag) => (tag.count ?? 0) > 0)
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 6),
    collections: listCollections(db).slice(0, 5),
  };
}

export function exportAll(db: DB) {
  const itemRows = db
    .prepare(
      `select i.*, b.url, b.description as b_description, b.site_name, b.favicon_url, b.is_read,
              n.content_md, n.editor_mode
       from items i left join bookmarks b on b.item_id = i.id left join notes n on n.item_id = i.id
       order by i.created_at asc`,
    )
    .all() as Row[];
  const tags = listTags(db).map(({ name, color }) => ({ name, color }));
  const collections = listCollections(db).map(({ name, description }) => ({ name, description }));
  const tagRows = db
    .prepare('select it.item_id, t.name, t.color from item_tags it join tags t on t.id = it.tag_id')
    .all() as Row[];
  const collectionRows = db
    .prepare('select ci.item_id, c.name, c.description from collection_items ci join collections c on c.id = ci.collection_id')
    .all() as Row[];
  const relationships = db.prepare('select * from relationships').all() as Row[];
  return {
    version: 1 as const,
    exportedAt: now(),
    items: itemRows.map((row) => ({
      id: row.id as string,
      type: row.type as ItemType,
      title: row.title as string,
      favorite: bool(row.favorite),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      archivedAt: (row.archived_at as string | null) ?? null,
      deletedAt: (row.deleted_at as string | null) ?? null,
      bookmark:
        row.type === 'bookmark'
          ? {
              url: row.url as string,
              description: (row.b_description as string) ?? '',
              siteName: (row.site_name as string) ?? '',
              faviconUrl: (row.favicon_url as string | null) ?? null,
              isRead: bool(row.is_read),
            }
          : undefined,
      note:
        row.type === 'note'
          ? { contentMd: (row.content_md as string) ?? '', editorMode: row.editor_mode as 'markdown' | 'rich' }
          : undefined,
      tags: tagRows
        .filter((tag) => tag.item_id === row.id)
        .map((tag) => ({ name: tag.name as string, color: tag.color as string })),
      collections: collectionRows
        .filter((collection) => collection.item_id === row.id)
        .map((collection) => ({
          name: collection.name as string,
          description: (collection.description as string) ?? '',
        })),
      relationships: relationships
        .filter((rel) => rel.source_item_id === row.id)
        .map((rel) => ({ targetItemId: rel.target_item_id as string, kind: rel.kind as string })),
    })),
    tags,
    collections,
  };
}

export function importAll(
  db: DB,
  payload: ImportPayload,
  mode: 'merge' = 'merge',
): { imported: number; skipped: number } {
  return tx(db, () => {
    const existing = new Set(
      (db.prepare('select id from items').all() as Row[]).map((row) => row.id as string),
    );
    let imported = 0;
    let skipped = 0;
    for (const tag of payload.tags ?? []) ensureTag(db, tag.name, tag.color);
    for (const item of payload.items) {
      if (existing.has(item.id)) {
        skipped += 1;
        continue;
      }
      if (item.type === 'bookmark') {
        if (!item.bookmark) {
          skipped += 1;
          continue;
        }
        try {
          item.bookmark.url = normalizeUrl(item.bookmark.url);
        } catch {
          skipped += 1;
          continue;
        }
        const duplicate = findBookmarkByNormalized(db, item.bookmark.url);
        if (duplicate) {
          skipped += 1;
          continue;
        }
      }
      db.prepare(
        `insert into items (id, type, title, favorite, created_at, updated_at, archived_at, deleted_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        item.id,
        item.type,
        item.title,
        item.favorite ? 1 : 0,
        item.createdAt,
        item.updatedAt,
        item.archivedAt ?? null,
        item.deletedAt ?? null,
      );
      if (item.type === 'bookmark' && item.bookmark) {
        const normalized = item.bookmark.url;
        db.prepare(
          `insert into bookmarks (item_id, url, normalized_url, description, site_name, favicon_url, is_read)
           values (?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          item.id,
          item.bookmark.url,
          normalized,
          item.bookmark.description ?? '',
          item.bookmark.siteName ?? '',
          item.bookmark.faviconUrl ?? null,
          item.bookmark.isRead ? 1 : 0,
        );
      }
      if (item.type === 'note' && item.note) {
        db.prepare(
          'insert into notes (item_id, content_md, editor_mode, word_count) values (?, ?, ?, ?)',
        ).run(
          item.id,
          item.note.contentMd,
          item.note.editorMode,
          item.note.contentMd.trim() ? item.note.contentMd.trim().split(/\s+/).length : 0,
        );
      }
      for (const tag of item.tags ?? []) {
        const ensured = ensureTag(db, tag.name, tag.color);
        db.prepare('insert or ignore into item_tags (item_id, tag_id) values (?, ?)').run(item.id, ensured.id);
      }
      for (const collection of item.collections ?? []) {
        let existingCollection = db
          .prepare('select id from collections where name = ? collate nocase')
          .get(collection.name) as Row | undefined;
        if (!existingCollection) {
          const id = randomUUID();
          const timestamp = now();
          db.prepare(
            'insert into collections (id, name, description, created_at, updated_at) values (?, ?, ?, ?, ?)',
          ).run(id, collection.name, collection.description ?? '', timestamp, timestamp);
          existingCollection = { id };
        }
        db.prepare(
          'insert or ignore into collection_items (collection_id, item_id) values (?, ?)',
        ).run(existingCollection.id as string, item.id);
      }
      imported += 1;
    }
    for (const item of payload.items) {
      if (!existing.has(item.id)) {
        for (const rel of item.relationships ?? []) {
          const targetExists = db
            .prepare('select 1 as x from items where id = ?')
            .get(rel.targetItemId);
          if (targetExists && rel.targetItemId !== item.id) {
            db.prepare(
              `insert or ignore into relationships (id, source_item_id, target_item_id, kind, created_at)
               values (?, ?, ?, ?, ?)`,
            ).run(randomUUID(), item.id, rel.targetItemId, rel.kind === 'references' ? 'references' : 'related', now());
          }
        }
      }
    }
    reindexAll(db);
    return { imported, skipped };
  });
}

export function createCollection(
  db: DB,
  input: { name: string; description?: string },
): Collection {
  const id = randomUUID();
  const timestamp = now();
  db.prepare(
    'insert into collections (id, name, description, created_at, updated_at) values (?, ?, ?, ?, ?)',
  ).run(id, input.name.trim(), input.description ?? '', timestamp, timestamp);
  return {
    id,
    name: input.name.trim(),
    description: input.description ?? '',
    itemCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateCollection(
  db: DB,
  id: string,
  input: { name?: string; description?: string },
): Collection | null {
  const existing = getCollection(db, id);
  if (!existing) return null;
  db.prepare('update collections set name = ?, description = ?, updated_at = ? where id = ?').run(
    input.name?.trim() ?? existing.name,
    input.description ?? existing.description,
    now(),
    id,
  );
  return getCollection(db, id);
}

export function deleteCollection(db: DB, id: string): boolean {
  return db.prepare('delete from collections where id = ?').run(id).changes > 0;
}

export function setCollectionItems(db: DB, collectionId: string, itemIds: string[]): void {
  db.prepare('delete from collection_items where collection_id = ?').run(collectionId);
  for (const itemId of new Set(itemIds)) {
    db.prepare(
      'insert or ignore into collection_items (collection_id, item_id) values (?, ?)',
    ).run(collectionId, itemId);
  }
  const rows = db.prepare('select id from items').all() as Row[];
  for (const row of rows) reindexItem(db, row.id as string);
}
