import "server-only";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import ExcelJS from "exceljs";
import { formatRupiah } from "@/lib/money";
import type { getAdminReport } from "@/server/services/report-service";
import { LIMO_MEDIA_COLORS, toExcelArgb } from "@/lib/limo-brand";

type AdminReport = Awaited<ReturnType<typeof getAdminReport>>;

export async function createOperationalWorkbook(report: AdminReport) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LIMO";
  workbook.created = new Date();
  const periodLabel = `${report.period.fromValue} sampai ${report.period.toValue}`;
  const summaryRows = [
    ["LIMO - LAPORAN OPERASIONAL"],
    ["Periode", periodLabel],
    [],
    ["RINGKASAN", "NILAI"],
    ["Siswa aktif", report.summary.students],
    ["Kelas aktif", report.summary.classes],
    ["Kehadiran", report.summary.attendanceRate === null ? "-" : `${report.summary.attendanceRate}%`],
    ["Total presensi", report.summary.attendanceTotal],
    ["Rata-rata progres", report.summary.averageProgress ?? "-"],
    ["Rata-rata nilai", report.summary.averageScore ?? "-"],
    ["Invoice tercatat", report.summary.invoiceCount],
    ["Nilai invoice", report.summary.invoiceTotal],
    ["Sudah dibayar", report.summary.invoicePaid],
    ["Tagihan terbuka", report.summary.invoiceOpen],
  ];
  const classRows: (string | number)[][] = [
    ["KELAS", "PROGRAM", "LEVEL", "GURU", "SISWA AKTIF", "KEHADIRAN", "RATA-RATA PROGRES", "RATA-RATA NILAI"],
    ...report.classRows.map((row) => [row.name, row.program, row.level, row.guru, row.students, formatPercent(row.attendanceRate), row.averageProgress ?? "-", row.averageScore ?? "-"]),
  ];
  const studentRows: (string | number)[][] = [
    ["SISWA", "NOMOR INDUK", "PROGRAM", "KEHADIRAN", "TOTAL PRESENSI", "RATA-RATA PROGRES", "RATA-RATA NILAI", "TAGIHAN TERBUKA"],
    ...report.studentRows.map((row) => [row.name, row.nomorInduk, row.program, formatPercent(row.attendanceRate), row.attendanceTotal, row.averageProgress ?? "-", row.averageScore ?? "-", row.openInvoiceAmount]),
  ];
  const attentionRows: (string | number)[][] = [
    ["SISWA", "NOMOR INDUK", "PROGRAM", "KEHADIRAN", "PROGRES", "NILAI", "TAGIHAN TERBUKA"],
    ...report.studentRows.filter(isAttentionRow).map((row) => [row.name, row.nomorInduk, row.program, formatPercent(row.attendanceRate), row.averageProgress ?? "-", row.averageScore ?? "-", row.openInvoiceAmount]),
  ];

  const summarySheet = makeSheet(workbook, "Ringkasan", summaryRows, [28, 30], 4);
  makeSheet(workbook, "Per Kelas", classRows, [24, 20, 18, 24, 14, 14, 20, 18], 1);
  const studentSheet = makeSheet(workbook, "Per Siswa", studentRows, [28, 18, 20, 14, 16, 20, 18, 20], 1);
  const attentionSheet = makeSheet(workbook, "Perhatian", attentionRows, [28, 18, 20, 14, 18, 16, 20], 1);
  applyNumberFormat(summarySheet, 2, 12, 14, "#,##0");
  applyNumberFormat(studentSheet, 8, 2, studentSheet.rowCount, "#,##0");
  applyNumberFormat(attentionSheet, 7, 2, attentionSheet.rowCount, "#,##0");

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function createOperationalPdf(report: AdminReport) {
  const document = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, bufferPages: true, info: { Title: "Laporan Operasional LIMO", Author: "LIMO" } });
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  drawPdfHeader(document, report);
  let y = 142;
  const metrics = [
    { label: "Siswa aktif", value: String(report.summary.students), helper: "data peserta didik", tone: "blue" as const },
    { label: "Kehadiran", value: formatPercent(report.summary.attendanceRate), helper: `${report.summary.attendancePresent}/${report.summary.attendanceTotal} presensi`, tone: "green" as const },
    { label: "Nilai invoice", value: formatRupiah(report.summary.invoiceTotal), helper: `${report.summary.invoiceCount} invoice tercatat`, tone: "sky" as const },
    { label: "Tagihan terbuka", value: formatRupiah(report.summary.invoiceOpen), helper: "perlu ditindaklanjuti", tone: report.summary.invoiceOpen > 0 ? "warning" as const : "green" as const },
  ];
  const metricWidth = (document.page.width - document.page.margins.left - document.page.margins.right - 24) / 4;
  metrics.forEach((metric, index) => drawPdfMetric(document, document.page.margins.left + index * (metricWidth + 8), y, metricWidth, metric.label, metric.value, metric.helper, metric.tone));
  y += 92;
  y = drawPdfTable(document, y, { eyebrow: "01 / KEUANGAN", title: "Ringkasan keuangan", description: "Status nilai invoice pada periode laporan.", tone: "blue", emptyLabel: "Belum ada data tagihan pada periode ini." }, [{ label: "Indikator", width: 220 }, { label: "Nilai", width: 180, align: "right" }, { label: "Keterangan", width: 300 }], [
    ["Nilai invoice", formatRupiah(report.summary.invoiceTotal), `${report.summary.invoiceCount} invoice pada periode laporan`],
    ["Sudah dibayar", formatRupiah(report.summary.invoicePaid), "Invoice berstatus lunas"],
    ["Tagihan terbuka", formatRupiah(report.summary.invoiceOpen), "Belum dibayar, menunggu, atau lewat jatuh tempo"],
  ]);
  y = drawPdfTable(document, y, { eyebrow: "02 / AKADEMIK", title: "Ringkasan kelas", description: "Perbandingan kelas aktif pada periode yang dipilih.", tone: "blue", emptyLabel: "Belum ada kelas aktif pada periode ini." }, [{ label: "Kelas", width: 150 }, { label: "Program / Level", width: 180 }, { label: "Guru", width: 155 }, { label: "Siswa", width: 65, align: "right" }, { label: "Hadir", width: 75, align: "right" }, { label: "Progres", width: 75, align: "right" }, { label: "Nilai", width: 75, align: "right" }], report.classRows.map((row) => [row.name, `${row.program} / ${row.level}`, row.guru, String(row.students), formatPercent(row.attendanceRate), formatNumber(row.averageProgress), formatNumber(row.averageScore)]));
  y = drawPdfTable(document, y, { eyebrow: "03 / PRIORITAS", title: "Siswa yang perlu perhatian", description: "Siswa dengan kehadiran di bawah 75% atau tagihan terbuka.", tone: "warning", emptyLabel: "Tidak ada siswa yang memerlukan perhatian khusus." }, [{ label: "Siswa", width: 175 }, { label: "Nomor Induk", width: 110 }, { label: "Program", width: 130 }, { label: "Hadir", width: 75, align: "right" }, { label: "Progres", width: 75, align: "right" }, { label: "Nilai", width: 75, align: "right" }, { label: "Tagihan terbuka", width: 110, align: "right" }], report.studentRows.filter(isAttentionRow).map((row) => [row.name, row.nomorInduk, row.program, formatPercent(row.attendanceRate), formatNumber(row.averageProgress), formatNumber(row.averageScore), formatRupiah(row.openInvoiceAmount)]));
  drawPdfTable(document, y, { eyebrow: "04 / DETAIL", title: "Detail siswa", description: "Data lengkap siswa aktif dalam periode laporan.", tone: "neutral", emptyLabel: "Belum ada data siswa." }, [{ label: "Siswa", width: 175 }, { label: "Nomor Induk", width: 110 }, { label: "Program", width: 130 }, { label: "Hadir", width: 75, align: "right" }, { label: "Total presensi", width: 85, align: "right" }, { label: "Progres", width: 75, align: "right" }, { label: "Nilai", width: 75, align: "right" }], report.studentRows.map((row) => [row.name, row.nomorInduk, row.program, formatPercent(row.attendanceRate), String(row.attendanceTotal), formatNumber(row.averageProgress), formatNumber(row.averageScore)]));
  drawPdfFooters(document);
  document.end();
  return output;
}

function makeSheet(workbook: ExcelJS.Workbook, name: string, rows: (string | number)[][], widths: number[], headerRow: number) {
  const sheet = workbook.addWorksheet(name);
  rows.forEach((row) => sheet.addRow(row));
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.views = [{ state: "frozen", ySplit: headerRow }];
  sheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: sheet.rowCount, column: widths.length } };
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  const header = sheet.getRow(headerRow);
  header.font = { bold: true, color: { argb: toExcelArgb(LIMO_MEDIA_COLORS.white) } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toExcelArgb(LIMO_MEDIA_COLORS.primary) } };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 24;
  for (let rowIndex = headerRow + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
    if ((rowIndex - headerRow) % 2 === 0) {
      sheet.getRow(rowIndex).fill = { type: "pattern", pattern: "solid", fgColor: { argb: toExcelArgb(LIMO_MEDIA_COLORS.surface) } };
    }
  }
  if (name === "Ringkasan") {
    sheet.mergeCells("A1:B1");
    sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: toExcelArgb(LIMO_MEDIA_COLORS.text) } };
    sheet.getCell("A1").alignment = { vertical: "middle" };
    sheet.getRow(1).height = 28;
    sheet.getCell("A2").font = { bold: true, color: { argb: toExcelArgb(LIMO_MEDIA_COLORS.muted) } };
  }
  return sheet;
}

function applyNumberFormat(sheet: ExcelJS.Worksheet, column: number, fromRow: number, toRow: number, format: string) {
  for (let rowIndex = fromRow; rowIndex <= toRow; rowIndex += 1) {
    sheet.getRow(rowIndex).getCell(column).numFmt = format;
  }
}

function isAttentionRow(row: AdminReport["studentRows"][number]) {
  return (row.attendanceRate !== null && row.attendanceRate < 75) || row.openInvoiceAmount > 0;
}

function formatPercent(value: number | null) {
  return value === null ? "-" : `${value}%`;
}

function formatNumber(value: number | null) {
  return value === null ? "-" : String(value);
}

type PdfTone = "blue" | "green" | "sky" | "warning" | "neutral";
type PdfColumn = { label: string; width: number; align?: "left" | "right" };
type PdfSection = { eyebrow: string; title: string; description: string; tone: PdfTone; emptyLabel: string };

function drawPdfHeader(document: PDFKit.PDFDocument, report: AdminReport) {
  const left = document.page.margins.left;
  const right = document.page.width - document.page.margins.right;
  document.rect(0, 0, document.page.width, 8).fillColor(LIMO_MEDIA_COLORS.surfaceMuted).fill();
  document.roundedRect(left, 38, 42, 42, 10).fillColor(LIMO_MEDIA_COLORS.primary).fill();
  document.fillColor(LIMO_MEDIA_COLORS.white).font("Helvetica-Bold").fontSize(20).text("L", left + 14, 48);
  document.fillColor(LIMO_MEDIA_COLORS.text).font("Helvetica-Bold").fontSize(17).text("LIMO", left + 54, 40);
  document.fillColor(LIMO_MEDIA_COLORS.muted).font("Helvetica").fontSize(8).text("LANGUAGE CLUB / OPERASIONAL", left + 55, 61);
  document.fillColor(LIMO_MEDIA_COLORS.text).font("Helvetica-Bold").fontSize(24).text("Laporan operasional", left, 93);
  document.fillColor(LIMO_MEDIA_COLORS.muted).font("Helvetica").fontSize(9).text("Ringkasan performa akademik dan keuangan untuk pengambilan keputusan Admin.", left, 122, { width: 440 });
  document.roundedRect(right - 220, 42, 220, 55, 10).fillColor(LIMO_MEDIA_COLORS.surface).fill();
  document.roundedRect(right - 220, 42, 220, 55, 10).lineWidth(0.8).strokeColor(LIMO_MEDIA_COLORS.border).stroke();
  document.fillColor(LIMO_MEDIA_COLORS.muted).font("Helvetica-Bold").fontSize(8).text("PERIODE LAPORAN", right - 204, 55);
  document.fillColor(LIMO_MEDIA_COLORS.text).font("Helvetica-Bold").fontSize(12).text(`${report.period.fromValue} - ${report.period.toValue}`, right - 204, 72, { width: 194 });
  document.fillColor(LIMO_MEDIA_COLORS.muted).font("Helvetica").fontSize(8).text("Dibuat otomatis oleh LIMO", right - 204, 88);
  document.moveTo(left, 132).lineTo(right, 132).lineWidth(0.8).strokeColor(LIMO_MEDIA_COLORS.border).stroke();
}

function drawPdfMetric(document: PDFKit.PDFDocument, x: number, y: number, width: number, label: string, value: string, helper: string, tone: PdfTone) {
  const colors = { blue: LIMO_MEDIA_COLORS.primary, green: LIMO_MEDIA_COLORS.success, sky: LIMO_MEDIA_COLORS.sky, warning: LIMO_MEDIA_COLORS.warningText, neutral: LIMO_MEDIA_COLORS.mutedLight };
  document.roundedRect(x, y, width, 70, 9).fillColor(LIMO_MEDIA_COLORS.white).fill();
  document.roundedRect(x, y, width, 70, 9).lineWidth(0.8).strokeColor(LIMO_MEDIA_COLORS.border).stroke();
  document.circle(x + width - 18, y + 17, 3).fillColor(colors[tone]).fill();
  document.fillColor(LIMO_MEDIA_COLORS.muted).font("Helvetica-Bold").fontSize(7.5).text(label.toUpperCase(), x + 15, y + 12, { width: width - 35 });
  document.fillColor(LIMO_MEDIA_COLORS.text).font("Helvetica-Bold").fontSize(value.length > 17 ? 12 : 16).text(value, x + 15, y + 29, { width: width - 25, ellipsis: true });
  document.fillColor(LIMO_MEDIA_COLORS.mutedLight).font("Helvetica").fontSize(7.5).text(helper, x + 15, y + 53, { width: width - 25, ellipsis: true });
}

function drawPdfTable(document: PDFKit.PDFDocument, initialY: number, section: PdfSection, columns: PdfColumn[], rows: string[][]) {
  const totalWidth = document.page.width - document.page.margins.left - document.page.margins.right;
  const scale = totalWidth / columns.reduce((sum, column) => sum + column.width, 0);
  const scaledColumns = columns.map((column) => ({ ...column, width: column.width * scale }));
  let y = ensurePdfSpace(document, initialY, 100, section.title);
  y = drawPdfSectionHeading(document, y, section);

  const rowHeight = 23;
  const drawHeader = () => {
    let x = document.page.margins.left;
    const tableTheme = getPdfTableTheme(section.tone);
    document.rect(document.page.margins.left, y, totalWidth, rowHeight).fillColor(tableTheme.headerFill).fill();
    scaledColumns.forEach((column) => {
      document.fillColor(tableTheme.headerText).font("Helvetica-Bold").fontSize(7.5).text(column.label, x + 6, y + 7, { width: column.width - 12, lineBreak: false, ellipsis: true, align: column.align ?? "left" });
      x += column.width;
    });
    y += rowHeight;
  };
  drawHeader();
  const tableRows = rows.length > 0 ? rows : [[section.emptyLabel]];
  tableRows.forEach((row, rowIndex) => {
    if (y + rowHeight > document.page.height - document.page.margins.bottom) {
      document.addPage({ size: "A4", layout: "landscape", margin: 36 });
      drawPdfContinuationHeader(document, `${section.title} / lanjutan`);
      y = 74;
      drawHeader();
    }
    let x = document.page.margins.left;
    if (rowIndex % 2 === 0) document.rect(document.page.margins.left, y, totalWidth, rowHeight).fillColor(LIMO_MEDIA_COLORS.surface).fill();
    scaledColumns.forEach((column, columnIndex) => {
      const cell = row[columnIndex] ?? (columnIndex === 0 ? section.emptyLabel : "");
      document.fillColor(columnIndex === 0 && rows.length === 0 ? LIMO_MEDIA_COLORS.muted : LIMO_MEDIA_COLORS.text).font("Helvetica").fontSize(7.5).text(String(cell), x + 6, y + 7, { width: column.width - 12, lineBreak: false, ellipsis: true, align: column.align ?? "left" });
      x += column.width;
    });
    document.moveTo(document.page.margins.left, y + rowHeight).lineTo(document.page.margins.left + totalWidth, y + rowHeight).strokeColor(LIMO_MEDIA_COLORS.border).stroke();
    y += rowHeight;
  });
  return y + 20;
}

function drawPdfSectionHeading(document: PDFKit.PDFDocument, y: number, section: PdfSection) {
  const left = document.page.margins.left;
  const right = document.page.width - document.page.margins.right;
  document.fillColor(LIMO_MEDIA_COLORS.mutedLight).font("Helvetica-Bold").fontSize(7.5).text(section.eyebrow, left, y + 2);
  document.fillColor(LIMO_MEDIA_COLORS.text).font("Helvetica-Bold").fontSize(12).text(section.title, left, y + 13);
  document.fillColor(LIMO_MEDIA_COLORS.muted).font("Helvetica").fontSize(8).text(section.description, document.page.margins.left + 210, y + 14, { width: document.page.width - document.page.margins.left - document.page.margins.right - 210, ellipsis: true });
  document.moveTo(left, y + 35).lineTo(right, y + 35).lineWidth(0.6).strokeColor(LIMO_MEDIA_COLORS.border).stroke();
  return y + 38;
}

function getPdfTableTheme(tone: PdfTone) {
  if (tone === "warning") return { headerFill: LIMO_MEDIA_COLORS.warning, headerText: LIMO_MEDIA_COLORS.warningText };
  if (tone === "neutral") return { headerFill: LIMO_MEDIA_COLORS.surface, headerText: LIMO_MEDIA_COLORS.muted };
  return { headerFill: LIMO_MEDIA_COLORS.primarySoft, headerText: LIMO_MEDIA_COLORS.text };
}

function drawPdfContinuationHeader(document: PDFKit.PDFDocument, title: string) {
  document.rect(0, 0, document.page.width, 26).fillColor(LIMO_MEDIA_COLORS.primaryDark).fill();
  document.fillColor(LIMO_MEDIA_COLORS.white).font("Helvetica-Bold").fontSize(9).text("LIMO", document.page.margins.left, 9);
  document.fillColor(LIMO_MEDIA_COLORS.primarySoft).font("Helvetica").fontSize(8).text(title, document.page.width - document.page.margins.right - 260, 9, { width: 260, align: "right" });
}

function drawPdfFooters(document: PDFKit.PDFDocument) {
  const range = document.bufferedPageRange();
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    document.switchToPage(pageIndex);
    const y = document.page.height - 28;
    document.moveTo(document.page.margins.left, y - 8).lineTo(document.page.width - document.page.margins.right, y - 8).lineWidth(0.6).strokeColor(LIMO_MEDIA_COLORS.border).stroke();
    document.fillColor(LIMO_MEDIA_COLORS.mutedLight).font("Helvetica").fontSize(7.5).text("LIMO / Laporan Operasional", document.page.margins.left, y, { width: 220 });
    document.text(`Halaman ${pageIndex - range.start + 1} dari ${range.count}`, document.page.width - document.page.margins.right - 120, y, { width: 120, align: "right" });
  }
}

function ensurePdfSpace(document: PDFKit.PDFDocument, y: number, needed: number, title: string) {
  if (y + needed <= document.page.height - document.page.margins.bottom) return y;
  document.addPage({ size: "A4", layout: "landscape", margin: 36 });
  drawPdfContinuationHeader(document, title);
  return 74;
}
