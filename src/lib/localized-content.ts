export type LocalizedDirection = "ltr" | "rtl" | "auto";

export type LocalizedContentInput = {
  language?: string | null;
  direction?: string | null;
  text?: string | null;
};

const arabicScript = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u;

export function containsArabicText(value: string | null | undefined) {
  return Boolean(value && arabicScript.test(value));
}

export function resolveLocalizedContent({ language, direction, text }: LocalizedContentInput) {
  const normalizedLanguage = language?.trim().toLowerCase() || "";
  const languageIsArabic = normalizedLanguage === "ar" || normalizedLanguage.startsWith("ar-");
  const isArabic = text === undefined ? languageIsArabic : containsArabicText(text);
  const requestedDirection = direction === "rtl" || direction === "ltr" || direction === "auto" ? direction : undefined;
  const resolvedDirection: LocalizedDirection = requestedDirection === "rtl"
    ? (isArabic ? "rtl" : "auto")
    : requestedDirection || (isArabic ? "rtl" : "auto");

  return {
    isArabic,
    language: isArabic ? "ar" : undefined,
    direction: resolvedDirection,
  };
}
