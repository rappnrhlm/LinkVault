import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  ExternalLink,
  Link2,
  Plus,
  RotateCcw,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { formatDate, relativeTime } from '@linkvault/shared';
import type { Collection, Item, ItemDetail, Tag } from '../lib/api';
import { api } from '../lib/api';
import { useDebounced, useResource } from '../lib/hooks';
import { Modal, useUi } from '../lib/ui';
import NoteEditor from '../components/NoteEditor';
import { ErrorState, LoadingRows } from '../components/States';

export default function ItemDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { refreshKey, bump, toast } = useUi();
  const { data, error, loading, reload } = useResource(() => api.item(id), [id, refreshKey]);
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.item) {
      setItem(data.item);
      setTitle(data.item.title);
    }
  }, [data]);

  if (loading && !item) {
    return (
      <div className="page">
        <LoadingRows count={4} />
      </div>
    );
  }
  if (error && !item) {
    return (
      <div className="page">
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }
  if (!item) return null;

  const isBookmark = item.type === 'bookmark';
  const backTo = isBookmark ? '/bookmarks' : '/notes';

  async function patch(patchBody: Parameters<typeof api.updateItem>[1], message?: string) {
    try {
      const response = await api.updateItem(item!.id, patchBody);
      setItem(response.item);
      bump();
      if (message) toast(message, 'success');
      return response.item;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update the item', 'error');
      return null;
    }
  }

  async function saveTitle() {
    const next = title.trim();
    if (!next || next === item!.title) {
      setTitle(item!.title);
      return;
    }
    await patch({ title: next });
  }

  return (
    <div className="page detail-page">
      <Link to={backTo} className="back-link">
        <ArrowLeft size={15} /> {isBookmark ? 'Bookmarks' : 'Notes'}
      </Link>

      {item.deletedAt && (
        <div className="draft-banner warning">
          <span>This item is in Trash. Restore it to put it back on the shelf.</span>
          <div>
            <button
              type="button"
              className="link-btn"
              onClick={async () => {
                await api.restoreItem(item.id);
                toast('Item restored', 'success');
                bump();
                reload();
              }}
            >
              Restore
            </button>
            <button type="button" className="link-btn danger" onClick={() => setConfirmDelete(true)}>
              Delete forever
            </button>
          </div>
        </div>
      )}

      <header className="detail-head">
        <div className="detail-heading">
          <p className="detail-kind">{isBookmark ? 'Bookmark' : 'Note'}</p>
          <textarea
            className="title-input"
            rows={1}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={saveTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                (event.target as HTMLTextAreaElement).blur();
              }
              if (event.key === 'Escape') {
                setTitle(item.title);
                (event.target as HTMLTextAreaElement).blur();
              }
            }}
            aria-label="Item title"
          />
          <p className="detail-meta">
            {isBookmark ? (
              <>
                <a href={item.bookmark!.url} target="_blank" rel="noopener noreferrer">
                  {item.bookmark!.siteName || new URL(item.bookmark!.url).hostname}
                </a>
                <span aria-hidden="true">·</span>
                <span>Saved {formatDate(item.createdAt)}</span>
                <span aria-hidden="true">·</span>
                <span>{item.bookmark!.isRead ? 'Read' : 'Unread'}</span>
              </>
            ) : (
              <>
                <span>{item.note!.wordCount} words</span>
                <span aria-hidden="true">·</span>
                <span>Edited {relativeTime(item.updatedAt)}</span>
                <span aria-hidden="true">·</span>
                <span>{item.note!.editorMode === 'rich' ? 'Rich text' : 'Markdown'}</span>
              </>
            )}
          </p>
        </div>
        <div className="detail-actions">
          {isBookmark && (
            <a
              className="btn btn-primary"
              href={item.bookmark!.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                void api.visitBookmark(item.id).then((response) => setItem(response.item)).catch(() => undefined);
              }}
            >
              Open link <ExternalLink size={14} />
            </a>
          )}
          <button
            type="button"
            className={`icon-btn ${item.favorite ? 'is-favorite' : ''}`}
            title={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
            onClick={() => patch({ favorite: !item.favorite })}
          >
            <Star size={17} fill={item.favorite ? 'currentColor' : 'none'} />
          </button>
          {isBookmark && (
            <button
              type="button"
              className="icon-btn"
              title={item.bookmark!.isRead ? 'Mark unread' : 'Mark read'}
              aria-label={item.bookmark!.isRead ? 'Mark unread' : 'Mark read'}
              onClick={() => patch({ bookmark: { isRead: !item.bookmark!.isRead } })}
            >
              <Check size={17} />
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            title={item.archivedAt ? 'Restore from archive' : 'Archive'}
            aria-label={item.archivedAt ? 'Restore from archive' : 'Archive'}
            onClick={async () => {
              const response = await patch({ archived: !item.archivedAt });
              if (response) toast(response.archivedAt ? 'Archived' : 'Restored to the shelf', 'success');
            }}
          >
            {item.archivedAt ? <ArchiveRestore size={17} /> : <Archive size={17} />}
          </button>
          {!item.deletedAt && (
            <button
              type="button"
              className="icon-btn danger"
              title="Move to Trash"
              aria-label="Move to Trash"
              onClick={async () => {
                await api.trashItem(item.id);
                toast('Moved to Trash', 'success');
                bump();
                navigate(backTo);
              }}
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
      </header>

      {isBookmark ? (
        <BookmarkDetail item={item} onItem={setItem} onEdit={() => setEditing(true)} />
      ) : (
        <NoteEditor key={item.id} item={item} onSaved={(next) => setItem(next)} />
      )}

      {isBookmark && editing && (
        <BookmarkEditForm
          item={item}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setItem(next);
            setEditing(false);
            bump();
            toast('Details saved', 'success');
          }}
        />
      )}

      <DetailAside
        item={item}
        onItem={(next) => {
          setItem(next);
          bump();
        }}
      />

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete forever?">
        <p className="confirm-copy">
          “{item.title}” will be removed from this device permanently. This cannot be undone.
        </p>
        <div className="form-actions">
          <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.deleteForever(item.id);
                toast('Item deleted forever', 'success');
                bump();
                navigate('/trash');
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Could not delete the item', 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Deleting…' : 'Delete forever'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function BookmarkDetail({
  item,
  onItem,
  onEdit,
}: {
  item: ItemDetail;
  onItem: (item: ItemDetail) => void;
  onEdit: () => void;
}) {
  const navigate = useNavigate();
  const { bump, toast } = useUi();
  const [busy, setBusy] = useState(false);
  const hasNote = item.relationships.some((rel) => rel.target?.type === 'note');

  async function writeNote() {
    setBusy(true);
    try {
      const created = await api.createNote({
        title: `Notes on ${item.title}`.slice(0, 300),
        contentMd: `# ${item.title}\n\n`,
      });
      await api.addRelationship(created.item.id, item.id, 'references');
      bump();
      toast('Note created and linked', 'success');
      navigate(`/items/${created.item.id}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not create the note', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="detail-body">
      <div className="detail-copy">
        <section className="detail-section">
          <div className="section-head">
            <h2>Description</h2>
            <button type="button" className="link-btn" onClick={onEdit}>Edit details</button>
          </div>
          {item.bookmark!.description ? (
            <p className="description-text">{item.bookmark!.description}</p>
          ) : (
            <p className="muted-copy">
              No description was found on the page. Add your own to remember why it matters.
            </p>
          )}
        </section>
        <Relationships item={item} onItem={onItem} />
        {!hasNote && (
          <section className="detail-section note-invite">
            <h2>Thinking about this link?</h2>
            <p className="muted-copy">
              Start a note that is linked to this bookmark, so the two stay together.
            </p>
            <button type="button" className="btn" onClick={writeNote} disabled={busy}>
              <Plus size={15} /> {busy ? 'Creating…' : 'Write a note about this link'}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

function BookmarkEditForm({
  item,
  onClose,
  onSaved,
}: {
  item: ItemDetail;
  onClose: () => void;
  onSaved: (item: ItemDetail) => void;
}) {
  const { toast } = useUi();
  const [form, setForm] = useState({
    title: item.title,
    url: item.bookmark!.url,
    description: item.bookmark!.description,
    siteName: item.bookmark!.siteName,
  });
  const [busy, setBusy] = useState(false);

  return (
    <Modal open onClose={onClose} title="Edit bookmark details" wide>
      <form
        className="form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          try {
            const response = await api.updateItem(item.id, {
              title: form.title,
              bookmark: {
                url: form.url,
                description: form.description,
                siteName: form.siteName,
              },
            });
            onSaved(response.item);
          } catch (error) {
            toast(error instanceof Error ? error.message : 'Could not save details', 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>Title</span>
          <input
            className="input"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            required
          />
        </label>
        <label className="field">
          <span>URL</span>
          <input
            className="input"
            type="url"
            value={form.url}
            onChange={(event) => setForm({ ...form, url: event.target.value })}
            required
          />
        </label>
        <label className="field">
          <span>Site name</span>
          <input
            className="input"
            value={form.siteName}
            onChange={(event) => setForm({ ...form, siteName: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea
            className="input textarea"
            rows={5}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </label>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save details'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DetailAside({ item, onItem }: { item: ItemDetail; onItem: (item: ItemDetail) => void }) {
  return (
    <aside className="detail-aside">
      <section>
        <h2>Details</h2>
        <dl className="meta-list">
          {item.type === 'bookmark' ? (
            <>
              <div>
                <dt>Site</dt>
                <dd>{item.bookmark!.siteName || '—'}</dd>
              </div>
              <div>
                <dt>URL</dt>
                <dd className="url-cell">
                  <a href={item.bookmark!.url} target="_blank" rel="noopener noreferrer">
                    {item.bookmark!.url}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Last opened</dt>
                <dd>{item.bookmark!.lastAccessedAt ? relativeTime(item.bookmark!.lastAccessedAt) : 'Not yet'}</dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>Format</dt>
                <dd>{item.note!.editorMode === 'rich' ? 'Rich text' : 'Markdown'}</dd>
              </div>
              <div>
                <dt>Words</dt>
                <dd>{item.note!.wordCount}</dd>
              </div>
            </>
          )}
          <div>
            <dt>Created</dt>
            <dd>{formatDate(item.createdAt)}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{relativeTime(item.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      <TagEditor item={item} onItem={onItem} />
      <CollectionPicker item={item} onItem={onItem} />
      {item.type === 'note' && <Relationships item={item} onItem={onItem} />}
      <Backlinks item={item} onItem={onItem} />
    </aside>
  );
}

function TagEditor({ item, onItem }: { item: ItemDetail; onItem: (item: ItemDetail) => void }) {
  const { refreshKey, bump, toast } = useUi();
  const { data } = useResource(() => api.tags(), [refreshKey]);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  async function update(names: string[]) {
    setBusy(true);
    try {
      const response = await api.setTags(item.id, names);
      onItem(response.item);
      bump();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update tags', 'error');
    } finally {
      setBusy(false);
    }
  }

  function addTag(name: string) {
    const clean = name.trim();
    if (!clean || item.tags.some((tag) => tag.name.toLowerCase() === clean.toLowerCase())) return;
    void update([...item.tags.map((tag) => tag.name), clean]);
    setValue('');
  }

  return (
    <section>
      <h2>Tags</h2>
      <div className="tag-row">
        {item.tags.map((tag: Tag) => (
          <span className="tag removable" key={tag.id}>
            <span className="tag-dot" style={{ background: tag.color }} />
            {tag.name}
            <button
              type="button"
              onClick={() => void update(item.tags.filter((entry) => entry.id !== tag.id).map((entry) => entry.name))}
              aria-label={`Remove tag ${tag.name}`}
              disabled={busy}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <form
        className="inline-add"
        onSubmit={(event) => {
          event.preventDefault();
          addTag(value);
        }}
      >
        <input
          className="input input-small"
          list="tag-suggestions"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Add a tag"
          aria-label="Add a tag"
        />
        <datalist id="tag-suggestions">
          {(data?.tags ?? []).map((tag) => (
            <option value={tag.name} key={tag.id} />
          ))}
        </datalist>
        <button type="submit" className="icon-btn" aria-label="Add tag" disabled={!value.trim() || busy}>
          <Plus size={15} />
        </button>
      </form>
    </section>
  );
}

function CollectionPicker({ item, onItem }: { item: ItemDetail; onItem: (item: ItemDetail) => void }) {
  const { refreshKey, bump, toast } = useUi();
  const { data } = useResource(() => api.collections(), [refreshKey]);
  const [busy, setBusy] = useState(false);
  const selected = useMemo(() => new Set(item.collections.map((collection) => collection.id)), [item.collections]);

  async function toggle(collection: Collection) {
    const next = new Set(selected);
    if (next.has(collection.id)) next.delete(collection.id);
    else next.add(collection.id);
    setBusy(true);
    try {
      const response = await api.setCollections(item.id, [...next]);
      onItem(response.item);
      bump();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update collections', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Collections</h2>
      {(data?.collections ?? []).length === 0 ? (
        <p className="muted-copy small">
          No collections yet. <Link to="/collections">Create one</Link>.
        </p>
      ) : (
        <ul className="check-list">
          {(data?.collections ?? []).map((collection) => (
            <li key={collection.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(collection.id)}
                  onChange={() => void toggle(collection)}
                  disabled={busy}
                />
                <span>{collection.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Relationships({ item, onItem }: { item: ItemDetail; onItem: (item: ItemDetail) => void }) {
  const { bump, toast } = useUi();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 220);
  const { data, loading } = useResource(
    () => (debounced.trim() ? api.search(debounced) : Promise.resolve({ query: '', results: [] })),
    [debounced],
  );
  const linkedIds = new Set(item.relationships.map((rel) => rel.targetItemId));

  async function add(target: Item) {
    try {
      const response = await api.addRelationship(item.id, target.id, 'related');
      onItem(response.item);
      bump();
      setQuery('');
      toast('Items linked', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not link the item', 'error');
    }
  }

  async function remove(relationshipId: string) {
    try {
      await api.removeRelationship(relationshipId);
      const response = await api.item(item.id);
      onItem(response.item);
      bump();
      toast('Link removed', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not remove the link', 'error');
    }
  }

  return (
    <section className="detail-section">
      <div className="section-head">
        <h2>Linked items</h2>
        <span className="count">{item.relationships.length}</span>
      </div>
      {item.relationships.length === 0 ? (
        <p className="muted-copy small">Nothing linked yet. Connect a note to a bookmark, or two notes.</p>
      ) : (
        <ul className="linked-list">
          {item.relationships.map((relationship) => (
            <li key={relationship.id}>
              <Link to={`/items/${relationship.target?.id}`}>
                <span className="linked-kind">{relationship.target?.type === 'bookmark' ? 'Link' : 'Note'}</span>
                <span>{relationship.target?.title}</span>
              </Link>
              <button
                type="button"
                className="icon-btn"
                title="Remove link"
                aria-label="Remove link"
                onClick={() => void remove(relationship.id)}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="link-search">
        <Link2 size={15} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find an item to link…"
          aria-label="Find an item to link"
        />
      </div>
      {debounced.trim() && (
        <div className="link-results">
          {loading && <p className="muted-copy small">Searching…</p>}
          {!loading && data?.results.length === 0 && <p className="muted-copy small">No matching items.</p>}
          {(data?.results ?? [])
            .filter((result) => result.item.id !== item.id && !linkedIds.has(result.item.id))
            .slice(0, 6)
            .map((result) => (
              <button type="button" key={result.item.id} onClick={() => void add(result.item)}>
                <span className="linked-kind">{result.item.type === 'bookmark' ? 'Link' : 'Note'}</span>
                <span>{result.item.title}</span>
                <Plus size={14} />
              </button>
            ))}
        </div>
      )}
    </section>
  );
}

function Backlinks({ item, onItem }: { item: ItemDetail; onItem: (item: ItemDetail) => void }) {
  const { bump, toast } = useUi();
  if (item.backlinks.length === 0) return null;
  return (
    <section>
      <h2>Linked from</h2>
      <ul className="linked-list">
        {item.backlinks.map((relationship) => (
          <li key={relationship.id}>
            <Link to={`/items/${relationship.target?.id}`}>
              <span className="linked-kind">{relationship.target?.type === 'bookmark' ? 'Link' : 'Note'}</span>
              <span>{relationship.target?.title}</span>
            </Link>
            <button
              type="button"
              className="icon-btn"
              title="Remove backlink"
              aria-label="Remove backlink"
              onClick={async () => {
                try {
                  await api.removeRelationship(relationship.id);
                  const response = await api.item(item.id);
                  onItem(response.item);
                  bump();
                } catch (error) {
                  toast(error instanceof Error ? error.message : 'Could not remove the link', 'error');
                }
              }}
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
