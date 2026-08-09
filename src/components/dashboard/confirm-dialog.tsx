"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode, RefObject } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "status" | "destructive";
  isBusy?: boolean;
  error?: string;
  children?: ReactNode;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onConfirm: () => void;
  onClose: () => void;
};

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter((element) => element.tabIndex >= 0);
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Batal",
  variant = "status",
  isBusy = false,
  error,
  children,
  returnFocusRef,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const isBusyRef = useRef(isBusy);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    isBusyRef.current = isBusy;
  }, [isBusy]);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const returnFocusTarget = returnFocusRef?.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!isBusyRef.current) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !dialogRef.current.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      const focusTarget = returnFocusTarget?.isConnected ? returnFocusTarget : previousFocusRef.current;
      focusTarget?.focus();
    };
  }, [open, returnFocusRef]);

  if (!open) return null;

  const confirmClass = variant === "destructive"
    ? "bg-error-500 text-white hover:bg-error-700"
    : "bg-limo-blue-500 text-white hover:bg-limo-blue-600";
  const iconClass = variant === "destructive" ? "bg-error-50 text-error-700" : "bg-warning-50 text-warning-700";

  function requestClose() {
    if (!isBusy) onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-theme-xl sm:p-6">
        <div className="flex items-start gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-lg font-bold ${iconClass}`} aria-hidden="true">!</span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h2>
            <div id={descriptionId} className="mt-1 text-theme-sm leading-6 text-gray-500">{description}</div>
          </div>
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
        {error ? <p role="alert" className="mt-4 tailadmin-alert-error">{error}</p> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button ref={cancelButtonRef} type="button" onClick={requestClose} disabled={isBusy} className="tailadmin-button-outline px-4 py-2.5">{cancelLabel}</button>
          <button type="button" onClick={onConfirm} disabled={isBusy} className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-theme-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${confirmClass}`}>{isBusy ? "Memproses..." : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
