"use client";

import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";

type ConfirmOptions = {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  variant?: "status" | "destructive";
};

type PendingConfirmation = ConfirmOptions & {
  resolve: (_confirmed: boolean) => void;
};

export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setPending({ ...options, resolve });
  }), []);

  const settle = useCallback((confirmed: boolean) => {
    if (!pending) return;
    pending.resolve(confirmed);
    setPending(null);
  }, [pending]);

  const dialog = (
    <ConfirmDialog
      open={Boolean(pending)}
      title={pending?.title || "Konfirmasi aksi"}
      description={pending?.description || "Pastikan Anda ingin melanjutkan aksi ini."}
      confirmLabel={pending?.confirmLabel || "Konfirmasi"}
      variant={pending?.variant}
      onClose={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  );

  return { confirm, dialog };
}
