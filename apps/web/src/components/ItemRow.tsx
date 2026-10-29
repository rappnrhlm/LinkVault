import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Check, FileText, RotateCcw, Star, Trash2 } from 'lucide-react';
import { relativeTime } from '@linkvault/shared';
import { api, type Item } from '../lib/api';
import { useUi } from '../lib/ui';

function Favicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Bookmark size={16} strokeWidth={1.7} />;
  return (
    <img
      className="favicon"
      src={`/api/favicon?url=${encodeURIComponent(url)}`}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function ItemRow({
  item,
  mode = 'normal',
  onChanged,
  onDeleteRequest,
  extraAction,
}: {
  item: Item;
  mode?: 'normal' | 'archived' | 'trash';
  onChanged?: () => void;
  onDeleteRequest?: (item: Item) => void;
  extraAction?: React.ReactNode;
}) {
  const { toast } = useUi();
  const isBookmark = item.type === 'bookmark';
  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      onChanged?.();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update the item', 'error');
    }
  }
  const meta = isBookmark
    ? domain(item.bookmark?.url ?? '')
    : `${item.note?.wordCount ?? 0} words`;

  return (
    <article className={`item-row ${mode === 'trash' ? 'is-trash' : ''}`}>
      <Link className="item-hit" to={`/items/${item.id}`}>
        <span className={`item-icon ${isBookmark ? 'is-bookmark' : 'is-note'}`} aria-hidden="true">
          {isBookmark ? (
            item.bookmark?.faviconUrl ? (
              <Favicon url={item.bookmark.faviconUrl} />
            ) : (
              <Bookmark size={16} strokeWidth={1.7} />
            )
          ) : (
            <FileText size={16} strokeWidth={1.7} />
          )}
        </span>
        <span className="item-main">
          <span className="item-title-line">
            <span className="item-title">{item.title}</span>
            {item.favorite && <Star size={13} className="favorite-mark" fill="currentColor" aria-label="Favorite" />}
            {isBookmark && !item.bookmark?.isRead && (
              <span className="unread-dot" title="Unread" aria-label="Unread" />
            )}
            {item.archivedAt && mode !== 'trash' && <span className="state-label">Archived</span>}
          </span>
          {item.excerpt && <span className="item-excerpt">{item.excerpt}</span>}
          <span className="item-meta">
            <span>{meta}</span>
            <span aria-hidden="true">·</span>
            <span>{relativeTime(item.updatedAt)}</span>
            {item.tags.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="row-tags">
                  {item.tags.slice(0, 3).map((tag) => (
                    <span className="tag" key={tag.id}>{tag.name}</span>
                  ))}
                  {item.tags.length > 3 && <span className="tag-more">+{item.tags.length - 3}</span>}
                </span>
              </>
            )}
          </span>
        </span>
      </Link>

      <div className="item-actions">
        {extraAction}
        {mode === 'normal' && (
          <>
            {isBookmark && (
              <button
                type="button"
                className={`icon-btn ${item.bookmark?.isRead ? 'is-on' : ''}`}
                title={item.bookmark?.isRead ? 'Mark unread' : 'Mark read'}
                aria-label={item.bookmark?.isRead ? 'Mark unread' : 'Mark read'}
                onClick={() => act(() => api.updateItem(item.id, { bookmark: { isRead: !item.bookmark?.isRead } }))}
              >
                <Check size={15} />
              </button>
            )}
            <button
              type="button"
              className={`icon-btn ${item.favorite ? 'is-favorite' : ''}`}
              title={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
              onClick={() => act(() => api.updateItem(item.id, { favorite: !item.favorite }))}
            >
              <Star size={15} fill={item.favorite ? 'currentColor' : 'none'} />
            </button>
          </>
        )}
        {mode === 'archived' && (
          <button
            type="button"
            className="icon-btn"
            title="Restore from archive"
            aria-label="Restore from archive"
            onClick={() => act(() => api.updateItem(item.id, { archived: false }))}
          >
            <RotateCcw size={15} />
          </button>
        )}
        {mode === 'trash' && (
          <>
            <button
              type="button"
              className="icon-btn"
              title="Restore item"
              aria-label="Restore item"
              onClick={() => act(() => api.restoreItem(item.id))}
            >
              <RotateCcw size={15} />
            </button>
            <button
              type="button"
              className="icon-btn danger"
              title="Delete forever"
              aria-label="Delete forever"
              onClick={() => onDeleteRequest?.(item)}
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
    </article>
  );
}
