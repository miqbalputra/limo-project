import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import bidiFactory from "bidi-js";
import { ArabicShaper } from "arabic-persian-reshaper";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { Actor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { getSertifikatForActor } from "@/server/services/certificate-service";

const INK = "#101828";
const MUTED = "#667085";
const ACCENT = "#2372B8";
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const bidi = bidiFactory();
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const REGULAR_FONT_PATH = path.join(FONT_DIR, "Amiri-Regular.ttf");
const BOLD_FONT_PATH = path.join(FONT_DIR, "Amiri-Bold.ttf");
const hasArabicFont = existsSync(REGULAR_FONT_PATH) && existsSync(BOLD_FONT_PATH);
const regularFontBuffer = hasArabicFont ? readFileSync(REGULAR_FONT_PATH) : null;
const boldFontBuffer = hasArabicFont ? readFileSync(BOLD_FONT_PATH) : null;

function hasArabic(value: string) {
  return ARABIC_RE.test(value);
}

function writeName(doc: PDFKit.PDFDocument, name: string, width: number, y: number) {
  doc.fillColor(ACCENT);

  if (hasArabic(name) && hasArabicFont) {
    const shaped = ArabicShaper.convertArabic(name) as string;
    const embedding = bidi.getEmbeddingLevels(shaped, "auto");
    doc.font("amiri").fontSize(30).text(bidi.getReorderedString(shaped, embedding), 0, y, { width, align: "center" });
    return;
  }

  doc.font("Helvetica-Bold").fontSize(30).text(name, 0, y, { width, align: "center" });
}

export async function buildCertificatePdf(input: {
  studentName: string;
  programName: string;
  className: string;
  levelName?: string | null;
  title: string;
  code: string;
  issuedAt: Date;
  note?: string | null;
}) {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
  if (regularFontBuffer) doc.registerFont("amiri", regularFontBuffer);
  if (boldFontBuffer) doc.registerFont("amiri-bold", boldFontBuffer);

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const width = doc.page.width;
  const height = doc.page.height;

  doc.rect(24, 24, width - 48, height - 48).lineWidth(2).strokeColor(ACCENT).stroke();
  doc.rect(34, 34, width - 68, height - 68).lineWidth(0.7).strokeColor(MUTED).stroke();

  doc.font("Helvetica-Bold").fontSize(15).fillColor(MUTED).text("LITTLE MOSLEMS ACADEMY", 0, 78, { align: "center", width });
  doc.font("Helvetica-Bold").fontSize(38).fillColor(INK).text("SERTIFIKAT", 0, 104, { align: "center", width });
  doc.font("Helvetica").fontSize(12).fillColor(MUTED).text("Certificate of Completion", 0, 152, { align: "center", width });

  doc.font("Helvetica").fontSize(13).fillColor(INK).text("Diberikan kepada", 0, 196, { align: "center", width });

  writeName(doc, input.studentName, width, 220);
  doc.moveTo(width / 2 - 190, 268).lineTo(width / 2 + 190, 268).lineWidth(0.8).strokeColor(MUTED).stroke();

  doc.font("Helvetica").fontSize(12).fillColor(INK).text(`atas penyelesaian ${input.title}`, 0, 284, { align: "center", width });
  doc.font("Helvetica-Bold").fontSize(14).fillColor(INK).text(`${input.programName}${input.levelName ? ` / ${input.levelName}` : ""}`, 0, 306, { align: "center", width });
  doc.font("Helvetica").fontSize(12).fillColor(MUTED).text(`Kelas: ${input.className}`, 0, 328, { align: "center", width });

  const issuedLabel = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(input.issuedAt);
  doc.font("Helvetica").fontSize(11).fillColor(MUTED).text(`Diterbitkan: ${issuedLabel}`, 60, height - 122, { width: 320 });

  const verifyUrl = `${getEnv().APP_URL}/verifikasi-sertifikat/${input.code}`;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(`Kode verifikasi: ${input.code}`, 60, height - 104, { width: 420 });
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(verifyUrl, 60, height - 88, { width: 520 });
  if (input.note) {
    doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(`Catatan: ${input.note}`, 60, height - 70, { width: 520 });
  }

  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("LIMO", width - 200, height - 110, { width: 140, align: "right" });
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Kepala Lembaga", width - 200, height - 92, { width: 140, align: "right" });

  doc.end();
  return done;
}

export async function getCertificatePdf(actor: Actor, id: string) {
  const { item } = await getSertifikatForActor(actor, id);
  const buffer = await buildCertificatePdf({
    studentName: item.siswa.name,
    programName: item.siswa.program.name,
    className: item.kelas.name,
    levelName: item.kelas.level?.name ?? null,
    title: item.title,
    code: item.code,
    issuedAt: item.issuedAt,
    note: item.note,
  });

  return { buffer, filename: `sertifikat-${item.code}.pdf` };
}
