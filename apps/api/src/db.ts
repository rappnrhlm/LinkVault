import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type DB = DatabaseSync;

const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '001_initial',
    sql: `
      create table items (
        id text primary key,
        type text not null check (type in ('bookmark','note')),
        title text not null,
        favorite integer not null default 0,
        created_at text not null,
        updated_at text not null,
        archived_at text,
        deleted_at text
      );
      create index idx_items_type on items(type);
      create index idx_items_updated on items(updated_at desc);
      create index idx_items_favorite on items(favorite);
      create index idx_items_deleted on items(deleted_at);

      create table bookmarks (
        item_id text primary key references items(id) on delete cascade,
        url text not null,
        normalized_url text not null,
        description text not null default '',
        site_name text not null default '',
        favicon_url text,
        is_read integer not null default 0,
        last_accessed_at text
      );
      create index idx_bookmarks_normalized on bookmarks(normalized_url);
      create index idx_bookmarks_read on bookmarks(is_read);

      create table notes (
        item_id text primary key references items(id) on delete cascade,
        content_md text not null default '',
        editor_mode text not null default 'markdown' check (editor_mode in ('markdown','rich')),
        word_count integer not null default 0
      );

      create table tags (
        id text primary key,
        name text not null,
        normalized_name text not null unique,
        color text not null
      );

      create table item_tags (
        item_id text not null references items(id) on delete cascade,
        tag_id text not null references tags(id) on delete cascade,
        primary key (item_id, tag_id)
      );
      create index idx_item_tags_tag on item_tags(tag_id);

      create table collections (
        id text primary key,
        name text not null,
        description text not null default '',
        created_at text not null,
        updated_at text not null
      );

      create table collection_items (
        collection_id text not null references collections(id) on delete cascade,
        item_id text not null references items(id) on delete cascade,
        primary key (collection_id, item_id)
      );
      create index idx_collection_items_item on collection_items(item_id);

      create table relationships (
        id text primary key,
        source_item_id text not null references items(id) on delete cascade,
        target_item_id text not null references items(id) on delete cascade,
        kind text not null default 'related' check (kind in ('related','references')),
        created_at text not null,
        unique (source_item_id, target_item_id),
        check (source_item_id <> target_item_id)
      );
      create index idx_relationships_target on relationships(target_item_id);

      create table settings (
        key text primary key,
        value text not null
      );

      create virtual table items_fts using fts5(
        item_id unindexed,
        title,
        body,
        meta,
        tokenize = 'unicode61 remove_diacritics 2'
      );
    `,
  },
];

export function openDb(file = process.env.LINKVAULT_DB ?? 'data/linkvault.db'): DB {
  const path = file === ':memory:' ? file : resolve(file);
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('pragma journal_mode = wal');
  db.exec('pragma foreign_keys = on');
  db.exec('pragma busy_timeout = 5000');
  migrate(db);
  return db;
}

export function migrate(db: DB): void {
  db.exec(`create table if not exists migrations (
    id text primary key,
    applied_at text not null
  )`);
  const applied = new Set(
    (db.prepare('select id from migrations').all() as { id: string }[]).map((row) => row.id),
  );
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    db.exec('begin');
    try {
      db.exec(migration.sql);
      db.prepare('insert into migrations (id, applied_at) values (?, ?)').run(
        migration.id,
        new Date().toISOString(),
      );
      db.exec('commit');
    } catch (error) {
      db.exec('rollback');
      throw error;
    }
  }
}

export function tx<T>(db: DB, fn: () => T): T {
  db.exec('begin');
  try {
    const result = fn();
    db.exec('commit');
    return result;
  } catch (error) {
    db.exec('rollback');
    throw error;
  }
}

export function now(): string {
  return new Date().toISOString();
}

export function nextTimestamp(previous?: string | null): string {
  const current = Date.now();
  if (!previous) return new Date(current).toISOString();
  const prior = Date.parse(previous);
  if (Number.isNaN(prior)) return new Date(current).toISOString();
  return new Date(current > prior ? current : prior + 1).toISOString();
}

export function bool(value: unknown): boolean {
  return value === 1 || value === true;
}
