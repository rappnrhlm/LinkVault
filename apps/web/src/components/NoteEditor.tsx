import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import DOMPurify from 'dompurify';
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Undo2,
} from 'lucide-react';
import { countWords, htmlToMarkdown, markdownToHtml, relativeTime } from '@linkvault/shared';
import { ApiRequestError, api, type ItemDetail } from '../lib/api';
import { Modal, useUi } from '../lib/ui';

type Mode = 'markdown' | 'rich';
type Status = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'stale';

interface Draft {
  content: string;
  mode: Mode;
  savedAt: string;
}

function draftKey(id: string) {
  return `linkvault:draft:${id}`;
}

function readDraft(id: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    return typeof parsed.content === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function safeHtml(markdown: string): string {
  return DOMPurify.sanitize(markdownToHtml(markdown), {
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'],
    FORBID_ATTR: ['style'],
  });
}

export default function NoteEditor({
  item,
  onSaved,
}: {
  item: ItemDetail;
  onSaved: (item: ItemDetail) => void;
}) {
  const { toast } = useUi();
  const initial = item.note!;
  const [content, setContent] = useState(initial.contentMd);
  const [mode, setMode] = useState<Mode>(initial.editorMode);
  const [status, setStatus] = useState<Status>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(item.updatedAt);
  const [draft, setDraft] = useState<Draft | null>(() => {
    const stored = readDraft(item.id);
    return stored && stored.content !== initial.contentMd && stored.savedAt > item.updatedAt ? stored : null;
  });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const baseRef = useRef(item.updatedAt);
  const contentRef = useRef(content);
  const modeRef = useRef(mode);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  contentRef.current = content;
  modeRef.current = mode;

  const save = useCallback(
    async (nextContent: string, nextMode: Mode) => {
      setStatus('saving');
      try {
        const response = await api.saveNote(item.id, nextContent, nextMode, baseRef.current);
        baseRef.current = response.item.updatedAt;
        dirtyRef.current = false;
        setSavedAt(response.item.updatedAt);
        setStatus('saved');
        if (contentRef.current === nextContent) {
          localStorage.removeItem(draftKey(item.id));
        }
        onSaved(response.item);
      } catch (error) {
        if (error instanceof ApiRequestError && error.code === 'STALE_WRITE') {
          setStatus('stale');
          return;
        }
        setStatus('error');
        toast(error instanceof Error ? error.message : 'Could not save the note', 'error');
      }
    },
    [item.id, onSaved, toast],
  );

  const scheduleSave = useCallback(
    (nextContent: string, nextMode: Mode) => {
      dirtyRef.current = true;
      setStatus('dirty');
      try {
        localStorage.setItem(
          draftKey(item.id),
          JSON.stringify({ content: nextContent, mode: nextMode, savedAt: new Date().toISOString() }),
        );
      } catch {
        /* storage may be full or blocked; autosave still runs */
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(nextContent, nextMode), 700);
    },
    [item.id, save],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: mode === 'rich' ? safeHtml(initial.contentMd) : '',
    editorProps: {
      attributes: { class: 'prose-editor', 'aria-label': 'Note body' },
    },
    onUpdate: ({ editor: current }) => {
      const markdown = htmlToMarkdown(current.getHTML());
      setContent(markdown);
      scheduleSave(markdown, modeRef.current);
    },
  });

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  useEffect(() => {
    if (mode === 'rich' && editor && editor.getHTML() === '<p></p>') {
      editor.commands.setContent(safeHtml(contentRef.current), false);
    }
  }, [mode, editor]);

  function changeMode(next: Mode) {
    if (next === mode) return;
    if (next === 'rich' && editor) {
      editor.commands.setContent(safeHtml(contentRef.current), false);
    }
    if (next === 'markdown' && editor) {
      const markdown = htmlToMarkdown(editor.getHTML());
      setContent(markdown);
      contentRef.current = markdown;
    }
    setMode(next);
    modeRef.current = next;
    scheduleSave(contentRef.current, next);
  }

  function updateContent(next: string) {
    setContent(next);
    contentRef.current = next;
    scheduleSave(next, modeRef.current);
  }

  async function reloadLatest() {
    try {
      const response = await api.item(item.id);
      const latest = response.item.note?.contentMd ?? '';
      setContent(latest);
      contentRef.current = latest;
      baseRef.current = response.item.updatedAt;
      setMode(response.item.note?.editorMode ?? 'markdown');
      if (editor) editor.commands.setContent(safeHtml(latest), false);
      localStorage.removeItem(draftKey(item.id));
      dirtyRef.current = false;
      setStatus('idle');
      setDraft(null);
      onSaved(response.item);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not reload the note', 'error');
    }
  }

  const statusText =
    status === 'saving'
      ? 'Saving…'
      : status === 'dirty'
        ? 'Unsaved changes'
        : status === 'error'
          ? 'Not saved'
          : status === 'stale'
            ? 'Changed elsewhere'
            : `Saved ${savedAt ? relativeTime(savedAt) : ''}`;

  return (
    <div className="note-editor">
      {draft && (
        <div className="draft-banner" role="status">
          <span>
            An unsaved draft from {relativeTime(draft.savedAt)} was recovered from this browser.
          </span>
          <div>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setContent(draft.content);
                contentRef.current = draft.content;
                setMode(draft.mode);
                if (editor) editor.commands.setContent(safeHtml(draft.content), false);
                setDraft(null);
                scheduleSave(draft.content, draft.mode);
              }}
            >
              Restore it
            </button>
            <button
              type="button"
              className="link-btn muted"
              onClick={() => {
                localStorage.removeItem(draftKey(item.id));
                setDraft(null);
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {status === 'stale' && (
        <div className="draft-banner warning" role="alert">
          <span>This note changed elsewhere since you opened it. Your latest typing is kept here.</span>
          <button type="button" className="link-btn" onClick={reloadLatest}>
            Load the latest version
          </button>
        </div>
      )}

      <div className="editor-bar">
        <div className="segmented" role="group" aria-label="Editor mode">
          <button
            type="button"
            className={mode === 'markdown' ? 'on' : ''}
            onClick={() => changeMode('markdown')}
          >
            Markdown
          </button>
          <button type="button" className={mode === 'rich' ? 'on' : ''} onClick={() => changeMode('rich')}>
            Rich text
          </button>
        </div>
        <div className="save-state" data-state={status} aria-live="polite">
          <span className="save-dot" />
          {statusText}
          {status === 'error' && (
            <button type="button" className="link-btn" onClick={() => void save(contentRef.current, modeRef.current)}>
              Retry
            </button>
          )}
        </div>
      </div>

      {mode === 'rich' ? (
        <div className="rich-shell">
          <div className="editor-toolbar" role="toolbar" aria-label="Formatting">
            <ToolbarButton
              label="Bold"
              active={editor?.isActive('bold')}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="Italic"
              active={editor?.isActive('italic')}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="Strikethrough"
              active={editor?.isActive('strike')}
              onClick={() => editor?.chain().focus().toggleStrike().run()}
            >
              <Strikethrough size={15} />
            </ToolbarButton>
            <span className="toolbar-sep" />
            <ToolbarButton
              label="Heading 1"
              active={editor?.isActive('heading', { level: 1 })}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              <Heading1 size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="Heading 2"
              active={editor?.isActive('heading', { level: 2 })}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 size={15} />
            </ToolbarButton>
            <span className="toolbar-sep" />
            <ToolbarButton
              label="Bullet list"
              active={editor?.isActive('bulletList')}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="Numbered list"
              active={editor?.isActive('orderedList')}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="Checklist"
              active={editor?.isActive('taskList')}
              onClick={() => editor?.chain().focus().toggleTaskList().run()}
            >
              <ListChecks size={15} />
            </ToolbarButton>
            <span className="toolbar-sep" />
            <ToolbarButton
              label="Quote"
              active={editor?.isActive('blockquote')}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            >
              <Quote size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="Code block"
              active={editor?.isActive('codeBlock')}
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            >
              <Code2 size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="Table"
              onClick={() =>
                editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
            >
              <Table2 size={15} />
            </ToolbarButton>
            <ToolbarButton
              label="Link"
              active={editor?.isActive('link')}
              onClick={() => {
                setLinkUrl(editor?.getAttributes('link').href ?? '');
                setLinkOpen(true);
              }}
            >
              <Link2 size={15} />
            </ToolbarButton>
            <span className="toolbar-sep" />
            <ToolbarButton label="Undo" onClick={() => editor?.chain().focus().undo().run()}>
              <Undo2 size={15} />
            </ToolbarButton>
            <ToolbarButton label="Redo" onClick={() => editor?.chain().focus().redo().run()}>
              <Redo2 size={15} />
            </ToolbarButton>
          </div>
          <EditorContent editor={editor} />
        </div>
      ) : (
        <textarea
          className="markdown-input"
          value={content}
          onChange={(event) => updateContent(event.target.value)}
          spellCheck
          aria-label="Note body in Markdown"
        />
      )}

      <div className="editor-foot">
        <span>{countWords(content)} words</span>
        <span>{content.length.toLocaleString()} characters</span>
        <span className="editor-hint">
          {mode === 'markdown'
            ? 'Markdown supports headings, lists, checklists, tables and fenced code.'
            : 'Formatting is converted to Markdown as you type.'}
        </span>
      </div>

      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="Link">
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            const value = linkUrl.trim();
            if (!value) {
              editor?.chain().focus().extendMarkRange('link').unsetLink().run();
              setLinkOpen(false);
              return;
            }
            let parsed: URL;
            try {
              parsed = new URL(value);
            } catch {
              toast('Enter a full http or https URL', 'error');
              return;
            }
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
              toast('Only http and https links are allowed', 'error');
              return;
            }
            editor?.chain().focus().extendMarkRange('link').setLink({ href: parsed.toString() }).run();
            setLinkOpen(false);
          }}
        >
          <label className="field">
            <span>URL</span>
            <input
              className="input"
              autoFocus
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://"
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                editor?.chain().focus().extendMarkRange('link').unsetLink().run();
                setLinkOpen(false);
              }}
            >
              Remove link
            </button>
            <button type="submit" className="btn btn-primary">Apply link</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`toolbar-btn ${active ? 'on' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
