export function sanitizeOriginalFilename(filename: string) {
  const sanitized = filename
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*]/g, "_")
    .split("")
    .map((character) => (character.charCodeAt(0) < 32 ? "_" : character))
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized || sanitized === "." || sanitized === "..") {
    return "file";
  }

  return sanitized.slice(0, 180);
}
