import "server-only";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors/application-error";
import { canAccessInvoice } from "@/server/policies/access-policy";
import { getSchoolSetting } from "@/server/services/settings-service";
import { getBrandLogoDataUrl } from "@/server/services/brand-media";
import { formatRupiah } from "@/lib/money";
import { LIMO_COLORS, LIMO_MEDIA_COLORS } from "@/lib/limo-brand";

const INK = LIMO_MEDIA_COLORS.text;
const MUTED = LIMO_MEDIA_COLORS.muted;
const PRIMARY = LIMO_MEDIA_COLORS.primary;
const PRIMARY_DARK = LIMO_MEDIA_COLORS.primaryDark;
const SUCCESS_TEXT = LIMO_MEDIA_COLORS.successText;

type ReceiptInput = {
  schoolName: string;
  studentName: string;
  studentNumber: string;
  programName: string;
  jenis: string;
  periodeLabel: string;
  subtotal: number;
  discount: number;
  amount: number;
  voucherCode: string | null;
  provider: string;
  paymentMethod: string | null;
  reference: string;
  paidAt: Date;
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}

export async function buildReceiptPdf(input: ReceiptInput) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const width = doc.page.width - 100;
  const pageWidth = doc.page.width;
  const logo = await getBrandLogoDataUrl();

  // ── Band header brand (selaras dengan invoice) ────────────────────
  doc.rect(0, 0, pageWidth, 108).fillColor(PRIMARY_DARK).fill();
  doc.save();
  doc.roundedRect(36, 17, 74, 74, 16).clip();
  doc.image(logo, 36, 17, { width: 74, height: 74 });
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(13).fillColor(LIMO_MEDIA_COLORS.white).text(input.schoolName.toUpperCase(), 126, 30, { width: 300 });
  doc.font("Helvetica").fontSize(9).fillColor(LIMO_COLORS.sky[200]).text("Bridging The World, Benefiting The Ummah", 126, 52, { width: 320 });
  doc.font("Helvetica-Bold").fontSize(16).fillColor(LIMO_MEDIA_COLORS.white).text("KUITANSI PEMBAYARAN", 60, 72, { width: pageWidth - 110, align: "right", lineBreak: false });

  // Meta kanan di bawah band
  const metaY = 126;
  doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(`Nomor: ${input.reference}`, 50, metaY, { width, align: "right" });
  doc.text(`Tanggal: ${formatDateTime(input.paidAt)}`, 50, metaY + 13, { width, align: "right" });

  // ── Kartu informasi penerima ─────────────────────────────────────
  let y = 178;
  const cardH = 124;
  doc.roundedRect(50, y, width, cardH, 10).fillColor(LIMO_MEDIA_COLORS.white).fill();
  doc.roundedRect(50, y, width, cardH, 10).lineWidth(1).strokeColor(LIMO_MEDIA_COLORS.border).stroke();

  const infoRow = (label: string, value: string, rowY: number, bold = false) => {
    doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(label, 66, rowY, { width: 140 });
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10.5).fillColor(INK).text(value, 214, rowY - 1, { width: width - 180 });
  };
  infoRow("Diterima dari", input.studentName, y + 16, true);
  infoRow("Nomor induk", input.studentNumber, y + 36);
  infoRow("Program", input.programName, y + 56);
  infoRow("Tagihan", `${input.jenis} / ${input.periodeLabel}`, y + 76);

  doc.roundedRect(214, y + 96, 130, 22, 11).fillColor(LIMO_MEDIA_COLORS.successPillBg).fill();
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(LIMO_MEDIA_COLORS.successText).text("LUNAS", 214, y + 102, { width: 130, align: "center" });

  // ── Rincian pembayaran ────────────────────────────────────────────
  y += cardH + 26;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("RINCIAN PEMBAYARAN", 50, y);
  y += 16;
  const detailRows: Array<[string, string]> = [[`Tagihan ${input.jenis} / ${input.periodeLabel}`, formatRupiah(input.subtotal)]];
  if (input.discount > 0) detailRows.push([`Diskon${input.voucherCode ? ` (${input.voucherCode})` : ""}`, `- ${formatRupiah(input.discount)}`]);
  const detailH = detailRows.length * 22 + 62;
  doc.roundedRect(50, y, width, detailH, 10).fillColor(LIMO_MEDIA_COLORS.white).fill();
  doc.roundedRect(50, y, width, detailH, 10).lineWidth(1).strokeColor(LIMO_MEDIA_COLORS.border).stroke();

  let rowY = y + 16;
  for (const [label, value] of detailRows) {
    doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(label, 66, rowY, { width: 300 });
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(INK).text(value, 50, rowY, { width: width - 32, align: "right" });
    rowY += 22;
  }
  const totalY = y + detailH - 50;
  doc.roundedRect(62, totalY, width - 24, 38, 8).fillColor(LIMO_MEDIA_COLORS.primarySoft).fill();
  doc.font("Helvetica-Bold").fontSize(11).fillColor(PRIMARY_DARK).text("TOTAL DIBAYAR", 78, totalY + 13, { width: 240 });
  doc.font("Helvetica-Bold").fontSize(14).fillColor(PRIMARY_DARK).text(formatRupiah(input.amount), 62, totalY + 12, { width: width - 56, align: "right" });

  // ── Panel pembayaran terverifikasi ────────────────────────────────
  y = totalY + 38 + 22;
  doc.roundedRect(50, y, width, 78, 10).fillColor(LIMO_MEDIA_COLORS.successTintBg).fill();
  doc.font("Helvetica-Bold").fontSize(11).fillColor(SUCCESS_TEXT).text("Pembayaran terverifikasi", 66, y + 12, { width });
  doc.font("Helvetica").fontSize(10).fillColor(INK).text(`Metode: ${input.provider.toUpperCase()}${input.paymentMethod ? ` / ${input.paymentMethod}` : ""}`, 66, y + 32, { width: width - 32 });
  doc.font("Helvetica").fontSize(10).fillColor(INK).text(`Referensi: ${input.reference}`, 66, y + 50, { width: width - 32 });

  // ── Footer brand ──────────────────────────────────────────────────
  // Jaga semua elemen footer di atas 791.89 (841.89 - margin 50) agar pdfkit tidak menambah halaman baru.
  const footerY = doc.page.height - 112;
  doc.rect(50, footerY, 120, 3).fillColor(PRIMARY).fill();
  doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(`Kuitansi ini dibuat otomatis oleh sistem ${input.schoolName} dan sah tanpa tanda tangan basah.`, 50, footerY + 12, { width: 330 });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(PRIMARY_DARK).text("limoedu.id", 50, footerY + 12, { width, align: "right" });
  doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(`${input.schoolName} / Admin Keuangan`, 50, footerY + 44, { width, align: "right" });

  doc.end();
  return done;
}

export async function getReceiptPdf(actor: Actor, tagihanId: string) {
  const allowed = actor.role === "ADMIN" || (await canAccessInvoice(actor, tagihanId));
  if (!allowed) {
    throw new ForbiddenError("Anda tidak memiliki akses ke tagihan ini");
  }

  const tagihan = await prisma.tagihan.findUnique({
    where: { id: tagihanId },
    select: {
      id: true,
      jenis: true,
      periode: true,
      amount: true,
      subtotal: true,
      discountAmount: true,
      status: true,
      siswa: { select: { name: true, nomorInduk: true, program: { select: { name: true } } } },
      voucher: { select: { code: true } },
      pembayaran: {
        where: { status: "PAID" },
        orderBy: { paidAt: "desc" },
        take: 1,
        select: { id: true, provider: true, providerReference: true, paymentMethod: true, paidAt: true },
      },
    },
  });

  if (!tagihan) {
    throw new NotFoundError("Tagihan tidak ditemukan");
  }

  const payment = tagihan.pembayaran[0];
  if (tagihan.status !== "PAID" || !payment) {
    throw new ConflictError("Kuitansi hanya tersedia untuk tagihan yang sudah lunas");
  }

  const subtotal = tagihan.subtotal === null ? Number(tagihan.amount) : Number(tagihan.subtotal);
  const discount = Number(tagihan.discountAmount);
  const periodeLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(tagihan.periode);
  const setting = await getSchoolSetting();

  const buffer = await buildReceiptPdf({
    schoolName: setting.name,
    studentName: tagihan.siswa.name,
    studentNumber: tagihan.siswa.nomorInduk,
    programName: tagihan.siswa.program.name,
    jenis: tagihan.jenis,
    periodeLabel,
    subtotal,
    discount,
    amount: Number(tagihan.amount),
    voucherCode: tagihan.voucher?.code ?? null,
    provider: payment.provider,
    paymentMethod: payment.paymentMethod,
    reference: payment.providerReference || tagihan.id,
    paidAt: payment.paidAt || new Date(),
  });

  return { buffer, filename: `kuitansi-${tagihan.id}.pdf` };
}
