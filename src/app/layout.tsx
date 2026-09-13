import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notoNaskhArabic } from "@/app/fonts";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: "LIMO - Little Moslems Academy",
    template: "%s | LIMO",
  },
  description: "Program Bahasa Inggris dan Bahasa Arab ramah anak dengan progres belajar yang dapat dipantau wali.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "LIMO - Little Moslems Academy",
    title: "LIMO - Little Moslems Academy",
    description: "Belajar Bahasa Inggris dan Bahasa Arab dengan suasana ramah anak dan pantauan progres untuk wali.",
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "LIMO Little Moslems Academy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LIMO - Little Moslems Academy",
    description: "Program Bahasa Inggris dan Bahasa Arab ramah anak.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="id" className={notoNaskhArabic.variable}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
