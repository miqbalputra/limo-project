import { Noto_Naskh_Arabic } from "next/font/google";

// next/font downloads this at build time and serves the generated asset locally.
export const notoNaskhArabic = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: "variable",
  display: "swap",
  variable: "--font-arabic",
  fallback: ["serif"],
});
