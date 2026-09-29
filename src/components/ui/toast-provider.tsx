"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type ToastVariant = "success" | "error" | "info";

export type ToastInput = {
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  push: (_input: ToastInput) => void;
  success: (_message: string) => void;
  error: (_message: string) => void;
  dismiss: (_id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantClass: Record<ToastVariant, string> = {
  success: "tailadmin-alert-success",
  error: "tailadmin-alert-error",
  info: "tailadmin-alert-warning",
};

const MAX_TOASTS = 3;
const DEFAULT_DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    ({ message, variant = "info", durationMs = DEFAULT_DURATION_MS }: ToastInput) => {
      const trimmed = message?.trim();
      if (!trimmed) return;

      nextId.current += 1;
      const id = nextId.current;
      setToasts((current) => [...current.slice(-(MAX_TOASTS - 1)), { id, message: trimmed, variant }]);

      if (durationMs > 0) {
        window.setTimeout(() => dismiss(id), durationMs);
      }
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      dismiss,
      success: (message: string) => push({ message, variant: "success" }),
      error: (message: string) => push({ message, variant: "error" }),
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-stretch gap-2 px-4 py-4 sm:inset-x-auto sm:right-0 sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.variant === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 shadow-theme-lg motion-safe:animate-[fadeIn_150ms_ease-out] ${variantClass[toast.variant]}`}
          >
            <p className="flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 text-theme-xs font-semibold underline-offset-2 hover:underline"
            >
              Tutup
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast harus dipakai di dalam ToastProvider");
  }

  return context;
}
