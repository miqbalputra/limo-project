import "server-only";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import ExcelJS from "exceljs";
import type { getPendaftaranExportData, PendaftaranListFilters } from "@/server/services/pendaftaran-service";
import { LIMO_MEDIA_COLORS, toExcelArgb } from "@/lib/limo-brand";

type PendaftaranExportData = Awaited<ReturnType<typeof getPendaftaranExportData>>;

type PendaftaranExportInput = {
  data: PendaftaranExportData;
  filters: PendaftaranListFilters;
};

const statusLabels: Record<string, string> = {
  DRAFT: "Draf",
  SUBMITTED: "Baru masuk",
  UNDER_REVIEW: "Sedang ditinjau",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
};

export async function createPendaftaranWorkbook(input: PendaftaranExportInput) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LIMO";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Pendaftar");
  const headers = [
    "Kode",
    "Calon Siswa",
    "Tanggal Lahir",
    "Program",
    "Nama Wali",
    "Email Wali",
    "Telepon Wali",
    "Status",
    "Dikirim",
    "Ditinjau",
    "Alasan Penolakan",
    "Lampiran",
  ];
  const headerRow = 7;

  worksheet.addRow(["LIMO - DATA PENDAFTARAN CALON PESERTA DIDIK"]);
  worksheet.mergeCells(1, 1, 1, headers.length);
  worksheet.addRow(["Filter pencarian", spreadsheetText(input.filters.search || "Semua data")]);
  worksheet.addRow(["Filter status", spreadsheetText(formatStatus(input.filters.status))]);
  worksheet.addRow(["Jumlah data", input.data.items.length]);
  worksheet.addRow(["Catatan", spreadsheetText(input.data.truncated ? "Data dibatasi oleh batas ekspor maksimum." : "")]);
  worksheet.addRow([]);
  worksheet.addRow(headers);

  input.data.items.forEach((row) => {
    worksheet.addRow([
      spreadsheetText(row.kode),
      spreadsheetText(row.studentName),
      spreadsheetText(formatDate(row.studentBirthAt)),
      spreadsheetText(row.program.name),
      spreadsheetText(row.waliName),
      spreadsheetText(row.waliEmail),
      spreadsheetText(row.waliPhone),
      spreadsheetText(formatStatus(row.status)),
      spreadsheetText(formatDateTime(row.submittedAt)),
      spreadsheetText(formatDateTime(row.reviewedAt)),
      spreadsheetText(row.rejectionReason),
      spreadsheetText(formatFiles(row.files)),
    ]);
  });

  const widths = [18, 28, 18, 22, 26, 32, 20, 18, 22, 22, 42, 36];
  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
  worksheet.views = [{ state: "frozen", ySplit: headerRow }];
  worksheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: worksheet.rowCount, column: headers.length } };
  worksheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

  const title = worksheet.getCell("A1");
  title.font = { bold: true, size: 16, color: { argb: toExcelArgb(LIMO_MEDIA_COLORS.text) } };
  title.alignment = { vertical: "middle" };
  worksheet.getRow(1).height = 28;

  const header = worksheet.getRow(headerRow);
  header.font = { bold: true, color: { argb: toExcelArgb(LIMO_MEDIA_COLORS.white) } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toExcelArgb(LIMO_MEDIA_COLORS.primary) } };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 24;
  for (let rowIndex = headerRow + 1; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    if ((rowIndex - headerRow) % 2 === 0) {
      worksheet.getRow(rowIndex).fill = { type: "pattern", pattern: "solid", fgColor: { argb: toExcelArgb(LIMO_MEDIA_COLORS.surface) } };
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function createPendaftaranPdf(input: PendaftaranExportInput) {
  const document = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 30,
    bufferPages: true,
    info: { Title: "Data Pendaftaran Calon Peserta Didik LIMO", Author: "LIMO" },
  });
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  const columns = [
    { label: "Kode", width: 78 },
    { label: "Calon siswa", width: 120 },
    { label: "Lahir", width: 64 },
    { label: "Program", width: 72 },
    { label: "Wali / kontak", width: 155 },
    { label: "Status", width: 72 },
    { label: "Dikirim", width: 80 },
    { label: "Lampiran", width: 100 },
    { label: "Catatan", width: 110 },
  ];
  const scaledColumns = scalePdfColumns(document, columns);
  const rows = input.data.items.map(toPdfRow);

  drawPdfHeader(document, input, rows.length);
  let y = 124;
  y = drawPdfTableHeader(document, y, scaledColumns);

  const tableRows = rows.length > 0 ? rows : [["Belum ada pendaftar yang sesuai dengan filter."]];
  tableRows.forEach((row, rowIndex) => {
    if (y + 24 > document.page.height - 42) {
      document.addPage({ size: "A4", layout: "landscape", margin: 30 });
      drawPdfContinuationHeader(document);
      y = 54;
      y = drawPdfTableHeader(document, y, scaledColumns);
    }

    let x = document.page.margins.left;
    if (rowIndex % 2 === 0) {
      document.rect(document.page.margins.left, y, document.page.width - document.page.margins.left - document.page.margins.right, 24).fillColor(LIMO_MEDIA_COLORS.surface).fill();
    }
    scaledColumns.forEach((column, columnIndex) => {
      const value = row[columnIndex] ?? "";
      document
        .fillColor(rows.length === 0 ? LIMO_MEDIA_COLORS.muted : LIMO_MEDIA_COLORS.text)
        .font("Helvetica")
        .fontSize(6.5)
        .text(truncate(value, 42), x + 4, y + 8, { width: column.width - 8, lineBreak: false, ellipsis: true });
      x += column.width;
    });
    document.moveTo(document.page.margins.left, y + 24).lineTo(document.page.width - document.page.margins.right, y + 24).lineWidth(0.4).strokeColor(LIMO_MEDIA_COLORS.border).stroke();
    y += 24;
  });

  if (input.data.truncated) {
    if (y + 24 > document.page.height - 42) {
      document.addPage({ size: "A4", layout: "landscape", margin: 30 });
      drawPdfContinuationHeader(document);
      y = 54;
    }
    document.fillColor(LIMO_MEDIA_COLORS.warningText).font("Helvetica-Bold").fontSize(7).text("Catatan: data dibatasi oleh batas ekspor maksimum.", document.page.margins.left, y + 10);
  }

  drawPdfFooters(document);
  document.end();
  return output;
}

function buildPdfFilterLabel(filters: PendaftaranListFilters) {
  const search = filters.search ? `Pencarian: ${filters.search}` : "Pencarian: semua";
  const status = `Status: ${formatStatus(filters.status)}`;
  return `${search} / ${status}`;
}

function drawPdfHeader(document: PDFKit.PDFDocument, input: PendaftaranExportInput, rowCount: number) {
  const left = document.page.margins.left;
  const right = document.page.width - document.page.margins.right;
  document.rect(0, 0, document.page.width, 7).fillColor(LIMO_MEDIA_COLORS.primary).fill();
  document.fillColor(LIMO_MEDIA_COLORS.primaryDark).font("Helvetica-Bold").fontSize(16).text("LIMO", left, 28);
  document.fillColor(LIMO_MEDIA_COLORS.text).font("Helvetica-Bold").fontSize(20).text("Data pendaftaran calon peserta didik", left, 54);
  document.fillColor(LIMO_MEDIA_COLORS.muted).font("Helvetica").fontSize(8).text(buildPdfFilterLabel(input.filters), left, 84, { width: 560, ellipsis: true });
  document.fillColor(LIMO_MEDIA_COLORS.muted).font("Helvetica").fontSize(8).text(`${rowCount} data / dibuat otomatis oleh LIMO`, right - 210, 84, { width: 210, align: "right" });
  document.moveTo(left, 108).lineTo(right, 108).lineWidth(0.7).strokeColor(LIMO_MEDIA_COLORS.border).stroke();
}

function drawPdfContinuationHeader(document: PDFKit.PDFDocument) {
  document.rect(0, 0, document.page.width, 25).fillColor(LIMO_MEDIA_COLORS.primaryDark).fill();
  document.fillColor(LIMO_MEDIA_COLORS.white).font("Helvetica-Bold").fontSize(9).text("LIMO / Data pendaftaran", document.page.margins.left, 9);
}

function drawPdfTableHeader(document: PDFKit.PDFDocument, y: number, columns: Array<{ label: string; width: number }>) {
  let x = document.page.margins.left;
  const height = 24;
  const totalWidth = document.page.width - document.page.margins.left - document.page.margins.right;
  document.rect(document.page.margins.left, y, totalWidth, height).fillColor(LIMO_MEDIA_COLORS.primarySoft).fill();
  columns.forEach((column) => {
    document.fillColor(LIMO_MEDIA_COLORS.text).font("Helvetica-Bold").fontSize(6.5).text(column.label, x + 4, y + 8, { width: column.width - 8, lineBreak: false, ellipsis: true });
    x += column.width;
  });
  return y + height;
}

function drawPdfFooters(document: PDFKit.PDFDocument) {
  const range = document.bufferedPageRange();
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    document.switchToPage(pageIndex);
    const y = document.page.height - 27;
    document.moveTo(document.page.margins.left, y - 7).lineTo(document.page.width - document.page.margins.right, y - 7).lineWidth(0.5).strokeColor(LIMO_MEDIA_COLORS.border).stroke();
    document.fillColor(LIMO_MEDIA_COLORS.mutedLight).font("Helvetica").fontSize(7).text("LIMO / Pendaftaran", document.page.margins.left, y, { width: 220 });
    document.text(`Halaman ${pageIndex - range.start + 1} dari ${range.count}`, document.page.width - document.page.margins.right - 120, y, { width: 120, align: "right" });
  }
}

function scalePdfColumns(document: PDFKit.PDFDocument, columns: Array<{ label: string; width: number }>) {
  const availableWidth = document.page.width - document.page.margins.left - document.page.margins.right;
  const scale = availableWidth / columns.reduce((sum, column) => sum + column.width, 0);
  return columns.map((column) => ({ ...column, width: column.width * scale }));
}

function toPdfRow(row: PendaftaranExportData["items"][number]) {
  return [
    row.kode,
    row.studentName,
    formatDate(row.studentBirthAt),
    row.program.name,
    [row.waliName, row.waliEmail, row.waliPhone].filter(Boolean).join(" / "),
    formatStatus(row.status),
    formatDateTime(row.submittedAt),
    formatFiles(row.files),
    row.rejectionReason || "-",
  ];
}

function formatStatus(value: string | null | undefined) {
  return value ? statusLabels[value] || value : "Semua status";
}

function formatFiles(files: Array<{ originalName: string }>) {
  return files.length > 0 ? files.map((file) => file.originalName).join(", ") : "Tidak ada";
}

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(value) : "-";
}

function formatDateTime(value: Date | null) {
  return value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value) : "-";
}

function spreadsheetText(value: string | null | undefined) {
  const raw = value ?? "";
  return /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}
