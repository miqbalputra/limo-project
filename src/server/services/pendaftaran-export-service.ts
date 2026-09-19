import "server-only";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import ExcelJS from "exceljs";
import type { getPendaftaranDetail, getPendaftaranExportData, PendaftaranListFilters } from "@/server/services/pendaftaran-service";
import { LIMO_MEDIA_COLORS, toExcelArgb } from "@/lib/limo-brand";
import { formatDocumentationConsent, formatGender, formatParticipantType, formatProgramAnswers } from "@/lib/pendaftaran-program-forms";

type PendaftaranExportData = Awaited<ReturnType<typeof getPendaftaranExportData>>;
type PendaftaranDetailRecord = Awaited<ReturnType<typeof getPendaftaranDetail>>["pendaftaran"];

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
    "Tipe Peserta",
    "Calon Siswa",
    "Jenis Kelamin",
    "Tanggal Lahir",
    "Program",
    "Nama Wali",
    "Email Wali",
    "Telepon Wali",
    "Sekolah",
    "Kelas / Jenjang",
    "Status",
    "Waiting List",
    "Konsen Dokumentasi",
    "Jawaban Program",
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
      spreadsheetText(formatParticipantType(row.participantType)),
      spreadsheetText(row.studentName),
      spreadsheetText(formatGender(row.studentGender)),
      spreadsheetText(formatDate(row.studentBirthAt)),
      spreadsheetText(row.program.name),
      spreadsheetText(row.waliName),
      spreadsheetText(row.waliEmail),
      spreadsheetText(row.waliPhone),
      spreadsheetText(row.schoolName),
      spreadsheetText(row.gradeLevel),
      spreadsheetText(formatStatus(row.status)),
      spreadsheetText(row.isWaitingList ? "Ya" : "Tidak"),
      spreadsheetText(formatDocumentationConsent(row.documentationConsent)),
      spreadsheetText(formatProgramAnswers(row.program.kind, row.programAnswers).map((answer) => `${answer.label}: ${answer.value}`).join(" | ")),
      spreadsheetText(formatDateTime(row.submittedAt)),
      spreadsheetText(formatDateTime(row.reviewedAt)),
      spreadsheetText(row.rejectionReason),
      spreadsheetText(formatFiles(row.files)),
    ]);
  });

  const widths = [18, 12, 28, 14, 18, 22, 26, 32, 20, 24, 14, 18, 16, 28, 60, 22, 22, 42, 36];
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
    { label: "Kode", width: 72 },
    { label: "Tipe", width: 42 },
    { label: "Calon siswa", width: 100 },
    { label: "Lahir", width: 58 },
    { label: "Program", width: 64 },
    { label: "Wali / kontak", width: 128 },
    { label: "Dokumentasi", width: 66 },
    { label: "Status", width: 62 },
    { label: "Waiting", width: 44 },
    { label: "Dikirim", width: 72 },
    { label: "Lampiran", width: 90 },
    { label: "Catatan", width: 96 },
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
    formatParticipantType(row.participantType),
    row.studentName,
    formatDate(row.studentBirthAt),
    row.program.name,
    [row.waliName, row.waliEmail, row.waliPhone].filter(Boolean).join(" / "),
    formatDocumentationConsent(row.documentationConsent),
    formatStatus(row.status),
    row.isWaitingList ? "Ya" : "Tidak",
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

// --- Export per peserta (satu pendaftar) ---

function detailIdentityRows(pendaftaran: PendaftaranDetailRecord): Array<[string, string]> {
  const isChild = pendaftaran.participantType === "CHILD";
  const rows: Array<[string, string]> = [
    ["Nomor pendaftaran", pendaftaran.kode],
    ["Status", formatStatus(pendaftaran.status)],
    ["Waiting list", pendaftaran.isWaitingList ? "Ya" : "Tidak"],
    ["Pendaftaran untuk", formatParticipantType(pendaftaran.participantType)],
    [isChild ? "Nama lengkap anak" : "Nama lengkap", pendaftaran.studentName],
    ["Nama panggilan", pendaftaran.studentNickname || "-"],
    ["Jenis kelamin", formatGender(pendaftaran.studentGender)],
    ["Tanggal lahir", formatDate(pendaftaran.studentBirthAt)],
    ["Program", pendaftaran.program.name],
    [isChild ? "Nama orang tua / wali" : "Nama peserta", pendaftaran.waliName],
    ["Email", pendaftaran.waliEmail || "-"],
    [isChild ? "Nomor WhatsApp orang tua / wali" : "Nomor WhatsApp", pendaftaran.waliPhone || "-"],
    ["Alamat", pendaftaran.address || "-"],
  ];

  if (isChild) {
    rows.push(["Sekolah anak", pendaftaran.schoolName || "-"]);
    rows.push(["Kelas / jenjang", pendaftaran.gradeLevel || "-"]);
  }

  rows.push(["Dikirim", formatDateTime(pendaftaran.submittedAt)]);
  rows.push(["Ditinjau", formatDateTime(pendaftaran.reviewedAt)]);

  if (pendaftaran.rejectionReason) {
    rows.push(["Alasan penolakan", pendaftaran.rejectionReason]);
  }

  return rows;
}

function detailConsentRows(pendaftaran: PendaftaranDetailRecord): Array<[string, string]> {
  return [
    ["Data benar & dapat dipertanggungjawabkan", pendaftaran.consentDataTruth ? "Disetujui" : "Belum disetujui"],
    ["Penggunaan data untuk administrasi & pembelajaran", pendaftaran.consentDataUse ? "Disetujui" : "Belum disetujui"],
    ["Dihubungi via WhatsApp / telepon / email", pendaftaran.consentContact ? "Disetujui" : "Belum disetujui"],
    ["Persetujuan dokumentasi", formatDocumentationConsent(pendaftaran.documentationConsent)],
    ["Waktu persetujuan", formatDateTime(pendaftaran.consentAt)],
    ["Lampiran", formatFiles(pendaftaran.files)],
  ];
}

function detailHistoryRows(pendaftaran: PendaftaranDetailRecord): Array<[string, string]> {
  if (pendaftaran.histories.length === 0) {
    return [["Belum ada riwayat", "-"]];
  }

  return pendaftaran.histories.map((history) => [
    formatDateTime(history.createdAt),
    `${history.fromStatus ? formatStatus(history.fromStatus) : "Baru"} -> ${formatStatus(history.toStatus)}${history.reason ? ` (${history.reason})` : ""}`,
  ]);
}

type DetailWorkSheetSection = {
  title: string;
  headers?: [string, string];
  rows: Array<[string, string]>;
};

function writeDetailWorkSheet(sheet: ExcelJS.Worksheet, sections: DetailWorkSheetSection[]) {
  sheet.getColumn(1).width = 48;
  sheet.getColumn(2).width = 84;
  let rowIndex = 1;

  for (const section of sections) {
    const titleCell = sheet.getCell(rowIndex, 1);
    titleCell.value = section.title;
    titleCell.font = { bold: true, size: 13, color: { argb: toExcelArgb(LIMO_MEDIA_COLORS.primaryDark) } };
    sheet.mergeCells(rowIndex, 1, rowIndex, 2);
    rowIndex += 1;

    if (section.headers) {
      const headerCells = [sheet.getCell(rowIndex, 1), sheet.getCell(rowIndex, 2)];
      headerCells[0].value = section.headers[0];
      headerCells[1].value = section.headers[1];
      headerCells.forEach((cell) => {
        cell.font = { bold: true, color: { argb: toExcelArgb(LIMO_MEDIA_COLORS.white) } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toExcelArgb(LIMO_MEDIA_COLORS.primary) } };
      });
      rowIndex += 1;
    }

    for (const [label, value] of section.rows) {
      const labelCell = sheet.getCell(rowIndex, 1);
      labelCell.value = spreadsheetText(label);
      labelCell.font = { bold: true, color: { argb: toExcelArgb(LIMO_MEDIA_COLORS.text) } };

      const valueCell = sheet.getCell(rowIndex, 2);
      valueCell.value = spreadsheetText(value);
      valueCell.alignment = { wrapText: true, vertical: "top" };
      rowIndex += 1;
    }

    rowIndex += 1;
  }
}

export async function createPendaftaranDetailWorkbook(pendaftaran: PendaftaranDetailRecord) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LIMO";
  workbook.created = new Date();

  const dataSheet = workbook.addWorksheet("Data Peserta");
  writeDetailWorkSheet(dataSheet, [
    { title: `Pendaftaran ${pendaftaran.kode}`, headers: ["Field", "Nilai"], rows: detailIdentityRows(pendaftaran) },
  ]);

  const answers = formatProgramAnswers(pendaftaran.program.kind, pendaftaran.programAnswers);
  const answersSheet = workbook.addWorksheet("Jawaban Formulir");
  writeDetailWorkSheet(answersSheet, [
    {
      title: `Jawaban Formulir - ${pendaftaran.studentName}`,
      headers: ["Pertanyaan", "Jawaban"],
      rows: answers.length > 0 ? answers.map((answer) => [answer.label, answer.value] as [string, string]) : [["Belum ada jawaban formulir program", "-"]],
    },
  ]);

  const consentSheet = workbook.addWorksheet("Persetujuan & Riwayat");
  writeDetailWorkSheet(consentSheet, [
    { title: "Persetujuan", headers: ["Item", "Status"], rows: detailConsentRows(pendaftaran) },
    { title: "Riwayat Status", headers: ["Waktu", "Perubahan"], rows: detailHistoryRows(pendaftaran) },
  ]);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function pdfEnsureSpace(document: PDFKit.PDFDocument, y: number, needed: number) {
  if (y + needed <= document.page.height - 56) {
    return y;
  }

  document.addPage({ size: "A4", layout: "portrait", margin: 40 });
  return 54;
}

function drawDetailSectionTitle(document: PDFKit.PDFDocument, y: number, title: string) {
  const left = document.page.margins.left;
  const width = document.page.width - document.page.margins.left - document.page.margins.right;
  y = pdfEnsureSpace(document, y, 30);
  document.rect(left, y, width, 20).fillColor(LIMO_MEDIA_COLORS.primarySoft).fill();
  document.fillColor(LIMO_MEDIA_COLORS.text).font("Helvetica-Bold").fontSize(10).text(title, left + 6, y + 6, { width: width - 12 });
  return y + 28;
}

function drawDetailKeyValues(document: PDFKit.PDFDocument, y: number, rows: Array<[string, string]>) {
  const left = document.page.margins.left;
  const width = document.page.width - document.page.margins.left - document.page.margins.right;
  const labelWidth = 165;
  const valueWidth = width - labelWidth;

  for (const [label, value] of rows) {
    const text = value && value.length > 0 ? value : "-";
    const labelHeight = document.font("Helvetica-Bold").fontSize(8).heightOfString(label, { width: labelWidth - 8 });
    const valueHeight = document.font("Helvetica").fontSize(8).heightOfString(text, { width: valueWidth - 8 });
    const height = Math.max(labelHeight, valueHeight);

    y = pdfEnsureSpace(document, y, height + 6);
    document.fillColor(LIMO_MEDIA_COLORS.muted).font("Helvetica-Bold").fontSize(8).text(label, left, y, { width: labelWidth - 8 });
    document.fillColor(LIMO_MEDIA_COLORS.text).font("Helvetica").fontSize(8).text(text, left + labelWidth, y, { width: valueWidth - 8 });
    y += height + 5;
  }

  return y + 4;
}

function drawDetailPdfFooters(document: PDFKit.PDFDocument) {
  const range = document.bufferedPageRange();
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    document.switchToPage(pageIndex);
    const y = document.page.height - 27;
    document.moveTo(document.page.margins.left, y - 7).lineTo(document.page.width - document.page.margins.right, y - 7).lineWidth(0.5).strokeColor(LIMO_MEDIA_COLORS.border).stroke();
    document.fillColor(LIMO_MEDIA_COLORS.mutedLight).font("Helvetica").fontSize(7).text("LIMO / Pendaftaran", document.page.margins.left, y, { width: 220 });
    document.text(`Halaman ${pageIndex - range.start + 1} dari ${range.count}`, document.page.width - document.page.margins.right - 120, y, { width: 120, align: "right" });
  }
}

export async function createPendaftaranDetailPdf(pendaftaran: PendaftaranDetailRecord) {
  const document = new PDFDocument({
    size: "A4",
    layout: "portrait",
    margin: 40,
    bufferPages: true,
    info: { Title: `Pendaftaran ${pendaftaran.kode}`, Author: "LIMO" },
  });
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  const left = document.page.margins.left;
  const contentWidth = document.page.width - document.page.margins.left - document.page.margins.right;

  document.rect(0, 0, document.page.width, 7).fillColor(LIMO_MEDIA_COLORS.primary).fill();
  document.fillColor(LIMO_MEDIA_COLORS.primaryDark).font("Helvetica-Bold").fontSize(16).text("LIMO", left, 30);
  document.fillColor(LIMO_MEDIA_COLORS.text).font("Helvetica-Bold").fontSize(18).text("Formulir Pendaftaran Peserta", left, 54);
  document.fillColor(LIMO_MEDIA_COLORS.muted).font("Helvetica").fontSize(9).text(`${pendaftaran.kode} / ${formatStatus(pendaftaran.status)}${pendaftaran.isWaitingList ? " / Waiting list" : ""}`, left, 80, { width: contentWidth, ellipsis: true });
  document.moveTo(left, 98).lineTo(left + contentWidth, 98).lineWidth(0.7).strokeColor(LIMO_MEDIA_COLORS.border).stroke();

  let y = 112;
  y = drawDetailSectionTitle(document, y, "Data Peserta");
  y = drawDetailKeyValues(document, y, detailIdentityRows(pendaftaran));

  y = drawDetailSectionTitle(document, y, "Jawaban Formulir Program");
  const answers = formatProgramAnswers(pendaftaran.program.kind, pendaftaran.programAnswers);
  y = drawDetailKeyValues(document, y, answers.length > 0 ? answers.map((answer) => [answer.label, answer.value] as [string, string]) : [["Jawaban", "Belum ada jawaban formulir program"]]);

  y = drawDetailSectionTitle(document, y, "Persetujuan");
  y = drawDetailKeyValues(document, y, detailConsentRows(pendaftaran));

  y = drawDetailSectionTitle(document, y, "Riwayat Status");
  drawDetailKeyValues(document, y, detailHistoryRows(pendaftaran));

  drawDetailPdfFooters(document);
  document.end();
  return output;
}
