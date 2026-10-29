import { countWords, normalizeUrl } from '@linkvault/shared';
import { nextTimestamp, now, tx, type DB } from '../db.js';
import {
  createBaseItem,
  ensureTag,
  findBookmarkByNormalized,
  getItem,
  reindexItem,
  setItemCollections,
  setItemTags,
  touchItem,
} from '../repo.js';
import { fetchMetadata, MetadataError, type PageMetadata } from './metadata.js';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = 'ERROR',
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface CreateBookmarkInput {
  url: string;
  title?: string;
  description?: string;
  siteName?: string;
  faviconUrl?: string | null;
  tags?: string[];
  collectionIds?: string[];
}

function duplicate(existing: { id: string; title: string }): ApiError {
  return new ApiError(409, `Already saved as “${existing.title}”`, 'DUPLICATE_URL', {
    existingItemId: existing.id,
    existingTitle: existing.title,
  });
}

export async function createBookmark(db: DB, input: CreateBookmarkInput) {
  let normalized: string;
  try {
    normalized = normalizeUrl(input.url);
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : 'Invalid URL', 'INVALID_URL');
  }
  const existing = findBookmarkByNormalized(db, normalized);
  if (existing) throw duplicate(existing);

  let metadata: PageMetadata | null = null;
  let warning: string | null = null;
  try {
    metadata = await fetchMetadata(normalized);
  } catch (error) {
    warning =
      error instanceof MetadataError
        ? error.message
        : 'Metadata could not be retrieved. The bookmark was saved with the details you provided.';
  }

  const hostname = new URL(normalized).hostname.replace(/^www\./, '');
  const title = (input.title?.trim() || metadata?.title || hostname).slice(0, 300);
  const id = tx(db, () => {
    const itemId = createBaseItem(db, { type: 'bookmark', title });
    db.prepare(
      `insert into bookmarks (item_id, url, normalized_url, description, site_name, favicon_url, is_read)
       values (?, ?, ?, ?, ?, ?, 0)`,
    ).run(
      itemId,
      metadata?.url ?? normalized,
      normalized,
      (input.description ?? metadata?.description ?? '').slice(0, 4000),
      (input.siteName ?? metadata?.siteName ?? hostname).slice(0, 200),
      input.faviconUrl !== undefined ? input.faviconUrl : metadata?.faviconUrl ?? null,
    );
    if (input.tags?.length) setItemTags(db, itemId, input.tags);
    if (input.collectionIds?.length) setItemCollections(db, itemId, input.collectionIds);
    reindexItem(db, itemId);
    return itemId;
  });
  return { item: getItem(db, id)!, warning };
}

export function createNote(
  db: DB,
  input: { title?: string; contentMd?: string; editorMode?: 'markdown' | 'rich'; tags?: string[]; collectionIds?: string[] },
) {
  const content = input.contentMd ?? '';
  const id = tx(db, () => {
    const itemId = createBaseItem(db, { type: 'note', title: input.title?.trim() || 'Untitled note' });
    db.prepare(
      'insert into notes (item_id, content_md, editor_mode, word_count) values (?, ?, ?, ?)',
    ).run(itemId, content, input.editorMode ?? 'markdown', countWords(content));
    if (input.tags?.length) setItemTags(db, itemId, input.tags);
    if (input.collectionIds?.length) setItemCollections(db, itemId, input.collectionIds);
    reindexItem(db, itemId);
    return itemId;
  });
  return getItem(db, id)!;
}

export function updateItem(
  db: DB,
  id: string,
  patch: {
    title?: string;
    favorite?: boolean;
    archived?: boolean;
    deleted?: boolean;
    bookmark?: {
      title?: string;
      url?: string;
      description?: string;
      siteName?: string;
      faviconUrl?: string | null;
      isRead?: boolean;
    };
  },
) {
  const current = getItem(db, id);
  if (!current) throw new ApiError(404, 'Item not found', 'NOT_FOUND');
  const timestamp = nextTimestamp(current.updatedAt);
  tx(db, () => {
    if (patch.title !== undefined) {
      db.prepare('update items set title = ?, updated_at = ? where id = ?').run(patch.title, timestamp, id);
    }
    if (patch.favorite !== undefined) {
      db.prepare('update items set favorite = ?, updated_at = ? where id = ?').run(
        patch.favorite ? 1 : 0,
        timestamp,
        id,
      );
    }
    if (patch.archived !== undefined) {
      db.prepare('update items set archived_at = ?, updated_at = ? where id = ?').run(
        patch.archived ? timestamp : null,
        timestamp,
        id,
      );
    }
    if (patch.deleted !== undefined) {
      db.prepare('update items set deleted_at = ?, updated_at = ? where id = ?').run(
        patch.deleted ? timestamp : null,
        timestamp,
        id,
      );
      if (patch.deleted) db.prepare('update items set archived_at = null where id = ?').run(id);
    }
    if (patch.bookmark && current.type === 'bookmark') {
      const bookmark = current.bookmark!;
      const nextUrl = patch.bookmark.url !== undefined ? patch.bookmark.url : bookmark.url;
      let normalized = bookmark.normalizedUrl;
      if (patch.bookmark.url !== undefined) {
        try {
          normalized = normalizeUrl(nextUrl);
        } catch (error) {
          throw new ApiError(400, error instanceof Error ? error.message : 'Invalid URL', 'INVALID_URL');
        }
        const existing = findBookmarkByNormalized(db, normalized, id);
        if (existing) throw duplicate(existing);
      }
      db.prepare(
        `update bookmarks set url = ?, normalized_url = ?, description = ?, site_name = ?, favicon_url = ?, is_read = ?
         where item_id = ?`,
      ).run(
        nextUrl,
        normalized,
        patch.bookmark.description ?? bookmark.description,
        patch.bookmark.siteName ?? bookmark.siteName,
        patch.bookmark.faviconUrl !== undefined ? patch.bookmark.faviconUrl : bookmark.faviconUrl,
        patch.bookmark.isRead !== undefined ? (patch.bookmark.isRead ? 1 : 0) : bookmark.isRead ? 1 : 0,
        id,
      );
      if (patch.bookmark.title !== undefined) {
        db.prepare('update items set title = ? where id = ?').run(patch.bookmark.title, id);
      }
    }
    touchItem(db, id, timestamp);
    reindexItem(db, id);
  });
  return getItem(db, id)!;
}

export function saveNoteContent(
  db: DB,
  id: string,
  input: { contentMd: string; editorMode: 'markdown' | 'rich'; baseUpdatedAt?: string },
) {
  const current = getItem(db, id);
  if (!current) throw new ApiError(404, 'Item not found', 'NOT_FOUND');
  if (current.type !== 'note') throw new ApiError(400, 'That item is not a note', 'NOT_A_NOTE');
  if (input.baseUpdatedAt && input.baseUpdatedAt !== current.updatedAt) {
    throw new ApiError(409, 'This note changed elsewhere. Reload before saving.', 'STALE_WRITE', {
      currentUpdatedAt: current.updatedAt,
      currentContentMd: current.note?.contentMd ?? '',
    });
  }
  const timestamp = nextTimestamp(current.updatedAt);
  tx(db, () => {
    db.prepare(
      'update notes set content_md = ?, editor_mode = ?, word_count = ? where item_id = ?',
    ).run(input.contentMd, input.editorMode, countWords(input.contentMd), id);
    touchItem(db, id, timestamp);
    reindexItem(db, id);
  });
  return getItem(db, id)!;
}

export function visitBookmark(db: DB, id: string) {
  const current = getItem(db, id);
  if (!current) throw new ApiError(404, 'Item not found', 'NOT_FOUND');
  if (current.type !== 'bookmark') throw new ApiError(400, 'That item is not a bookmark', 'NOT_A_BOOKMARK');
  const timestamp = nextTimestamp(current.updatedAt);
  db.prepare(
    'update bookmarks set is_read = 1, last_accessed_at = ? where item_id = ?',
  ).run(timestamp, id);
  touchItem(db, id, timestamp);
  return getItem(db, id)!;
}

export function restoreItem(db: DB, id: string) {
  const current = getItem(db, id);
  if (!current) throw new ApiError(404, 'Item not found', 'NOT_FOUND');
  db.prepare('update items set deleted_at = null, archived_at = null, updated_at = ? where id = ?').run(
    nextTimestamp(current.updatedAt),
    id,
  );
  reindexItem(db, id);
  return getItem(db, id)!;
}

export function permanentlyDelete(db: DB, id: string) {
  const current = getItem(db, id);
  if (!current) throw new ApiError(404, 'Item not found', 'NOT_FOUND');
  if (!current.deletedAt) {
    throw new ApiError(409, 'Move the item to Trash before deleting it permanently', 'NOT_TRASHED');
  }
  db.prepare('delete from items where id = ?').run(id);
  db.prepare('delete from items_fts where item_id = ?').run(id);
  return true;
}

export { ensureTag };
