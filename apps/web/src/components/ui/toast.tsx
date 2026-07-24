"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Accessible toast system (04 §6.3 — toast for mutation feedback/errors). Replaces
 * the prototype's imperative `window.kToast`: toasts render in an `aria-live`
 * region so screen readers announce them, and can be dismissed by keyboard.
 */
type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = { success: Check, error: TriangleAlert, info: Info } as const;
const ACCENT: Record<ToastKind, string> = {
  success: "var(--success-500)",
  error: "var(--danger-500)",
  info: "var(--info-500)",
};

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = nextId++;
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (m) => toast(m, "success"),
      error: (m) => toast(m, "error"),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-6 right-6 z-[999] flex flex-col items-end gap-2"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                "fade-in pointer-events-auto flex max-w-[420px] items-center gap-2.5 rounded-md px-4 py-3",
                "text-[13px] font-medium shadow-lg",
              )}
              style={{ background: "var(--text)", color: "var(--surface)" }}
            >
              <Icon size={16} style={{ color: ACCENT[t.kind], flexShrink: 0 }} aria-hidden />
              <span>{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="ml-1 opacity-60 hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
