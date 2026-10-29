# LinkVault

A local-first library for bookmarks and notes. One person, one machine, one SQLite file.
Save a link and LinkVault fetches its title, description, site name and favicon. Write notes in
Markdown or rich text, tag everything, group it into collections, and link items to each other.

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4 (with a hand-written stylesheet),
  Tiptap for rich text, `marked` + `turndown` for Markdown conversion.
- **API:** Node.js, Fastify 5, Zod for runtime validation.
- **Database:** SQLite through Node's built-in `node:sqlite` driver (Node 22.5+), with FTS5
  full-text search and versioned migrations.
- **Tests:** Vitest (unit + API integration) and Playwright (browser end-to-end).

`node:sqlite` is used instead of `better-sqlite3` to avoid a native build step; it ships with Node
and supports FTS5 on the tested build. Everything runs on `127.0.0.1`.

## Requirements

- Node.js **22.5 or newer** (Node 24 recommended — `node:sqlite` and FTS5 must be present).
- npm 10+.
- Google Chrome for the Playwright tests (the config points at `/usr/bin/google-chrome`; change
  `launchOptions.executablePath` in `playwright.config.ts` if yours lives elsewhere).

## Install and run

```bash
npm install
npm run build          # shared types -> API -> web
npm start              # API + built frontend on http://127.0.0.1:4317
```

Open <http://127.0.0.1:4317>.

For development with hot reload (API on `:4317`, Vite on `:5173`):

```bash
npm run dev
```

Open <http://127.0.0.1:5173>; Vite proxies `/api` to the API.

Other commands:

```bash
npm test               # API unit + integration tests (Vitest)
npm run test:e2e       # browser end-to-end tests (Playwright)
npm run typecheck      # shared + API + web type checks
npm run backup         # VACUUM INTO data/backups/linkvault-<timestamp>.db
```

## Where the data lives

| What | Default path |
| --- | --- |
| Database | `data/linkvault.db` (plus `-wal` / `-shm` while running) |
| Backups | `data/backups/linkvault-<timestamp>.db` |
| Exports | wherever your browser saves `linkvault-export.json` |

Override the database location with `LINKVAULT_DB`:

```bash
LINKVAULT_DB=/home/me/vault/linkvault.db PORT=4317 npm start
```

`data/` is git-ignored. The database is never served by the frontend; the browser only talks to
the local API.

## Using it

- **Save a link** from the sidebar, the Overview, or `Ctrl/Cmd + Shift + B`. Metadata is fetched
  server-side with SSRF protections. If a site blocks the request, the bookmark is still saved and
  a warning explains what was missing; you can edit every field by hand.
- **Write a note** from the sidebar, Overview, or `Ctrl/Cmd + Shift + N`. Notes autosave 700 ms
  after typing stops. The save state is always visible. If the API is unreachable the text stays in
  a local draft and is offered back on the next visit.
- **Switch editor mode** with Markdown / Rich text. Markdown is canonical: rich-text edits are
  converted to Markdown on every save, and switching back to Markdown shows the exact stored text.
- **Search everything** with `Ctrl/Cmd + K`: titles, URLs, descriptions, tags, collections and note
  bodies (SQLite FTS5, prefix matching).
- **Link items** on any detail page: search for the other item and add it. Backlinks appear on the
  target. Duplicate links and self-links are refused.
- **Organize** with tags (many-to-many, reusable) and collections (a shelf of bookmarks and notes).
- **Archive / Trash** from a row's hover actions or the detail page. Trash keeps items until you
  restore them or confirm permanent deletion. Permanent deletion is refused for items that are not
  in Trash.
- **Import / export** from *Import & export* in the sidebar. Import merges: matching item IDs or
  duplicate bookmark URLs are skipped, nothing is overwritten or deleted.

## API

All routes are under `/api` on `127.0.0.1` only.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness |
| GET | `/overview` | Counts, unread, recent items, tags, collections |
| GET | `/items` | List/filter: `type`, `status`, `favorite`, `read`, `tag`, `collection`, `q`, `sort`, `limit`, `offset` |
| POST | `/items/bookmarks` | Save a bookmark (fetches metadata) |
| POST | `/items/notes` | Create a note |
| GET | `/items/:id` | Item with relationships and backlinks |
| PATCH | `/items/:id` | Title, favorite, archived, deleted, bookmark fields |
| DELETE | `/items/:id` | Move to Trash; `?permanent=true` deletes a trashed item |
| POST | `/items/:id/restore` | Restore from archive or Trash |
| POST | `/items/:id/visit` | Mark a bookmark read and record the visit |
| PUT | `/items/:id/note` | Save note content (supports `baseUpdatedAt` for stale-write protection) |
| PUT | `/items/:id/tags` | Replace an item's tags |
| PUT | `/items/:id/collections` | Replace an item's collections |
| POST | `/items/:id/relationships` | Link to another item |
| DELETE | `/relationships/:id` | Remove a link |
| GET/POST | `/tags` | List / create tags |
| PATCH/DELETE | `/tags/:id` | Rename, recolour or delete a tag |
| GET/POST | `/collections` | List / create collections |
| GET/PATCH/DELETE | `/collections/:id` | Read, edit, delete a collection |
| PUT | `/collections/:id/items` | Replace the items in a collection |
| GET | `/search?q=` | Full-text search with highlighted snippets |
| POST | `/metadata` | Fetch page metadata for a URL (guarded) |
| GET | `/favicon?url=` | Proxy a site icon (guarded, cached) |
| GET | `/export` | Download a JSON export |
| POST | `/import` | Merge a JSON export |
| POST | `/backup` | Write a consistent database copy |
| GET | `/about` | Database and backup paths |

## Security

- Every request is validated with Zod; every query is parameterized.
- The server binds to `127.0.0.1` and rejects requests whose `Host` is not localhost. Writes with a
  non-local `Origin` are rejected, and CORS only allows localhost origins.
- Metadata fetching:
  - only `http`/`https`, no embedded credentials;
  - loopback, private, link-local, CGNAT, multicast, documentation and reserved ranges are blocked
    for IPv4 and IPv6 (including IPv4-mapped addresses);
  - the hostname is resolved before each request and the resolved IP is re-checked, including after
    every redirect (max 4 redirects);
  - a custom DNS lookup makes the socket connect to the validated address, closing the
    DNS-rebinding window;
  - 7 s per-request timeout, 10 s total deadline, 512 KB HTML cap, HTML content types only;
  - no cookies, credentials or client headers are forwarded;
  - favicon proxying uses the same guard with a 128 KB image cap and a private cache.
- Markdown is rendered with raw HTML escaped, then sanitized with DOMPurify in the rich editor.
  Stored HTML cannot execute; a browser test covers this.
- Rich-text links are restricted to `http`/`https`, and external links use `noopener noreferrer`.
- The API exposes no shell, no arbitrary file access, and no filesystem paths except the read-only
  `/about` and the backup location.
- Destructive actions require an explicit confirmation and, for permanent deletion, an item already
  in Trash.

## Backup and restore

**Backup** (either):

```bash
npm run backup                              # while the app is stopped or running (WAL-safe)
# or: click "Back up now" on the Import & export screen
```

This uses `VACUUM INTO`, producing a consistent single-file snapshot in `data/backups/`.

**Restore:**

1. Stop the app.
2. Move the current database aside (keep it — do not delete it).
3. Copy the chosen backup to `data/linkvault.db`.
4. Remove stale `data/linkvault.db-wal` and `data/linkvault.db-shm` files if present.
5. Start the app and check the Overview counts.

**JSON export / import** is for moving the library between installs. Export includes all items
(including archived and trashed), tags, collections and relationships. Import is merge-only and
idempotent: re-importing the same file reports `Imported 0 items; skipped N`.

## Testing

```bash
npm test        # 51 tests: migrations, FK cascades, CRUD, URL rules, search, links, import/export, security
npm run test:e2e
```

The end-to-end suite covers: saving a bookmark with fetched metadata, creating a note, linking the
two, tagging and collecting, global search, Markdown → rich text → Markdown edits with autosave,
trash and restore, reload persistence, export and re-import, metadata failure handling, stored-HTML
XSS, permanent deletion confirmation, draft recovery after a failed save, and stale-write detection
across two tabs.

The Playwright config boots its own API on `127.0.0.1:4417` with a throwaway database at
`/tmp/linkvault-e2e.db`; it never touches your real library.

## Design

The interface is a single editorial surface: Instrument Serif for titles and item names, Instrument
Sans for the interface, a pale stone canvas, ink-black actions and one deep-teal accent reserved for
state (unread, links, saved). No cards-everywhere dashboard, no gradients, no charts.

## Known limitations

- Single user, no authentication: anyone with access to the machine can read the library.
- Metadata fetching depends on the target site allowing a plain server-side request; paywalled or
  bot-protected pages will save with a warning instead of metadata.
- Favicons are proxied on demand; the first view of a bookmark may show a generic icon until the
  icon loads or the site provides none.
- Rich-text mode covers headings, paragraphs, links, bullet/ordered/task lists, tables, blockquotes,
  code blocks, bold/italic/strike. Markdown features outside that set (footnotes, definition lists,
  raw HTML) are preserved as text where Tiptap cannot represent them.
- No cloud sync, sharing, or mobile app by design.
