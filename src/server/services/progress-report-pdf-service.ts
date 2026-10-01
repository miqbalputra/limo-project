import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import bidiFactory from "bidi-js";
import { ArabicShaper } from "arabic-persian-reshaper";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { Actor } from "@/server/auth/session";
import { getProgressReport } from "@/server/services/progress-report-service";
import { getSchoolSetting } from "@/server/services/settings-service";

const INK = "#101828";
const MUTED = "#667085";
const ACCENT = "#2372B8";
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const bidi = bidiFactory();
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const REGULAR_FONT_PATH = path.join(FONT_DIR, "Amiri-Regular.ttf");
const hasArabicFont = existsSync(REGULAR_FONT_PATH);
const regularFontBuffer = hasArabicFont ? readFileSync(REGULAR_FONT_PATH) : null;

const REPORT_TYPE_LABEL: Record<string, string> = {
  WEEKLY: "Laporan Mingguan",
  MONTHLY: "Laporan Bulanan",
  LEVEL_COMPLETION: "Laporan Penyelesaian Level",
};

type ReportSnapshot = {
  attendance?: { total?: number; present?: number; rate?: number | null };
  progress?: { count?: number; average?: number | null };
  exams?: { count?: number; average?: number | null; items?: { title: string; score: number }[] };
  assignments?: { total?: number; graded?: number; late?: number };
  completion?: { required?: number; completed?: number; percentage?: number | null };
  finalGrade?: { score: number; letter: string | null } | null;
};

function hasArabic(value: string) {
  return ARABIC_RE.test(value);
}

function writeName(doc: PDFKit.PDFDocument, name: string) {
  if (hasArabic(name) && regularFontBuffer) {
    const shaped = ArabicShaper.convertArabic(name) as string;
    const embedding = bidi.getEmbeddingLevels(shaped, "auto");
    doc.font("amiri").fontSize(18).text(bidi.getReorderedString(shaped, embedding));
    return;
  }
  doc.font("Helvetica-Bold").fontSize(18).text(name);
}

function metricRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.font("Helvetica").fontSize(11).fillColor(MUTED).text(label, { continued: true, width: 260 });
  doc.font("Helvetica-Bold").fillColor(INK).text(value, { align: "right" });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

async function buildProgressReportPdf(input: {
  schoolName: string;
  studentName: string;
  nomorInduk: string;
  programName: string;
  className: string;
  levelName: string;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  summary: string;
  strengths: string;
  improvementAreas: string;
  teacherRecommendation: string;
  publishedAt: string | null;
  revisionReason: string | null;
  teacherName: string | null;
  snapshot: ReportSnapshot;
}) {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  if (regularFontBuffer) doc.registerFont("amiri", regularFontBuffer);

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const width = doc.page.width - 96;

  doc.font("Helvetica-Bold").fontSize(13).fillColor(MUTED).text(input.schoolName.toUpperCase(), { align: "center", width });
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(22).fillColor(INK).text("LAPORAN PERKEMBANGAN", { align: "center", width });
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(11).fillColor(MUTED).text(REPORT_TYPE_LABEL[input.reportType] ?? input.reportType, { align: "center", width });
  doc.moveDown(1);

  doc.moveTo(48, doc.y).lineTo(48 + width, doc.y).lineWidth(1).strokeColor(ACCENT).stroke();
  doc.moveDown(0.8);

  writeName(doc, input.studentName);
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(`Nomor induk: ${input.nomorInduk}`);
  doc.text(`Program: ${input.programName} / ${input.levelName}`);
  doc.text(`Kelas: ${input.className}`);
  doc.text(`Periode: ${formatDate(input.periodStart)} - ${formatDate(input.periodEnd)}`);
  doc.moveDown(1);

  doc.font("Helvetica-Bold").fontSize(13).fillColor(INK).text("Ringkasan Capaian");
  doc.moveDown(0.4);
  const snapshot = input.snapshot;
  metricRow(doc, "Kehadiran", snapshot.attendance?.rate != null ? `${snapshot.attendance.present}/${snapshot.attendance.total} pertemuan (${snapshot.attendance.rate}%)` : "Belum ada data");
  metricRow(doc, "Penyelesaian aktivitas wajib", snapshot.completion?.percentage != null ? `${snapshot.completion.completed}/${snapshot.completion.required} (${snapshot.completion.percentage}%)` : "Belum ada data");
  metricRow(doc, "Rata-rata pemahaman", snapshot.progress?.average != null ? `${snapshot.progress.average}/5` : "Belum ada data");
  metricRow(doc, "Rata-rata nilai ujian", snapshot.exams?.average != null ? `${snapshot.exams.average}` : "Belum ada data");
  metricRow(doc, "Tugas dikumpulkan / dinilai", `${snapshot.assignments?.total ?? 0} / ${snapshot.assignments?.graded ?? 0}`);
  metricRow(doc, "Nilai akhir", snapshot.finalGrade ? `${snapshot.finalGrade.score}${snapshot.finalGrade.letter ? ` (${snapshot.finalGrade.letter})` : ""}` : "Belum diterbitkan");
  doc.moveDown(1);

  const sections: Array<{ title: string; body: string }> = [
    { title: "Ringkasan", body: input.summary },
    { title: "Kelebihan", body: input.strengths },
    { title: "Hal yang perlu ditingkatkan", body: input.improvementAreas },
    { title: "Rekomendasi Guru", body: input.teacherRecommendation },
  ];
  for (const section of sections) {
    doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(section.title);
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(11).fillColor(INK).text(section.body?.trim() ? section.body : "-", { width, align: "left" });
    doc.moveDown(0.8);
  }

  if (snapshot.exams?.items?.length) {
    doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text("Daftar Nilai Ujian");
    doc.moveDown(0.3);
    for (const exam of snapshot.exams.items.slice(0, 12)) {
      doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(`${exam.title}`, { continued: true, width: 380 });
      doc.font("Helvetica-Bold").fillColor(INK).text(`${exam.score}`, { align: "right" });
    }
    doc.moveDown(0.8);
  }

  if (input.status === "REVISED" && input.revisionReason) {
    doc.font("Helvetica-Oblique").fontSize(10).fillColor(MUTED).text(`Revisi: ${input.revisionReason}`, { width });
    doc.moveDown(0.5);
  }

  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(
    `${input.publishedAt ? `Diterbitkan: ${formatDate(input.publishedAt)}` : "Draf (belum diterbitkan)"}${input.teacherName ? ` | Guru: ${input.teacherName}` : ""}`,
    { width },
  );

  doc.end();
  return done;
}

export async function getProgressReportPdf(actor: Actor, reportId: string) {
  const { item } = await getProgressReport(actor, reportId);
  const setting = await getSchoolSetting();

  const buffer = await buildProgressReportPdf({
    schoolName: setting.name,
    studentName: item.student.name,
    nomorInduk: item.student.nomorInduk,
    programName: item.kelas.program.name,
    className: item.kelas.name,
    levelName: item.kelas.level.name,
    reportType: item.reportType,
    periodStart: item.periodStart,
    periodEnd: item.periodEnd,
    status: item.status,
    summary: item.summary,
    strengths: item.strengths,
    improvementAreas: item.improvementAreas,
    teacherRecommendation: item.teacherRecommendation,
    publishedAt: item.publishedAt,
    revisionReason: item.revisionReason,
    teacherName: item.createdBy?.name ?? null,
    snapshot: (item.snapshotData ?? {}) as ReportSnapshot,
  });

  const filename = `laporan-${item.student.nomorInduk}-${item.periodEnd.slice(0, 10)}.pdf`;
  return { buffer, filename };
}
