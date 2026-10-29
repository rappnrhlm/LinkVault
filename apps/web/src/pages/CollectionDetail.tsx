import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import type { Item } from '../lib/api';
import { api } from '../lib/api';
import { useDebounced, useResource } from '../lib/hooks';
import { Modal, useUi } from '../lib/ui';
import ItemRow from '../components/ItemRow';
import { EmptyState, ErrorState, LoadingRows } from '../components/States';

export default function CollectionDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { refreshKey, bump, toast } = useUi();
  const { data, error, loading, reload } = useResource(() => api.collection(id), [id, refreshKey]);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading && !data) {
    return <div className="page"><LoadingRows count={4} /></div>;
  }
  if (error && !data) {
    return <div className="page"><ErrorState message={error} onRetry={reload} /></div>;
  }
  if (!data) return null;

  const { collection, items } = data;

  async function removeItem(itemId: string) {
    try {
      await api.setCollectionItems(
        id,
        items.filter((item) => item.id !== itemId).map((item) => item.id),
      );
      toast('Removed from collection', 'success');
      reload();
      bump();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not remove the item', 'error');
    }
  }

  return (
    <div className="page">
      <Link to="/collections" className="back-link">
        <ArrowLeft size={15} /> Collections
      </Link>

      <header className="page-head">
        <div>
          <h1>{collection.name}</h1>
          <p className="page-sub">
            {collection.description || 'A shelf inside the shelf.'} · {items.length}{' '}
            {items.length === 1 ? 'item' : 'items'}
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Edit
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus size={15} /> Add items
          </button>
          <button
            type="button"
            className="icon-btn danger"
            title="Delete collection"
            aria-label="Delete collection"
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="This collection is empty"
          action={
            <button type="button" className="btn" onClick={() => setAdding(true)}>
              Add the first item
            </button>
          }
        >
          Open an item's detail page to add it, or use Add items here.
        </EmptyState>
      ) : (
        <div className="item-list">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onChanged={() => {
                reload();
                bump();
              }}
              extraAction={
                <button
                  type="button"
                  className="icon-btn"
                  title="Remove from collection"
                  aria-label="Remove from collection"
                  onClick={() => void removeItem(item.id)}
                >
                  <X size={15} />
                </button>
              }
            />
          ))}
        </div>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(false)} title="Edit collection">
          <form
            className="form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setBusy(true);
              try {
                await api.updateCollection(id, {
                  name: String(form.get('name') ?? '').trim(),
                  description: String(form.get('description') ?? '').trim(),
                });
                setEditing(false);
                toast('Collection updated', 'success');
                reload();
                bump();
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Could not save the collection', 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              <span>Name</span>
              <input className="input" name="name" defaultValue={collection.name} required maxLength={120} />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                className="input textarea"
                name="description"
                rows={3}
                defaultValue={collection.description}
              />
            </label>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>Save collection</button>
            </div>
          </form>
        </Modal>
      )}

      {adding && (
        <AddItems
          existing={items.map((item) => item.id)}
          onClose={() => setAdding(false)}
          onAdd={async (next) => {
            try {
              await api.setCollectionItems(id, next);
              toast('Items added to the collection', 'success');
              reload();
              bump();
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Could not add the items', 'error');
            }
          }}
        />
      )}

      {deleting && (
        <Modal open onClose={() => setDeleting(false)} title="Delete collection?">
          <p className="confirm-copy">
            “{collection.name}” will be removed. Its {items.length} items stay in the library.
          </p>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setDeleting(false)}>Cancel</button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.deleteCollection(id);
                  toast('Collection deleted', 'success');
                  bump();
                  navigate('/collections');
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Could not delete the collection', 'error');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Deleting…' : 'Delete collection'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AddItems({
  existing,
  onClose,
  onAdd,
}: {
  existing: string[];
  onClose: () => void;
  onAdd: (ids: string[]) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const debounced = useDebounced(query, 220);
  const { data, loading } = useResource(
    () => api.listItems({ q: debounced.trim() || undefined, limit: 20 }),
    [debounced],
  );

  const results: Item[] = (data?.items ?? []).filter((item) => !existing.includes(item.id));
  const next = [...existing, ...selected];

  return (
    <Modal open onClose={onClose} title="Add items to collection" wide>
      <div className="search-box">
        <Search size={17} />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search bookmarks and notes…"
          aria-label="Search items to add"
        />
      </div>
      <div className="pick-list">
        {loading && <p className="muted-copy small">Searching…</p>}
        {!loading && results.length === 0 && <p className="muted-copy small">No items to add.</p>}
        {results.map((item) => (
          <label className="pick-row" key={item.id}>
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() =>
                setSelected((current) =>
                  current.includes(item.id)
                    ? current.filter((entry) => entry !== item.id)
                    : [...current, item.id],
                )
              }
            />
            <span>
              <span className="pick-title">{item.title}</span>
              <span className="pick-meta">{item.type === 'bookmark' ? 'Bookmark' : 'Note'}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={selected.length === 0 || busy}
          onClick={async () => {
            setBusy(true);
            await onAdd(next);
            setBusy(false);
            onClose();
          }}
        >
          {busy ? 'Adding…' : `Add ${selected.length || ''} ${selected.length === 1 ? 'item' : 'items'}`}
        </button>
      </div>
    </Modal>
  );
}
