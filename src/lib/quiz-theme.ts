export const QUIZ_THEME_HEX: Record<string, string> = {
  blue: "#465fff",
  green: "#12b76a",
  purple: "#7a5af8",
  orange: "#f79009",
  red: "#f04438",
  teal: "#15b79e",
  slate: "#475467",
};

export function themeAccent(slug?: string | null) {
  return (slug && QUIZ_THEME_HEX[slug]) || QUIZ_THEME_HEX.blue;
}

export function accentTextOn(hex: string) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#101828" : "#ffffff";
}

export function darken(hex: string, amount: number) {
  const value = hex.replace("#", "");
  const channels = [value.slice(0, 2), value.slice(2, 4), value.slice(4, 6)].map((channel) => Math.max(0, Math.round(parseInt(channel, 16) * (1 - amount))));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
