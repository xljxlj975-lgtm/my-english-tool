'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(1);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextIdRef.current++;

    setToasts((current) => [...current, { id, message, tone }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2600);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col gap-2 md:inset-x-auto md:right-4 md:top-4 md:w-80">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-lg backdrop-blur ${
              toast.tone === 'success'
                ? 'bg-emerald-600/95'
                : toast.tone === 'error'
                ? 'bg-red-600/95'
                : 'bg-slate-900/92'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
