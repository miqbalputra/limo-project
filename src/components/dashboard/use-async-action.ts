"use client";

import { useState } from "react";

type AsyncActionOptions<TResult> = {
  fallbackMessage: string;
  onSuccess?: (_result: TResult) => void;
};

export function useAsyncAction<TKey extends string = string>() {
  const [error, setError] = useState("");
  const [pendingKey, setPendingKey] = useState<TKey | null>(null);

  async function run<TResult>(
    key: TKey,
    action: () => Promise<TResult>,
    { fallbackMessage, onSuccess }: AsyncActionOptions<TResult>,
  ): Promise<TResult | undefined> {
    setError("");
    setPendingKey(key);

    try {
      const result = await action();
      onSuccess?.(result);
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : fallbackMessage);
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
