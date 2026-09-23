import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import bidiFactory from "bidi-js";
import { ArabicShaper } from "arabic-persian-reshaper";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { Actor } from "@/server/auth/session";
import { getQuizForm } from "@/server/services/quiz-builder-service";
import { getQuizMedia } from "@/server/services/quiz-media-service";

const THEME_HEX: Record<string, string> = {
  blue: "#465fff",
  green: "#12b76a",
  purple: "#7a5af8",
  orange: "#f79009",
  red: "#f04438",
  teal: "#15b79e",
  slate: "#475467",
};

const INK = "#101828";
const MUTED = "#667085";
const MARGIN = 50;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const bidi = bidiFactory();
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const REGULAR_FONT_PATH = path.join(FONT_DIR, "Amiri-Regular.ttf");
const BOLD_FONT_PATH = path.join(FONT_DIR, "Amiri-Bold.ttf");
const hasArabicFont = existsSync(REGULAR_FONT_PATH) && existsSync(BOLD_FONT_PATH);
const regularFontBuffer = hasArabicFont ? readFileSync(REGULAR_FONT_PATH) : null;
const boldFontBuffer = hasArabicFont ? readFileSync(BOLD_FONT_PATH) : null;

function registerFonts(doc: PDFKit.PDFDocument) {
  if (regularFontBuffer) doc.registerFont("amiri", regularFontBuffer);
  if (boldFontBuffer) doc.registerFont("amiri-bold", boldFontBuffer);
}

function shape(text: string) {
  if (!ARABIC_RE.test(text)) return { text, arabic: false, rtl: false };
  const shaped = ArabicShaper.convertArabic(text);
  const embedding = bidi.getEmbeddingLevels(shaped, "auto");
  return {
    text: bidi.getReorderedString(shaped, embedding),
    arabic: true,
    rtl: (embedding.paragraphs[0]?.level ?? 0) % 2 === 1,
  };
}

function fontFor(bold: boolean, arabic: boolean) {
  if (arabic && hasArabicFont) return bold ? "amiri-bold" : "amiri";
  return bold ? "Helvetica-Bold" : "Helvetica";
}

type TextOptions = { x: number; y: number; width?: number; size: number; bold?: boolean; color: string; align?: "left" | "right" | "center" };

function putText(doc: PDFKit.PDFDocument, text: string, options: TextOptions) {
  const shaped = shape(text);
  const align = shaped.rtl ? "right" : (options.align ?? "left");
  doc.fillColor(options.color).font(fontFor(Boolean(options.bold), shaped.arabic)).fontSize(options.size);
  doc.text(shaped.text, options.x, options.y, { width: options.width, align });
  return doc.y;
}

function mediaId(url?: string | null) {
  if (!url) return null;
  const match = url.match(/\/api\/v1\/public\/quiz-media\/([^/?#]+)/);
  return match ? match[1] : null;
}

async function loadImage(url?: string | null) {
  const id = mediaId(url);
  if (!id) return null;
  try {
    const media = await getQuizMedia(id);
    return media.bytes;
  } catch {
    return null;
  }
}

function ensureSpace(doc: PDFKit.PDFDocument, y: number, needed: number) {
  if (y + needed > doc.page.height - MARGIN - 24) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function drawImage(doc: PDFKit.PDFDocument, bytes: Buffer, x: number, y: number, maxWidth: number, maxHeight: number) {
  try {
    const loose = doc as unknown as {
      openImage: (_source: Buffer) => { width: number; height: number };
      image: (_source: unknown, _left: number, _top: number, _options: { width: number; height: number }) => unknown;
    };
    const image = loose.openImage(bytes);
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;
    loose.image(image, x, y, { width, height });
    return height;
  } catch {
    return null;
  }
}

export async function createQuizPdf(actor: Actor, ujianId: string, options: { withKey?: boolean } = {}) {
  const { item } = await getQuizForm(actor, ujianId);
  const accent = THEME_HEX[item.themeColor] ?? THEME_HEX.blue;

  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true, info: { Title: item.title, Author: "LIMO" } });
  registerFonts(doc);
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  let y = MARGIN;

  const headerImage = await loadImage(item.headerImageUrl);
  if (headerImage) {
    const height = drawImage(doc, headerImage, MARGIN, y, CONTENT_WIDTH, 140);
    if (height !== null) y += height + 14;
  }

  y = putText(doc, "LIMO · KUIS ONLINE", { x: MARGIN, y, width: CONTENT_WIDTH, size: 9, bold: true, color: accent }) + 4;
  y = putText(doc, item.title, { x: MARGIN, y, width: CONTENT_WIDTH, size: 20, bold: true, color: INK }) + 4;
  if (item.description) {
    y = putText(doc, item.description, { x: MARGIN, y, width: CONTENT_WIDTH, size: 10, color: MUTED }) + 4;
  }
  const meta = `${item.questions.length} soal · ${item.durationMinutes} menit${item.passingScore !== null ? ` · KKM ${item.passingScore}` : ""}`;
  y = putText(doc, meta, { x: MARGIN, y, width: CONTENT_WIDTH, size: 9, color: MUTED }) + 10;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y).strokeColor(accent).lineWidth(2).stroke();
  y += 16;

  const sections = item.sections.length > 0 ? item.sections : [{ title: "", description: "" }];
  let number = 0;

  for (const [sectionIndex, section] of sections.entries()) {
    const questions = item.questions.filter((question) => question.sectionIndex === sectionIndex);
    if (questions.length === 0) continue;

    y = ensureSpace(doc, y, 44);
    if (section.title) {
      y = putText(doc, section.title, { x: MARGIN, y, width: CONTENT_WIDTH, size: 12, bold: true, color: accent }) + 2;
    }
    if (section.description) {
      y = putText(doc, section.description, { x: MARGIN, y, width: CONTENT_WIDTH, size: 9, color: MUTED }) + 2;
    }
    y += 6;

    for (const question of questions) {
      number += 1;
      y = ensureSpace(doc, y, 56);
      y = putText(doc, `${number}. ${question.question}`, { x: MARGIN, y, width: CONTENT_WIDTH, size: 11, bold: true, color: INK }) + 4;

      const questionImage = await loadImage(question.mediaUrl);
      if (questionImage) {
        const height = drawImage(doc, questionImage, MARGIN + 16, y, 280, 220);
        if (height !== null) y += height + 6;
      }

      if (question.type === "PILIHAN_GANDA" || question.type === "MULTI_SELECT") {
        for (const option of question.options) {
          y = ensureSpace(doc, y, 18);
          y = putText(doc, `${option.label}. ${option.content}`, { x: MARGIN + 16, y, width: CONTENT_WIDTH - 16, size: 10, color: INK }) + 2;
          const optionImage = await loadImage(option.mediaUrl);
          if (optionImage) {
            const height = drawImage(doc, optionImage, MARGIN + 34, y, 160, 120);
            if (height !== null) y += height + 4;
          }
        }
      } else if (question.type === "BENAR_SALAH") {
        y = putText(doc, "( ) Benar     ( ) Salah", { x: MARGIN + 16, y, width: CONTENT_WIDTH - 16, size: 10, color: INK }) + 2;
      } else {
        const lines = question.type === "ESAI" ? 4 : 1;
        for (let line = 0; line < lines; line += 1) {
          y = ensureSpace(doc, y, 18);
          y = putText(doc, ".".repeat(96), { x: MARGIN + 16, y, width: CONTENT_WIDTH - 16, size: 10, color: MUTED }) + 2;
        }
      }

      y += 8;
    }

    y += 4;
  }

  if (options.withKey) {
    doc.addPage();
    let keyY = MARGIN;
    keyY = putText(doc, "Kunci Jawaban", { x: MARGIN, y: keyY, width: CONTENT_WIDTH, size: 14, bold: true, color: accent }) + 8;
    let keyNumber = 0;
    for (const question of item.questions) {
      keyNumber += 1;
      const answer = question.type === "PILIHAN_GANDA" || question.type === "MULTI_SELECT"
        ? (question.correctLabels.join(", ") || "-")
        : (question.expectedAnswer || "-");
      keyY = ensureSpace(doc, keyY, 18);
      keyY = putText(doc, `${keyNumber}. ${answer}`, { x: MARGIN, y: keyY, width: CONTENT_WIDTH, size: 10, color: INK }) + 2;
    }
  }

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    putText(doc, "Dibuat oleh LIMO", { x: MARGIN, y: doc.page.height - 34, width: CONTENT_WIDTH, size: 8, color: MUTED, align: "left" });
    putText(doc, `${index + 1} / ${range.count}`, { x: MARGIN, y: doc.page.height - 34, width: CONTENT_WIDTH, size: 8, color: MUTED, align: "right" });
  }

  doc.end();
  return finished;
}
