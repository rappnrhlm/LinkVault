import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, FileText, Search } from 'lucide-react';
import { api, type Item } from '../lib/api';
import { useDebounced } from '../lib/hooks';
import { Modal } from '../lib/ui';

function Snippet({ value }: { value: string }) {
  const parts = value.split(/(\u0001|\u0002)/);
  let marked = false;
  return (
    <>
      {parts.map((part, index) => {
        if (part === '\u0001') {
          marked = true;
          return null;
        }
        if (part === '\u0002') {
          marked = false;
          return null;
        }
        return marked ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>;
      })}
    </>
  );
}

export default function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ item: Item; snippet: string }[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounced = useDebounced(query, 180);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQuery('');
      setResults([]);
      setSelected(0);
    }
  }, [open]);

  useEffect(() => {
    if (!debounced.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .search(debounced)
      .then((response) => {
        if (!cancelled) {
          setResults(response.results);
          setSelected(0);
        }
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  function go(item: Item) {
    onClose();
    navigate(`/items/${item.id}`);
  }

  return (
    <Modal open={open} onClose={onClose} title="Search the library" wide>
      <div className="search-box">
        <Search size={18} />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Titles, URLs, tags, notes…"
          aria-label="Search"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setSelected((index) => Math.min(index + 1, results.length - 1));
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setSelected((index) => Math.max(index - 1, 0));
            }
            if (event.key === 'Enter' && results[selected]) go(results[selected]!.item);
          }}
        />
      </div>

      <div className="search-results">
        {!query.trim() && (
          <p className="search-hint">
            Search runs over titles, URLs, descriptions, tags, collections and note text. Press
            <kbd>Esc</kbd> to close.
          </p>
        )}
        {loading && <p className="search-hint">Searching…</p>}
        {!loading && query.trim() && results.length === 0 && (
          <p className="search-hint">No items match “{query.trim()}”.</p>
        )}
        {results.map((result, index) => (
          <button
            type="button"
            key={result.item.id}
            className={`search-result ${index === selected ? 'selected' : ''}`}
            onMouseEnter={() => setSelected(index)}
            onClick={() => go(result.item)}
          >
            <span className="search-type" aria-hidden="true">
              {result.item.type === 'bookmark' ? <Bookmark size={15} /> : <FileText size={15} />}
            </span>
            <span className="search-text">
              <span className="search-title">{result.item.title}</span>
              <span className="search-snippet">
                <Snippet value={result.snippet || result.item.excerpt || ''} />
              </span>
            </span>
            <span className="search-kind">{result.item.type}</span>
          </button>
        ))}
      </div>
      <div className="modal-foot">
        <span><kbd>↑</kbd> <kbd>↓</kbd> to move</span>
        <span><kbd>Enter</kbd> to open</span>
      </div>
    </Modal>
  );
}
