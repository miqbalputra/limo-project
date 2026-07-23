import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LIMO LMS",
    short_name: "LIMO",
    description: "Sistem informasi kursus LIMO Little Moslems Language Club.",
    start_url: "/",
    display: "standalone",
    scope: "/",
    background_color: "#ffffff",
    theme_color: "#2372B8",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
