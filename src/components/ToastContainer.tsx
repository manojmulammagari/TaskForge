"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { onToast, showToast, type Toast } from "@/lib/toast";

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const add = useCallback(
    (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      if (t.duration && t.duration > 0) {
        clearTimer(t.id);
        const timer = setTimeout(() => {
          timersRef.current.delete(t.id);
          setToasts((prev) => prev.filter((x) => x.id !== t.id));
        }, t.duration);
        timersRef.current.set(t.id, timer);
      }
    },
    [clearTimer],
  );

  useEffect(() => {
    const unsubscribe = onToast(add);
    // Expose to console for ad-hoc judge demo use.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).showToast = showToast;

    return () => {
      unsubscribe();
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).showToast;
    };
  }, [add]);

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((x) => x.id !== id));
    },
    [clearTimer],
  );

  if (toasts.length === 0) return null;

  return (
    <div id="toast-container" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast ${t.variant === "success" ? "toast-success" : t.variant === "alert" ? "toast-info" : "toast-info"}`}
          role="status"
          aria-atomic="true"
        >
          {t.variant === "success" ? (
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          )}
          <span className="text-swiss-text">{t.title}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="ml-auto p-1 rounded border border-transparent hover:border-swiss-border/40 text-swiss-muted hover:text-swiss-text"
            aria-label={`Dismiss: ${t.title}`}
          >
            <span className="sr-only">Dismiss</span>
            <span className="w-3 h-3 border-t border-r border-swiss-muted rotate-45" />
          </button>
        </div>
      ))}
    </div>
  );
}
