export type QuizUploadConfig = { allowedTypes: string[]; maxSizeMb: number };

export function readQuizUploadConfig(value: unknown): QuizUploadConfig {
  const parsed = value && typeof value === "object" ? (value as { allowedTypes?: unknown; maxSizeMb?: unknown }) : {};
  const allowedTypes = Array.isArray(parsed.allowedTypes)
    ? parsed.allowedTypes.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().toLowerCase())
    : [];
  const maxSizeMb = typeof parsed.maxSizeMb === "number" && Number.isFinite(parsed.maxSizeMb) && parsed.maxSizeMb > 0
    ? Math.min(parsed.maxSizeMb, 200)
    : 0;

  return { allowedTypes, maxSizeMb };
}

export function uploadAcceptAttribute(allowedTypes: string[]) {
  return allowedTypes.join(",");
}

export function canRecordAudio(allowedTypes: string[]) {
  return allowedTypes.length === 0 || allowedTypes.some((type) => type.startsWith("audio/"));
}

export function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
