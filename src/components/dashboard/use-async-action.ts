"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast-provider";

type AsyncActionOptions<TResult> = {
  fallbackMessage: string;
  successMessage?: string;
  onSuccess?: (_result: TResult) => void;
};

export function useAsyncAction<TKey extends string = string>() {
  const [error, setError] = useState("");
  const [pendingKey, setPendingKey] = useState<TKey | null>(null);
  const toast = useToast();

  async function run<TResult>(
    key: TKey,
    action: () => Promise<TResult>,
    { fallbackMessage, successMessage, onSuccess }: AsyncActionOptions<TResult>,
  ): Promise<TResult | undefined> {
    setError("");
    setPendingKey(key);

    try {
      const result = await action();
      onSuccess?.(result);
      if (successMessage) toast.success(successMessage);
      return result;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : fallbackMessage;
      setError(message);
      toast.error(message);
      return undefined;
    } finally {
      setPendingKey(null);
    }
  }

  return {
    error,
    isPending: pendingKey !== null,
    pendingKey,
    run,
  };
}
