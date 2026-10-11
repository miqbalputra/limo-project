"use client";

import { QUIZ_THEME_HEX } from "@/lib/quiz-theme";

export function ThemeHeaderPreview({ themeColor, headerImageUrl }: { themeColor: string; headerImageUrl: string }) {
  const accent = QUIZ_THEME_HEX[themeColor] ?? QUIZ_THEME_HEX.blue;
  return (
    <div className="h-24 w-full rounded-xl sm:h-28" style={{ backgroundColor: accent }}>
      {headerImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={headerImageUrl} alt="Header formulir" className="h-full w-full rounded-xl object-cover" />
      ) : null}
    </div>
  );
}
