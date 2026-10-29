import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiRequestError, api } from '../lib/api';
import { useUi, Modal } from '../lib/ui';

export default function CaptureDialog() {
  const { capture, closeCapture, bump, toast } = useUi();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  useEffect(() => {
    if (capture) {
      setUrl('');
      setTitle('');
      setTags('');
      setContent('');
      setError(null);
      setDuplicateId(null);
      setBusy(false);
    }
  }, [capture]);

  async function saveBookmark(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDuplicateId(null);
    try {
      const response = await api.createBookmark({
        url: url.trim(),
        title: title.trim() || undefined,
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      bump();
      toast(response.warning ? `Saved. ${response.warning}` : 'Bookmark saved', response.warning ? 'info' : 'success');
      closeCapture();
      navigate(`/items/${response.item.id}`);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'DUPLICATE_URL') {
        const details = err.details as { existingItemId?: string } | undefined;
        setDuplicateId(details?.existingItemId ?? null);
      }
      setError(err instanceof Error ? err.message : 'Could not save the bookmark');
    } finally {
      setBusy(false);
    }
  }

  async function saveNote(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await api.createNote({
        title: title.trim() || undefined,
        contentMd: content,
      });
      bump();
      toast('Note created', 'success');
      closeCapture();
      navigate(`/items/${response.item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the note');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={capture !== null} onClose={closeCapture} title={capture === 'note' ? 'New note' : 'Save a link'}>
      {capture === 'bookmark' && (
        <form onSubmit={saveBookmark} className="form">
          <label className="field">
            <span>URL</span>
            <input
              className="input"
              type="url"
              required
              autoFocus
              placeholder="https://"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            <small>Title, description, site name and favicon are fetched when the page allows it.</small>
          </label>
          <label className="field">
            <span>Title <em>optional</em></span>
            <input
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Leave empty to use the page title"
            />
          </label>
          <label className="field">
            <span>Tags <em>optional</em></span>
            <input
              className="input"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="reading, design, research"
            />
            <small>Separate tags with commas.</small>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
              {duplicateId && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    closeCapture();
                    navigate(`/items/${duplicateId}`);
                  }}
                >
                  Open the saved item
                </button>
              )}
            </p>
          )}
          <div className="form-actions">
            <button type="button" className="btn" onClick={closeCapture}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy || !url.trim()}>
              {busy ? 'Saving…' : 'Save bookmark'}
            </button>
          </div>
        </form>
      )}

      {capture === 'note' && (
        <form onSubmit={saveNote} className="form">
          <label className="field">
            <span>Title</span>
            <input
              className="input"
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled note"
            />
          </label>
          <label className="field">
            <span>Start writing <em>Markdown</em></span>
            <textarea
              className="input textarea"
              rows={8}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={'# A thought\n\nWrite it down before it goes.'}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn" onClick={closeCapture}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create note'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
