import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: "LIMO - Little Moslems Language Club",
    template: "%s | LIMO",
  },
  description: "Program Bahasa Inggris dan Bahasa Arab ramah anak dengan progres belajar yang dapat dipantau wali.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "LIMO - Little Moslems Language Club",
    title: "LIMO - Little Moslems Language Club",
    description: "Belajar Bahasa Inggris dan Bahasa Arab dengan suasana ramah anak dan pantauan progres untuk wali.",
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "LIMO Little Moslems Language Club" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LIMO - Little Moslems Language Club",
    description: "Program Bahasa Inggris dan Bahasa Arab ramah anak.",
    images: ["/opengraph-image"],
  },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="id">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
