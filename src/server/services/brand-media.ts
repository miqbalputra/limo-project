import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

let logoDataUrl: string | null = null;

/**
 * Logo LIMO sebagai data URL JPEG — dipakai bersama oleh invoice/kuitansi PDF (pdfkit)
 * dan invoice PNG (next/og). Format data URL dipilih karena build standalone pdfkit
 * tidak memuat fs (doc.image(path) gagal) dan Buffer Node tidak dikenali shim browserify.
 */
export async function getBrandLogoDataUrl(): Promise<string> {
  if (!logoDataUrl) {
    const bytes = await readFile(path.join(process.cwd(), "public", "logo.jpg"));
    logoDataUrl = `data:image/jpeg;base64,${bytes.toString("base64")}`;
  }
  return logoDataUrl;
}