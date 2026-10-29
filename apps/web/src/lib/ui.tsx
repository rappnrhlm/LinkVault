import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';

type Tone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

interface UiContextValue {
  refreshKey: number;
  bump: () => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  capture: 'bookmark' | 'note' | null;
  openCapture: (type: 'bookmark' | 'note') => void;
  closeCapture: () => void;
  toast: (message: string, tone?: Tone) => void;
}

const UiContext = createContext<UiContextValue | null>(null);

export function useUi(): UiContextValue {
  const context = useContext(UiContext);
  if (!context) throw new Error('useUi must be used inside UiProvider');
  return context;
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [capture, setCapture] = useState<'bookmark' | 'note' | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, tone: Tone = 'info') => {
    const id = ++counter.current;
    setToasts((list) => [...list, { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((entry) => entry.id !== id)), 4200);
  }, []);

  const value = useMemo<UiContextValue>(
    () => ({
      refreshKey,
      bump: () => setRefreshKey((key) => key + 1),
      searchOpen,
      setSearchOpen,
      capture,
      openCapture: (type) => setCapture(type),
      closeCapture: () => setCapture(null),
      toast,
    }),
    [refreshKey, searchOpen, capture, toast],
  );

  return (
    <UiContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((entry) => (
          <div key={entry.id} className={`toast toast-${entry.tone}`}>
            {entry.message}
          </div>
        ))}
      </div>
    </UiContext.Provider>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="modal-body">
          <div className="modal-head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
              <X size={17} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
