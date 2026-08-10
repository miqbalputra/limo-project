export const LIMO_COLORS = {
  blue: { 50: "#F6FBFF", 100: "#E5F2FF", 200: "#C2E0FF", 300: "#91C3F6", 400: "#5D9DDC", 500: "#2372B8", 600: "#0E5D9D", 700: "#044980", 800: "#033761", 900: "#042847" },
  sky: { 50: "#F4FBFF", 100: "#E0F4FE", 200: "#BCE5FA", 300: "#94D3F2", 400: "#65BAE1", 500: "#0F99C9", 600: "#00769D", 700: "#005876", 800: "#003E54", 900: "#002B3C" },
  red: { 50: "#FFF8F7", 100: "#FFEBE8", 200: "#FFCFC9", 300: "#FFABA1", 400: "#FF7B71", 500: "#F73F3D", 600: "#C92326", 700: "#9E151A", 800: "#76080E", 900: "#540A0B" },
  yellow: { 50: "#FDFBED", 100: "#F8F3D1", 200: "#F7EBA9", 300: "#F9E06C", 400: "#E3BE1F", 500: "#BD9600", 600: "#997200", 700: "#7B5600", 800: "#5E3E04", 900: "#462D0B" },
  green: { 50: "#F4FDF6", 100: "#E1F7E6", 200: "#BAEAC6", 300: "#85DB9E", 400: "#52CF7F", 500: "#09C467", 600: "#009D51", 700: "#00773C", 800: "#00572A", 900: "#043E1D" },
  neutral: { 50: "#FAFAFA", 100: "#F3F3F3", 200: "#E1E1E1", 300: "#CACACA", 400: "#9E9E9E", 500: "#747474", 600: "#525252", 700: "#353535", 800: "#1F1F1F", 900: "#0F0F0F" },
  white: "#FFFFFF",
} as const;

export const LIMO_MEDIA_COLORS = {
  primary: LIMO_COLORS.blue[500],
  primaryDark: LIMO_COLORS.blue[800],
  primarySoft: LIMO_COLORS.blue[100],
  sky: LIMO_COLORS.sky[300],
  success: LIMO_COLORS.green[500],
  successText: LIMO_COLORS.green[700],
  warning: LIMO_COLORS.yellow[300],
  warningText: LIMO_COLORS.yellow[800],
  danger: LIMO_COLORS.red[500],
  dangerText: LIMO_COLORS.red[700],
  surface: LIMO_COLORS.neutral[50],
  surfaceMuted: LIMO_COLORS.neutral[100],
  border: LIMO_COLORS.neutral[200],
  text: LIMO_COLORS.neutral[800],
  muted: LIMO_COLORS.neutral[600],
  mutedLight: LIMO_COLORS.neutral[400],
  white: LIMO_COLORS.white,
} as const;

export function toExcelArgb(hex: string) {
  return `FF${hex.slice(1).toUpperCase()}`;
}
