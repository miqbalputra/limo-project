import { ImageResponse } from "next/og";
import { LIMO_MEDIA_COLORS } from "@/lib/limo-brand";

export const alt = "LIMO Little Moslems Language Club";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: LIMO_MEDIA_COLORS.primary,
        color: LIMO_MEDIA_COLORS.white,
        display: "flex",
        height: "100%",
        justifyContent: "center",
        padding: "72px",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", maxWidth: "980px" }}>
        <div style={{ color: LIMO_MEDIA_COLORS.primarySoft, display: "flex", fontSize: 28, letterSpacing: 5 }}>LITTLE MOSLEMS LANGUAGE CLUB</div>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 800, lineHeight: 1.05, marginTop: 28 }}>Bahasa membuka dunia. LIMO menemani langkah pertamanya.</div>
        <div style={{ display: "flex", fontSize: 32, marginTop: 36 }}>English & Arabic for Kids</div>
      </div>
    </div>,
    size,
  );
}
