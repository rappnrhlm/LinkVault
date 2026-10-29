import { useState } from 'react';
import { Database, Download, HardDrive, Upload } from 'lucide-react';
import type { ImportPayload } from '@linkvault/shared';
import { api } from '../lib/api';
import { useResource } from '../lib/hooks';
import { useUi } from '../lib/ui';
import PageHeader from '../components/PageHeader';

export default function DataPage() {
  const { bump, toast } = useUi();
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ImportPayload | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [backup, setBackup] = useState<string | null>(null);
  const { data: about } = useResource(
    () => fetch('/api/about').then((response) => response.json() as Promise<{ database: string; backups: string }>),
    [],
  );

  async function readFile(next: File | null) {
    setFile(next);
    setParsed(null);
    setResult(null);
    if (!next) return;
    try {
      const text = await next.text();
      const json = JSON.parse(text) as ImportPayload;
      if (json.version !== 1 || !Array.isArray(json.items)) {
        throw new Error('That file is not a LinkVault export');
      }
      setParsed(json);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not read that file', 'error');
      setFile(null);
    }
  }

  return (
    <div className="page data-page">
      <PageHeader
        title="Import & export"
        subtitle="Move your library in and out as a single JSON file. Importing merges; it never wipes what is already here."
      />

      <section className="data-block">
        <div className="data-copy">
          <h2>Export the library</h2>
          <p>
            One JSON file with every bookmark, note, tag, collection and relationship — including
            archived items and items in Trash.
          </p>
        </div>
        <a className="btn" href="/api/export" download="linkvault-export.json">
          <Download size={15} /> Export JSON
        </a>
      </section>

      <section className="data-block">
        <div className="data-copy">
          <h2>Import an export</h2>
          <p>
            Items with the same ID or the same bookmark URL are skipped. Tags and collections are
            reused by name. Nothing is deleted.
          </p>
        </div>
        <div className="data-action">
          <label className="file-field">
            <Upload size={15} />
            <span>{file ? file.name : 'Choose a JSON file'}</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void readFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!parsed || importing}
            onClick={async () => {
              if (!parsed) return;
              setImporting(true);
              try {
                const response = await api.importAll(parsed);
                setResult(response);
                setFile(null);
                setParsed(null);
                bump();
                toast(`Imported ${response.imported} items`, 'success');
              } catch (error) {
                toast(error instanceof Error ? error.message : 'Import failed', 'error');
              } finally {
                setImporting(false);
              }
            }}
          >
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
        {result && (
          <p className="data-result">
            Imported {result.imported} items; skipped {result.skipped} that already existed or were
            incomplete.
          </p>
        )}
      </section>

      <section className="data-block">
        <div className="data-copy">
          <h2>Back up the database</h2>
          <p>
            Writes a consistent copy of the SQLite file into the backups folder beside the database.
            Run it before any risky import.
          </p>
        </div>
        <div className="data-action">
          <button
            type="button"
            className="btn"
            onClick={async () => {
              try {
                const response = await api.backup();
                setBackup(response.file);
                toast('Backup written', 'success');
              } catch (error) {
                toast(error instanceof Error ? error.message : 'Backup failed', 'error');
              }
            }}
          >
            <HardDrive size={15} /> Back up now
          </button>
        </div>
        {backup && <p className="data-result mono-path">{backup}</p>}
      </section>

      <section className="data-block data-block-quiet">
        <div className="data-copy">
          <h2>Where the data lives</h2>
          <p>
            The database is a single SQLite file. It is outside the web build and is not part of the
            repository.
          </p>
        </div>
        <div className="data-paths">
          <p><Database size={14} /> {about?.database ?? 'data/linkvault.db'}</p>
          <p><HardDrive size={14} /> {about?.backups ?? 'data/backups'}</p>
        </div>
      </section>
    </div>
  );
}
