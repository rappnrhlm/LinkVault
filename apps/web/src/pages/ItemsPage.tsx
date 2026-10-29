import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilePlus, Plus, Search, X } from 'lucide-react';
import type { Item } from '../lib/api';
import { api } from '../lib/api';
import { useDebounced, useResource } from '../lib/hooks';
import { Modal, useUi } from '../lib/ui';
import PageHeader from '../components/PageHeader';
import ItemRow from '../components/ItemRow';
import { EmptyState, ErrorState, LoadingRows } from '../components/States';

type View = 'all' | 'bookmarks' | 'notes' | 'favorites' | 'archive' | 'trash';

const copy: Record<View, { title: string; empty: string; emptyBody: string }> = {
  all: {
    title: 'All items',
    empty: 'The shelf is empty',
    emptyBody: 'Save a link or start a note. Everything you add stays on this device.',
  },
  bookmarks: {
    title: 'Bookmarks',
    empty: 'No bookmarks yet',
    emptyBody: 'Paste a URL and LinkVault will fetch the page title, description and favicon.',
  },
  notes: {
    title: 'Notes',
    empty: 'No notes yet',
    emptyBody: 'Notes are written in Markdown and can switch to rich text at any time.',
  },
  favorites: {
    title: 'Favorites',
    empty: 'Nothing starred yet',
    emptyBody: 'Star the links and notes you want to keep within reach.',
  },
  archive: {
    title: 'Archive',
    empty: 'The archive is empty',
    emptyBody: 'Archived items are out of the way but still searchable.',
  },
  trash: {
    title: 'Trash',
    empty: 'Trash is empty',
    emptyBody: 'Deleted items wait here until you restore them or delete them forever.',
  },
};

export default function ItemsPage({ view }: { view: View }) {
  const { refreshKey, bump, openCapture, toast } = useUi();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const sort = (params.get('sort') as 'updated' | 'created' | 'title') ?? 'updated';
  const read = params.get('read') as 'true' | 'false' | null;
  const tag = params.get('tag');
  const [search, setSearch] = useState(q);
  const debounced = useDebounced(search, 300);
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (debounced === q) return;
    const next = new URLSearchParams(params);
    if (debounced.trim()) next.set('q', debounced.trim());
    else next.delete('q');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    setSearch(q);
  }, [q]);

  const status = view === 'archive' ? 'archived' : view === 'trash' ? 'trash' : 'active';
  const type = view === 'bookmarks' ? 'bookmark' : view === 'notes' ? 'note' : undefined;
  const favorite = view === 'favorites' ? 'true' : undefined;

  const { data, error, loading, reload } = useResource(
    () =>
      api.listItems({
        type,
        status,
        favorite,
        read: view === 'bookmarks' ? read ?? undefined : undefined,
        tag: tag || undefined,
        q: q || undefined,
        sort,
        limit: 200,
      }),
    [type, status, favorite, read, tag, q, sort, refreshKey],
  );

  function setFilter(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  function refreshAll() {
    reload();
    bump();
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const meta = copy[view];
  const mode = view === 'trash' ? 'trash' : view === 'archive' ? 'archived' : 'normal';

  return (
    <div className="page">
      <PageHeader
        title={tag ? `Tagged “${tag}”` : meta.title}
        subtitle={
          data
            ? `${total} ${total === 1 ? 'item' : 'items'}${q ? ` matching “${q}”` : ''}`
            : 'Reading the shelf…'
        }
        actions={
          view === 'bookmarks' ? (
            <button type="button" className="btn btn-primary" onClick={() => openCapture('bookmark')}>
              <Plus size={15} /> New bookmark
            </button>
          ) : view === 'notes' ? (
            <button type="button" className="btn btn-primary" onClick={() => openCapture('note')}>
              <FilePlus size={15} /> New note
            </button>
          ) : view === 'all' ? (
            <>
              <button type="button" className="btn" onClick={() => openCapture('note')}>
                <FilePlus size={15} /> New note
              </button>
              <button type="button" className="btn btn-primary" onClick={() => openCapture('bookmark')}>
                <Plus size={15} /> New bookmark
              </button>
            </>
          ) : undefined
        }
      />

      {tag && (
        <div className="active-filter">
          <span>Tag: <strong>{tag}</strong></span>
          <button type="button" className="link-btn" onClick={() => setFilter('tag', null)}>
            Clear
          </button>
        </div>
      )}

      <div className="filter-bar">
        <div className="filter-search">
          <Search size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter this shelf…"
            aria-label="Filter items"
          />
          {search && (
            <button type="button" className="clear-btn" onClick={() => setSearch('')} aria-label="Clear filter">
              <X size={14} />
            </button>
          )}
        </div>

        {view === 'bookmarks' && (
          <div className="segmented" role="group" aria-label="Read status">
            {([
              ['all', 'All'],
              ['false', 'Unread'],
              ['true', 'Read'],
            ] as [string, string][]).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={(value === 'all' ? !read : read === value) ? 'on' : ''}
                onClick={() => setFilter('read', value === 'all' ? null : value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <label className="sort-control">
          <span>Sort</span>
          <select className="select" value={sort} onChange={(event) => setFilter('sort', event.target.value)}>
            <option value="updated">Last edited</option>
            <option value="created">Recently saved</option>
            <option value="title">Title</option>
          </select>
        </label>
      </div>

      {loading && !data ? (
        <LoadingRows count={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState
          title={q ? 'No matches on this shelf' : meta.empty}
          action={
            q ? (
              <button type="button" className="btn" onClick={() => setSearch('')}>Clear the filter</button>
            ) : view === 'bookmarks' ? (
              <button type="button" className="btn" onClick={() => openCapture('bookmark')}>Save a link</button>
            ) : view === 'notes' ? (
              <button type="button" className="btn" onClick={() => openCapture('note')}>Write a note</button>
            ) : undefined
          }
        >
          {q ? 'Try a different word, or search the whole library with Ctrl K.' : meta.emptyBody}
        </EmptyState>
      ) : (
        <div className="item-list">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              mode={mode}
              onChanged={refreshAll}
              onDeleteRequest={setPendingDelete}
            />
          ))}
        </div>
      )}

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete forever?"
      >
        <p className="confirm-copy">
          “{pendingDelete?.title}” will be removed from this device. This cannot be undone. Its links
          to other items and its place in collections will go with it.
        </p>
        <div className="form-actions">
          <button type="button" className="btn" onClick={() => setPendingDelete(null)}>Cancel</button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={deleting}
            onClick={async () => {
              if (!pendingDelete) return;
              setDeleting(true);
              try {
                await api.deleteForever(pendingDelete.id);
                setPendingDelete(null);
                toast('Item deleted forever', 'success');
                refreshAll();
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Could not delete the item', 'error');
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? 'Deleting…' : 'Delete forever'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
