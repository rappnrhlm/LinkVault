import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Archive,
  Database,
  Bookmark,
  FileText,
  Folder,
  Layers,
  LayoutGrid,
  Menu,
  Plus,
  Search,
  Star,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useResource } from '../lib/hooks';
import { useUi } from '../lib/ui';
import SearchPalette from './SearchPalette';
import CaptureDialog from './CaptureDialog';

const links = [
  { group: 'Library', items: [
    { to: '/', label: 'Overview', icon: LayoutGrid, end: true },
    { to: '/items', label: 'All items', icon: Layers },
    { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
    { to: '/notes', label: 'Notes', icon: FileText },
  ] },
  { group: 'Shelves', items: [
    { to: '/collections', label: 'Collections', icon: Folder },
    { to: '/tags', label: 'Tags', icon: Tags },
  ] },
  { group: 'Saved', items: [
    { to: '/favorites', label: 'Favorites', icon: Star },
    { to: '/archive', label: 'Archive', icon: Archive },
    { to: '/trash', label: 'Trash', icon: Trash2 },
  ] },
];

function Mark() {
  return (
    <svg className="mark" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 3.5h11v17l-5.5-3.6-5.5 3.6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export default function AppShell() {
  const { refreshKey, searchOpen, setSearchOpen, openCapture } = useUi();
  const { data: overview } = useResource(() => api.overview(), [refreshKey]);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname, location.search]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        openCapture('bookmark');
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openCapture('note');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openCapture, setSearchOpen]);

  const counts = overview?.counts;

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <NavLink to="/" className="brand" aria-label="LinkVault home">
            <Mark />
            <span className="brand-name">LinkVault</span>
          </NavLink>
          <button className="icon-btn sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <p className="brand-sub">A local library</p>

        <button type="button" className="search-trigger" onClick={() => setSearchOpen(true)}>
          <Search size={15} />
          <span>Search everything</span>
          <kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} K</kbd>
        </button>

        <nav className="nav" aria-label="Main navigation">
          {links.map((group) => (
            <div className="nav-group" key={group.group}>
              <p className="nav-label">{group.group}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <item.icon size={16} strokeWidth={1.7} />
                  <span>{item.label}</span>
                  {item.to === '/bookmarks' && counts && counts.unread > 0 && (
                    <span className="nav-count" title={`${counts.unread} unread`}>{counts.unread}</span>
                  )}
                  {item.to === '/trash' && counts && counts.trash > 0 && (
                    <span className="nav-count" title={`${counts.trash} in trash`}>{counts.trash}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button type="button" className="btn btn-primary capture-btn" onClick={() => openCapture('bookmark')}>
            <Plus size={16} />
            Save a link
          </button>
          <button type="button" className="btn capture-btn capture-secondary" onClick={() => openCapture('note')}>
            <FileText size={15} />
            New note
          </button>
          <NavLink to="/data" className={({ isActive }) => `foot-link ${isActive ? 'active' : ''}`}>
            <Database size={13} /> Import &amp; export
          </NavLink>
          <p className="local-note">Stored on this device</p>
        </div>
      </div>

      {menuOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <div className="main-wrap">
        <header className="mobile-bar">
          <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu size={19} />
          </button>
          <NavLink to="/" className="brand">
            <Mark />
            <span className="brand-name">LinkVault</span>
          </NavLink>
          <button className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search">
            <Search size={18} />
          </button>
        </header>
        <main id="main" className="main">
          <Outlet />
        </main>
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CaptureDialog />
    </div>
  );
}
