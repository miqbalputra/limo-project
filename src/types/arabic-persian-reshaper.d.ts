declare module "arabic-persian-reshaper" {
  export const ArabicShaper: {
    convertArabic: (_text: string) => string;
    convertArabicBack: (_text: string) => string;
  };
  export const PersianShaper: {
    convertArabic: (_text: string) => string;
    convertArabicBack: (_text: string) => string;
  };
}
