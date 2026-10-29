import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDb, migrate, type DB } from '../db.js';
import {
  addRelationship,
  createBaseItem,
  createCollection,
  getItem,
  listItems,
  reindexItem,
  setItemTags,
  stats,
} from '../repo.js';

function tempDb(): string {
  return join(mkdtempSync(join(tmpdir(), 'linkvault-test-')), 'test.db');
}

describe('database', () => {
  let db: DB;

  beforeEach(() => {
    db = openDb(tempDb());
  });

  it('applies migrations once and records them', () => {
    const applied = db.prepare('select id from migrations').all() as { id: string }[];
    expect(applied.map((row) => row.id)).toContain('001_initial');
    migrate(db);
    const again = db.prepare('select id from migrations').all() as { id: string }[];
    expect(again).toHaveLength(applied.length);
    const tables = (db.prepare("select name from sqlite_master where type in ('table','view')").all() as {
      name: string;
    }[]).map((row) => row.name);
    for (const table of [
      'items',
      'bookmarks',
      'notes',
      'tags',
      'item_tags',
      'collections',
      'collection_items',
      'relationships',
      'settings',
      'items_fts',
    ]) {
      expect(tables).toContain(table);
    }
  });

  it('enforces foreign keys and cascades deletes', () => {
    const id = createBaseItem(db, { type: 'note', title: 'Cascade me' });
    db.prepare(
      "insert into notes (item_id, content_md, editor_mode, word_count) values (?, 'body', 'markdown', 1)",
    ).run(id);
    const other = createBaseItem(db, { type: 'bookmark', title: 'Other' });
    db.prepare(
      "insert into bookmarks (item_id, url, normalized_url) values (?, 'https://a.example/', 'https://a.example/')",
    ).run(other);
    addRelationship(db, id, other, 'related');
    expect(() =>
      db.prepare(
        "insert into notes (item_id, content_md, editor_mode) values ('missing', '', 'markdown')",
      ).run(),
    ).toThrow();
    db.prepare('delete from items where id = ?').run(id);
    expect(db.prepare('select * from notes where item_id = ?').all(id)).toHaveLength(0);
    expect(db.prepare('select * from relationships').all()).toHaveLength(0);
  });

  it('prevents duplicate and self relationships', () => {
    const a = createBaseItem(db, { type: 'note', title: 'A' });
    const b = createBaseItem(db, { type: 'note', title: 'B' });
    addRelationship(db, a, b, 'related');
    expect(() => addRelationship(db, a, b, 'related')).toThrow(/already linked/i);
    expect(() => addRelationship(db, a, a, 'related')).toThrow(/itself/i);
  });

  it('keeps tag names unique case-insensitively and counts them', () => {
    const a = createBaseItem(db, { type: 'note', title: 'A' });
    const b = createBaseItem(db, { type: 'note', title: 'B' });
    setItemTags(db, a, ['Design', 'reading']);
    setItemTags(db, b, ['design']);
    const tags = db.prepare('select name from tags order by name').all() as { name: string }[];
    expect(tags).toHaveLength(2);
    expect(stats(db).counts.tags).toBe(2);
  });

  it('filters archived and trashed items out of the active list', () => {
    const a = createBaseItem(db, { type: 'note', title: 'Active' });
    const b = createBaseItem(db, { type: 'note', title: 'Archived' });
    const c = createBaseItem(db, { type: 'note', title: 'Trashed' });
    db.prepare('update items set archived_at = ? where id = ?').run(new Date().toISOString(), b);
    db.prepare('update items set deleted_at = ? where id = ?').run(new Date().toISOString(), c);
    reindexItem(db, a);
    const active = listItems(db, { status: 'active', sort: 'updated', limit: 50, offset: 0 });
    expect(active.items.map((item) => item.title)).toEqual(['Active']);
    const archived = listItems(db, { status: 'archived', sort: 'updated', limit: 50, offset: 0 });
    expect(archived.items.map((item) => item.title)).toEqual(['Archived']);
    const trash = listItems(db, { status: 'trash', sort: 'updated', limit: 50, offset: 0 });
    expect(trash.items.map((item) => item.title)).toEqual(['Trashed']);
  });

  it('persists across reopen', () => {
    const file = tempDb();
    const first = openDb(file);
    const id = createBaseItem(first, { type: 'note', title: 'Persisted' });
    first.close();
    const second = openDb(file);
    expect(getItem(second, id)?.title).toBe('Persisted');
    second.close();
  });

  it('creates collections and assigns items', () => {
    const collection = createCollection(db, { name: 'Shelf', description: 'Mine' });
    const id = createBaseItem(db, { type: 'note', title: 'Inside' });
    db.prepare('insert into collection_items (collection_id, item_id) values (?, ?)').run(
      collection.id,
      id,
    );
    expect(getItem(db, id)?.collections[0]?.name).toBe('Shelf');
  });
});
