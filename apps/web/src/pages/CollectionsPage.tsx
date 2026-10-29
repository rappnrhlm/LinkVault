import { useState } from 'react';
import { formatDate } from '@linkvault/shared';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Collection } from '../lib/api';
import { api } from '../lib/api';
import { useResource } from '../lib/hooks';
import { Modal, useUi } from '../lib/ui';
import PageHeader from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingRows } from '../components/States';

export default function CollectionsPage() {
  const { refreshKey, bump, toast } = useUi();
  const { data, error, loading, reload } = useResource(() => api.collections(), [refreshKey]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [deleting, setDeleting] = useState<Collection | null>(null);
  const [busy, setBusy] = useState(false);

  const collections = data?.collections ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Collections"
        subtitle={
          data
            ? `${collections.length} ${collections.length === 1 ? 'collection' : 'collections'} for related links and notes`
            : 'Reading collections…'
        }
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={15} /> New collection
          </button>
        }
      />

      {loading && !data ? (
        <LoadingRows count={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : collections.length === 0 ? (
        <EmptyState
          title="No collections yet"
          action={
            <button type="button" className="btn" onClick={() => setCreating(true)}>
              Create the first one
            </button>
          }
        >
          A collection is a shelf inside the shelf: a project, a trip, a reading list.
        </EmptyState>
      ) : (
        <div className="collection-rows">
          {collections.map((collection) => (
            <article className="collection-row" key={collection.id}>
              <Link to={`/collections/${collection.id}`} className="collection-link">
                <h2 className="collection-name">{collection.name}</h2>
                <span className="collection-desc">{collection.description || 'No description.'}</span>
              </Link>
              <span className="collection-count">
                {collection.itemCount ?? 0} {(collection.itemCount ?? 0) === 1 ? 'item' : 'items'}
              </span>
              <span className="collection-updated">{formatDate(collection.updatedAt)}</span>
              <div className="collection-actions">
                <button
                  type="button"
                  className="icon-btn"
                  title="Edit collection"
                  aria-label={`Edit ${collection.name}`}
                  onClick={() => setEditing(collection)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  title="Delete collection"
                  aria-label={`Delete ${collection.name}`}
                  onClick={() => setDeleting(collection)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <Modal
          open
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          title={editing ? 'Edit collection' : 'New collection'}
        >
          <form
            className="form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const input = {
                name: String(form.get('name') ?? '').trim(),
                description: String(form.get('description') ?? '').trim(),
              };
              setBusy(true);
              try {
                if (editing) await api.updateCollection(editing.id, input);
                else await api.createCollection(input);
                setCreating(false);
                setEditing(null);
                toast(editing ? 'Collection updated' : 'Collection created', 'success');
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
              <input
                className="input"
                name="name"
                autoFocus
                defaultValue={editing?.name ?? ''}
                required
                maxLength={120}
                placeholder="Weekend reading"
              />
            </label>
            <label className="field">
              <span>Description <em>optional</em></span>
              <textarea
                className="input textarea"
                name="description"
                rows={3}
                defaultValue={editing?.description ?? ''}
                placeholder="What belongs on this shelf?"
              />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Saving…' : editing ? 'Save collection' : 'Create collection'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal open onClose={() => setDeleting(null)} title="Delete collection?">
          <p className="confirm-copy">
            “{deleting.name}” will be removed. Its {deleting.itemCount ?? 0} items stay in the
            library and in any other collections.
          </p>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setDeleting(null)}>Cancel</button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.deleteCollection(deleting.id);
                  setDeleting(null);
                  toast('Collection deleted', 'success');
                  reload();
                  bump();
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
