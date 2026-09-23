import "server-only";
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
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  let y = MARGIN;

  const headerImage = await loadImage(item.headerImageUrl);
  if (headerImage) {
    const height = drawImage(doc, headerImage, MARGIN, y, CONTENT_WIDTH, 140);
    if (height !== null) y += height + 14;
  }

  doc.fillColor(accent).font("Helvetica-Bold").fontSize(9).text("LIMO · KUIS ONLINE", MARGIN, y);
  y = doc.y + 4;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(20).text(item.title, MARGIN, y, { width: CONTENT_WIDTH });
  y = doc.y + 4;
  if (item.description) {
    doc.fillColor(MUTED).font("Helvetica").fontSize(10).text(item.description, MARGIN, y, { width: CONTENT_WIDTH });
    y = doc.y + 4;
  }
  const meta = `${item.questions.length} soal · ${item.durationMinutes} menit${item.passingScore !== null ? ` · KKM ${item.passingScore}` : ""}`;
  doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(meta, MARGIN, y, { width: CONTENT_WIDTH });
  y = doc.y + 10;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y).strokeColor(accent).lineWidth(2).stroke();
  y += 16;

  const sections = item.sections.length > 0 ? item.sections : [{ title: "", description: "" }];
  let number = 0;

  for (const [sectionIndex, section] of sections.entries()) {
    const questions = item.questions.filter((question) => question.sectionIndex === sectionIndex);
    if (questions.length === 0) continue;

    y = ensureSpace(doc, y, 44);
    if (section.title) {
      doc.fillColor(accent).font("Helvetica-Bold").fontSize(12).text(section.title, MARGIN, y, { width: CONTENT_WIDTH });
      y = doc.y + 2;
    }
    if (section.description) {
      doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(section.description, MARGIN, y, { width: CONTENT_WIDTH });
      y = doc.y + 2;
    }
    y += 6;

    for (const question of questions) {
      number += 1;
      y = ensureSpace(doc, y, 56);
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(`${number}. ${question.question}`, MARGIN, y, { width: CONTENT_WIDTH });
      y = doc.y + 4;

      const questionImage = await loadImage(question.mediaUrl);
      if (questionImage) {
        const height = drawImage(doc, questionImage, MARGIN + 16, y, 280, 220);
        if (height !== null) y += height + 6;
      }

      if (question.type === "PILIHAN_GANDA" || question.type === "MULTI_SELECT") {
        for (const option of question.options) {
          y = ensureSpace(doc, y, 18);
          doc.fillColor(INK).font("Helvetica").fontSize(10).text(`${option.label}. ${option.content}`, MARGIN + 16, y, { width: CONTENT_WIDTH - 16 });
          y = doc.y + 2;
          const optionImage = await loadImage(option.mediaUrl);
          if (optionImage) {
            const height = drawImage(doc, optionImage, MARGIN + 34, y, 160, 120);
            if (height !== null) y += height + 4;
          }
        }
      } else if (question.type === "BENAR_SALAH") {
        doc.fillColor(INK).font("Helvetica").fontSize(10).text("( ) Benar     ( ) Salah", MARGIN + 16, y, { width: CONTENT_WIDTH - 16 });
        y = doc.y + 2;
      } else {
        const lines = question.type === "ESAI" ? 4 : 1;
        doc.fillColor(MUTED).font("Helvetica").fontSize(10);
        for (let line = 0; line < lines; line += 1) {
          y = ensureSpace(doc, y, 18);
          doc.text(".".repeat(96), MARGIN + 16, y, { width: CONTENT_WIDTH - 16 });
          y = doc.y + 2;
        }
      }

      y += 8;
    }

    y += 4;
  }

  if (options.withKey) {
    doc.addPage();
    let keyY = MARGIN;
    doc.fillColor(accent).font("Helvetica-Bold").fontSize(14).text("Kunci Jawaban", MARGIN, keyY);
    keyY = doc.y + 8;
    let keyNumber = 0;
    for (const question of item.questions) {
      keyNumber += 1;
      const answer = question.type === "PILIHAN_GANDA" || question.type === "MULTI_SELECT"
        ? (question.correctLabels.join(", ") || "-")
        : (question.expectedAnswer || "-");
      keyY = ensureSpace(doc, keyY, 18);
      doc.fillColor(INK).font("Helvetica").fontSize(10).text(`${keyNumber}. ${answer}`, MARGIN, keyY, { width: CONTENT_WIDTH });
      keyY = doc.y + 2;
    }
  }

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.fillColor(MUTED).font("Helvetica").fontSize(8);
    doc.text("Dibuat oleh LIMO", MARGIN, doc.page.height - 34, { width: CONTENT_WIDTH, align: "left" });
    doc.text(`${index + 1} / ${range.count}`, MARGIN, doc.page.height - 34, { width: CONTENT_WIDTH, align: "right" });
  }

  doc.end();
  return finished;
}
