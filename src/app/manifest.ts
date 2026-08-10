import type { MetadataRoute } from "next";
import { LIMO_MEDIA_COLORS } from "@/lib/limo-brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LIMO LMS",
    short_name: "LIMO",
    description: "Sistem informasi kursus LIMO Little Moslems Language Club.",
    start_url: "/",
    display: "standalone",
    scope: "/",
    background_color: LIMO_MEDIA_COLORS.white,
    theme_color: LIMO_MEDIA_COLORS.primary,
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
