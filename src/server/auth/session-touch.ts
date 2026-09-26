export const SESSION_TOUCH_MIN_INTERVAL_MS = 5_000;
export const SESSION_TOUCH_MAX_INTERVAL_MS = 60_000;

export function getSessionTouchIntervalMs(idleMinutes: number) {
  const idleMs = idleMinutes * 60 * 1000;
  return Math.max(SESSION_TOUCH_MIN_INTERVAL_MS, Math.min(SESSION_TOUCH_MAX_INTERVAL_MS, Math.floor(idleMs / 10)));
}

const TRANSIENT_ERROR_CODES = new Set(["P2034"]);

const TRANSIENT_ERROR_MESSAGES = [
  "Record has changed since last read",
  "Deadlock found",
  "Lock wait timeout",
  "try restarting transaction",
];

export function isTransientSessionWriteError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && TRANSIENT_ERROR_CODES.has(code)) {
    return true;
  }

  const message = String((error as { message?: unknown }).message ?? "");
  return TRANSIENT_ERROR_MESSAGES.some((snippet) => message.includes(snippet));
}
