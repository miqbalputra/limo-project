export const APP_TIME_ZONE = "Asia/Jakarta";

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
