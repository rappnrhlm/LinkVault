import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Tag } from '../lib/api';
import { api } from '../lib/api';
import { useResource } from '../lib/hooks';
import { Modal, useUi } from '../lib/ui';
import PageHeader from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingRows } from '../components/States';

const palette = ['#1b6e66', '#7c5a2e', '#5b5f97', '#8a3f4a', '#3d6b3f', '#4f5b62', '#7a4b75', '#2f5d7c'];

export default function TagsPage() {
  const { refreshKey, bump, toast } = useUi();
  const { data, error, loading, reload } = useResource(() => api.tags(), [refreshKey]);
  const [name, setName] = useState('');
  const [color, setColor] = useState(palette[0]!);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.createTag(name.trim(), color);
      setName('');
      toast('Tag created', 'success');
      reload();
      bump();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create the tag', 'error');
    } finally {
      setBusy(false);
    }
  }

  const tags = data?.tags ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Tags"
        subtitle={data ? `${tags.length} ${tags.length === 1 ? 'tag' : 'tags'} across the library` : 'Reading tags…'}
      />

      <form className="tag-create" onSubmit={create}>
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New tag name"
          aria-label="New tag name"
          maxLength={60}
        />
        <label className="color-field">
          <span>Colour</span>
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            aria-label="Tag colour"
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={!name.trim() || busy}>
          <Plus size={15} /> Add tag
        </button>
      </form>

      {loading && !data ? (
        <LoadingRows count={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : tags.length === 0 ? (
        <EmptyState title="No tags yet">
          Tags cut across bookmarks and notes. Add one above, or type a new tag on any item.
        </EmptyState>
      ) : (
        <div className="table">
          <div className="table-head">
            <span>Tag</span>
            <span>Items</span>
            <span aria-hidden="true" />
          </div>
          {tags.map((tag) => (
            <div className="table-row" key={tag.id}>
              <span className="tag-cell">
                <span className="tag-dot" style={{ background: tag.color }} />
                <Link to={`/items?tag=${encodeURIComponent(tag.name)}`}>{tag.name}</Link>
              </span>
              <span className="num">{tag.count ?? 0}</span>
              <span className="row-actions">
                <button
                  type="button"
                  className="icon-btn"
                  title="Edit tag"
                  aria-label={`Edit ${tag.name}`}
                  onClick={() => setEditing(tag)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  title="Delete tag"
                  aria-label={`Delete ${tag.name}`}
                  onClick={() => setDeleting(tag)}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title="Edit tag">
          <form
            className="form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              try {
                await api.updateTag(editing.id, {
                  name: String(form.get('name') ?? ''),
                  color: String(form.get('color') ?? editing.color),
                });
                setEditing(null);
                toast('Tag updated', 'success');
                reload();
                bump();
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Could not update the tag', 'error');
              }
            }}
          >
            <label className="field">
              <span>Name</span>
              <input className="input" name="name" defaultValue={editing.name} required maxLength={60} />
            </label>
            <label className="field">
              <span>Colour</span>
              <input className="color-input" type="color" name="color" defaultValue={editing.color} />
            </label>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save tag</button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal open onClose={() => setDeleting(null)} title="Delete tag?">
          <p className="confirm-copy">
            “{deleting.name}” will be removed from {deleting.count ?? 0} items. The items themselves
            stay in the library.
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
                  await api.deleteTag(deleting.id);
                  setDeleting(null);
                  toast('Tag deleted', 'success');
                  reload();
                  bump();
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Could not delete the tag', 'error');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Deleting…' : 'Delete tag'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
