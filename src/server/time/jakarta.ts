export const APP_TIME_ZONE = "Asia/Jakarta";
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type JakartaDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const jakartaFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function getJakartaDateParts(date = new Date()): JakartaDateParts {
  const parts = Object.fromEntries(
    jakartaFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function formatJakartaDate(date = new Date()) {
  const parts = getJakartaDateParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function formatJakartaPeriod(date = new Date()) {
  const parts = getJakartaDateParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

export function getJakartaDayRange(startOffsetDays = 0, endOffsetDays = 1) {
  const { year, month, day } = getJakartaDateParts();
  const base = Date.UTC(year, month - 1, day) - JAKARTA_OFFSET_MS;

  return {
    start: new Date(base + startOffsetDays * DAY_MS),
    end: new Date(base + endOffsetDays * DAY_MS),
  };
}
