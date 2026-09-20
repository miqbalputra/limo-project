import "server-only";

// Menggabungkan banyak notifikasi yang dibuat beruntun menjadi satu eksekusi
// pengiriman singkat (best-effort). Job cron tetap menjadi jaring pengaman.
const pendingIds = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_DELAY_MS = 400;
const MAX_BATCH = 50;

export function scheduleImmediateDispatch(notificationId: string | null | undefined) {
  if (!notificationId) {
    return;
  }

  pendingIds.add(notificationId);

  if (flushTimer) {
    return;
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    const batch = [...pendingIds].slice(0, MAX_BATCH);
    pendingIds.clear();
    void flush(batch);
  }, FLUSH_DELAY_MS);

  flushTimer.unref?.();
}

async function flush(ids: string[]) {
  if (ids.length === 0) {
    return;
  }

  try {
    const { dispatchNotificationIds } = await import("@/server/services/notification-job-service");
    await dispatchNotificationIds(ids);
  } catch {
    // Best-effort saja; cron notifications:retry akan mencoba lagi.
  }
}
