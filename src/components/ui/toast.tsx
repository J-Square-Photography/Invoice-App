'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

// Messages that don't say whether they are good news get a green tick when their title reads like a success
const SUCCESS_TITLE = /^(success|saved|created|deleted|updated|copied|converted|verified|duplicated|paid|payment recorded|status updated|done|sent|added|removed|reverted|marked)/i;

export interface ToastOptions {
  title?: string;
  description?: React.ReactNode;
  variant?: 'default' | 'destructive' | 'success' | 'warning' | string;
}

interface ToastItem {
  id: string;
  title?: string;
  description?: React.ReactNode;
  type: ToastType;
}

export interface ToastContextType {
  toast: (
    content: string | ToastOptions,
    typeOrOptions?: ToastType
  ) => void;
}

const ToastContext = React.createContext<ToastContextType>({
  toast: () => {},
});

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback(
    (content: string | ToastOptions, typeOrOptions: ToastType = 'info') => {
      const id = Math.random().toString(36).substring(2, 9);
      
      let title: string | undefined;
      let description: React.ReactNode | undefined;
      let type: ToastType = typeOrOptions;

      if (typeof content === 'string') {
        description = content;
      } else if (content && typeof content === 'object') {
        title = content.title;
        description = content.description;
        if (content.variant === 'destructive') {
          type = 'error';
        } else if (content.variant === 'success') {
          type = 'success';
        } else if (content.title && SUCCESS_TITLE.test(content.title)) {
          type = 'success';
        } else {
          type = 'info';
        }
      }

      setToasts((prev) => [...prev, { id, title, description, type }]);

      // Errors stay a little longer so there is time to read what went wrong
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, type === 'error' ? 8000 : 4000);
    },
    []
  );

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />,
    info: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border bg-white p-4 shadow-lg transition-all',
              'animate-in slide-in-from-right-full fade-in-0 duration-300'
            )}
          >
            {icons[t.type]}
            <div className="flex-1 min-w-0">
              {t.title && <p className="text-sm font-semibold text-neutral-900">{t.title}</p>}
              {t.description && (
                <p className="text-sm text-neutral-600 break-words">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              aria-label="Dismiss"
              className="ml-2 rounded-md p-1 hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
