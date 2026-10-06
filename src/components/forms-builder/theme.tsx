"use client";

const THEME_HEX: Record<string, string> = {
  blue: "#465fff",
  green: "#12b76a",
  purple: "#7a5af8",
  orange: "#f79009",
  red: "#f04438",
  teal: "#15b79e",
  slate: "#475467",
};

export function ThemeHeaderPreview({ themeColor, headerImageUrl }: { themeColor: string; headerImageUrl: string }) {
  const accent = THEME_HEX[themeColor] ?? THEME_HEX.blue;
  return (
    <div className="h-24 w-full rounded-xl sm:h-28" style={{ backgroundColor: accent }}>
      {headerImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={headerImageUrl} alt="Header formulir" className="h-full w-full rounded-xl object-cover" />
      ) : null}
    </div>
  );
}
