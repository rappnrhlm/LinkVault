import { Link } from 'react-router-dom';
import { ArrowUpRight, FilePlus, Link2, Plus } from 'lucide-react';
import { relativeTime } from '@linkvault/shared';
import PageHeader from '../components/PageHeader';
import ItemRow from '../components/ItemRow';
import { EmptyState, ErrorState, LoadingRows } from '../components/States';
import { api } from '../lib/api';
import { useResource } from '../lib/hooks';
import { useUi } from '../lib/ui';

export default function Overview() {
  const { refreshKey, openCapture } = useUi();
  const { data, error, loading, reload } = useResource(() => api.overview(), [refreshKey]);

  if (loading && !data) {
    return (
      <div className="page">
        <PageHeader title="Your library" subtitle="Loading what you saved…" />
        <LoadingRows count={5} />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="page">
        <PageHeader title="Your library" />
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }
  if (!data) return null;

  const { counts, recent, unread, recentNotes, collections, tags } = data;
  const lastSaved = recent[0]?.createdAt;

  return (
    <div className="page">
      <PageHeader
        title="Your library"
        subtitle={
          counts.active === 0
            ? 'An empty shelf, ready for its first link or note.'
            : `${counts.active} ${counts.active === 1 ? 'item' : 'items'} on the shelf · ${counts.unread} unread · last saved ${relativeTime(lastSaved)}`
        }
        actions={
          <>
            <button type="button" className="btn" onClick={() => openCapture('note')}>
              <FilePlus size={15} />
              New note
            </button>
            <button type="button" className="btn btn-primary" onClick={() => openCapture('bookmark')}>
              <Plus size={15} />
              Save a link
            </button>
          </>
        }
      />

      {counts.active === 0 ? (
        <div className="welcome">
          <div className="welcome-copy">
            <h2>Everything you mean to come back to.</h2>
            <p>
              Save a link and LinkVault fetches its title, description and favicon. Write a note in
              Markdown or rich text. Tag both, collect them, and link them to each other.
            </p>
            <div className="welcome-actions">
              <button type="button" className="btn btn-primary" onClick={() => openCapture('bookmark')}>
                <Link2 size={15} />
                Save your first link
              </button>
              <button type="button" className="btn" onClick={() => openCapture('note')}>
                <FilePlus size={15} />
                Write a note
              </button>
            </div>
            <p className="shortcut-note">
              <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>B</kbd> saves a link from anywhere in the app.
            </p>
          </div>
          <div className="welcome-shelf" aria-hidden="true">
            <span className="shelf-line" />
            <span className="shelf-line short" />
            <span className="shelf-line" />
            <span className="shelf-line tiny" />
          </div>
        </div>
      ) : (
        <>
          <section className="shelf-strip" aria-label="Library totals">
            <Link to="/bookmarks"><span className="shelf-label">Bookmarks</span><span className="shelf-value">{counts.bookmarks}</span></Link>
            <Link to="/notes"><span className="shelf-label">Notes</span><span className="shelf-value">{counts.notes}</span></Link>
            <Link to="/favorites"><span className="shelf-label">Favorites</span><span className="shelf-value">{counts.favorites}</span></Link>
            <Link to="/archive"><span className="shelf-label">Archived</span><span className="shelf-value">{counts.archived}</span></Link>
            <Link to="/tags"><span className="shelf-label">Tags</span><span className="shelf-value">{counts.tags}</span></Link>
            <Link to="/trash"><span className="shelf-label">Trash</span><span className="shelf-value">{counts.trash}</span></Link>
          </section>

          <div className="overview-columns">
            <div className="overview-main">
              <section>
                <div className="section-head">
                  <h2>Unread</h2>
                  <Link to="/bookmarks?read=false" className="section-link">
                    All unread <ArrowUpRight size={14} />
                  </Link>
                </div>
                {unread.length === 0 ? (
                  <EmptyState title="Nothing waiting">
                    Every saved bookmark has been read. Save something new when you find it.
                  </EmptyState>
                ) : (
                  <div className="tonal-panel">
                    {unread.map((item) => (
                      <ItemRow item={item} key={item.id} onChanged={reload} />
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="section-head">
                  <h2>Recently saved</h2>
                  <Link to="/items" className="section-link">
                    All items <ArrowUpRight size={14} />
                  </Link>
                </div>
                <div className="item-list">
                  {recent.map((item) => (
                    <ItemRow item={item} key={item.id} onChanged={reload} />
                  ))}
                </div>
              </section>

            </div>

            <aside className="overview-side">
              <section className="shelf-block">
                <div className="section-head">
                  <h2>Collections</h2>
                  <Link to="/collections" className="section-link">Manage</Link>
                </div>
                {collections.length === 0 ? (
                  <p className="side-empty">No collections yet. Group related links and notes into one shelf.</p>
                ) : (
                  <ul className="collection-list">
                    {collections.map((collection) => (
                      <li key={collection.id}>
                        <Link to={`/collections/${collection.id}`}>
                          <span>{collection.name}</span>
                          <span className="count">{collection.itemCount ?? 0}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Link to="/collections" className="side-action">
                  <Plus size={14} /> New collection
                </Link>
              </section>

              <section className="shelf-block">
                <div className="section-head">
                  <h2>Tags</h2>
                  <Link to="/tags" className="section-link">All tags</Link>
                </div>
                {tags.length === 0 ? (
                  <p className="side-empty">Tags cut across bookmarks and notes. Add one on any item.</p>
                ) : (
                  <ul className="tag-cloud">
                    {tags.map((tag) => (
                      <li key={tag.id}>
                        <Link to={`/items?tag=${encodeURIComponent(tag.name)}`}>
                          <span className="tag-dot" style={{ background: tag.color }} />
                          {tag.name}
                          <span className="count">{tag.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="shelf-block">
                <div className="section-head">
                  <h2>Recently edited</h2>
                  <Link to="/notes" className="section-link">Notes</Link>
                </div>
                {recentNotes.length === 0 ? (
                  <p className="side-empty">Notes you edit will show up here.</p>
                ) : (
                  <ul className="note-list">
                    {recentNotes.map((item) => (
                      <li key={item.id}>
                        <Link to={`/items/${item.id}`}>{item.title}</Link>
                        <span>{relativeTime(item.updatedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
