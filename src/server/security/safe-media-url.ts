export function isSafeMediaUrl(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return true;
  }

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
