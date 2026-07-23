import type { MetadataRoute } from "next";

const baseUrl = process.env.APP_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/daftar`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/status-pendaftaran`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/kebijakan-privasi`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/syarat-penggunaan`,
      lastModified: new Date(),
    },
  ];
}
