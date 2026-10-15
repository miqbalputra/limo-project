import "server-only";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError } from "@/server/errors/application-error";
import { canAccessInvoice } from "@/server/policies/access-policy";
import { getSchoolSetting } from "@/server/services/settings-service";
import { getBrandLogoDataUrl } from "@/server/services/brand-media";
import { formatRupiah } from "@/lib/money";
import { formatUiLabel } from "@/lib/ui-labels";
import { LIMO_COLORS, LIMO_MEDIA_COLORS } from "@/lib/limo-brand";

const INK = LIMO_MEDIA_COLORS.text;
const MUTED = LIMO_MEDIA_COLORS.muted;
const PRIMARY = LIMO_MEDIA_COLORS.primary;
const PRIMARY_DARK = LIMO_MEDIA_COLORS.primaryDark;
const SUCCESS = LIMO_MEDIA_COLORS.successText;
const DANGER = LIMO_MEDIA_COLORS.dangerText;

export type InvoiceData = {
  id: string;
  schoolName: string;
  jenis: string;
  description: string | null;
  status: string;
  statusLabel: string;
  isPaid: boolean;
  periodeLabel: string;
  issuedAtLabel: string;
  dueDateLabel: string;
  paidAtLabel: string | null;
  studentName: string;
  studentNumber: string;
  programName: string;
  subtotal: number;
  discount: number;
  amount: number;
  voucherCode: string | null;
  paymentProvider: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}

export async function getInvoiceData(actor: Actor, tagihanId: string): Promise<InvoiceData> {
  const allowed = actor.role === "ADMIN" || (await canAccessInvoice(actor, tagihanId));
  if (!allowed) {
    throw new ForbiddenError("Anda tidak memiliki akses ke tagihan ini");
  }

  const setting = await getSchoolSetting();

  const tagihan = await prisma.tagihan.findUnique({
    where: { id: tagihanId },
    select: {
      id: true,
      jenis: true,
      periode: true,
      description: true,
      amount: true,
      subtotal: true,
      discountAmount: true,
      status: true,
      dueDate: true,
      createdAt: true,
      paidAt: true,
      siswa: { select: { name: true, nomorInduk: true, program: { select: { name: true } } } },
      voucher: { select: { code: true } },
      pembayaran: {
        where: { status: "PAID" },
        orderBy: { paidAt: "desc" },
        take: 1,
        select: { provider: true, providerReference: true, paymentMethod: true, paidAt: true },
      },
    },
  });

  if (!tagihan) {
    throw new NotFoundError("Tagihan tidak ditemukan");
  }

  const payment = tagihan.pembayaran[0];
  const isPaid = tagihan.status === "PAID";

  return {
    id: tagihan.id,
    schoolName: setting.name,
    jenis: tagihan.jenis,
    description: tagihan.description,
    status: tagihan.status,
    statusLabel: formatUiLabel(tagihan.status),
    isPaid,
    periodeLabel: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(tagihan.periode),
    issuedAtLabel: formatDate(tagihan.createdAt),
    dueDateLabel: formatDate(tagihan.dueDate),
    paidAtLabel: payment?.paidAt ? formatDateTime(payment.paidAt) : tagihan.paidAt ? formatDateTime(tagihan.paidAt) : null,
    studentName: tagihan.siswa.name,
    studentNumber: tagihan.siswa.nomorInduk,
    programName: tagihan.siswa.program.name,
    subtotal: tagihan.subtotal === null ? Number(tagihan.amount) : Number(tagihan.subtotal),
    discount: Number(tagihan.discountAmount),
    amount: Number(tagihan.amount),
    voucherCode: tagihan.voucher?.code ?? null,
    paymentProvider: payment?.provider ?? null,
    paymentMethod: payment?.paymentMethod ?? null,
    paymentReference: payment?.providerReference ?? null,
  };
}

export async function buildInvoicePdf(input: InvoiceData) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const width = doc.page.width - 100;
  const pageWidth = doc.page.width;

  // ── Band header brand ─────────────────────────────────────────────
  const logo = await getBrandLogoDataUrl();
  doc.rect(0, 0, pageWidth, 108).fillColor(PRIMARY_DARK).fill();
  doc.save();
  doc.roundedRect(36, 17, 74, 74, 16).clip();
  doc.image(logo, 36, 17, { width: 74, height: 74 });
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(13).fillColor(LIMO_MEDIA_COLORS.white).text(input.schoolName.toUpperCase(), 126, 30, { width: 300 });
  doc.font("Helvetica").fontSize(9).fillColor(LIMO_COLORS.sky[200]).text("Bridging The World, Benefiting The Ummah", 126, 52, { width: 320 });
  doc.font("Helvetica-Bold").fontSize(16).fillColor(LIMO_MEDIA_COLORS.white).text("INVOICE / TAGIHAN", 60, 72, { width: pageWidth - 110, align: "right", lineBreak: false });

  // Meta kanan di bawah band
  const metaY = 126;
  doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(`Nomor: ${input.id}`, 50, metaY, { width, align: "right" });
  doc.text(`Diterbitkan: ${input.issuedAtLabel}`, 50, metaY + 13, { width, align: "right" });
  doc.text(`Periode: ${input.periodeLabel}`, 50, metaY + 26, { width, align: "right" });

  // ── Kartu informasi tagihan ───────────────────────────────────────
  let y = 178;
  const cardH = 148;
  doc.roundedRect(50, y, width, cardH, 10).fillColor(LIMO_MEDIA_COLORS.white).fill();
  doc.roundedRect(50, y, width, cardH, 10).lineWidth(1).strokeColor(LIMO_MEDIA_COLORS.border).stroke();

  const infoRow = (label: string, value: string, rowY: number, bold = false, color = INK) => {
    doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(label, 66, rowY, { width: 140 });
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10.5).fillColor(color).text(value, 214, rowY - 1, { width: width - 180 });
  };
  infoRow("Ditagihkan kepada", input.studentName, y + 16, true);
  infoRow("Nomor induk", input.studentNumber, y + 36);
  infoRow("Program", input.programName, y + 56);
  infoRow("Jenis tagihan", input.jenis, y + 76);
  infoRow("Jatuh tempo", input.dueDateLabel, y + 96);

  const pillBg = input.isPaid ? LIMO_MEDIA_COLORS.successPillBg : LIMO_MEDIA_COLORS.dangerPillBg;
  const pillFg = input.isPaid ? SUCCESS : DANGER;
  doc.roundedRect(214, y + 116, 130, 22, 11).fillColor(pillBg).fill();
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(pillFg).text(input.statusLabel.toUpperCase(), 214, y + 122, { width: 130, align: "center" });

  // ── Rincian tagihan ───────────────────────────────────────────────
  y += cardH + 26;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("RINCIAN TAGIHAN", 50, y);
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
  doc.font("Helvetica-Bold").fontSize(11).fillColor(PRIMARY_DARK).text("TOTAL TAGIHAN", 78, totalY + 13, { width: 240 });
  doc.font("Helvetica-Bold").fontSize(14).fillColor(PRIMARY_DARK).text(formatRupiah(input.amount), 62, totalY + 12, { width: width - 56, align: "right" });

  // ── Panel pembayaran ──────────────────────────────────────────────
  y = totalY + 38 + 22;
  if (input.isPaid) {
    doc.roundedRect(50, y, width, 78, 10).fillColor(LIMO_MEDIA_COLORS.successTintBg).fill();
    doc.font("Helvetica-Bold").fontSize(11).fillColor(SUCCESS).text("Sudah dibayar", 66, y + 12, { width });
    let infoY = y + 32;
    if (input.paidAtLabel) {
      doc.font("Helvetica").fontSize(10).fillColor(INK).text(`Dibayar pada ${input.paidAtLabel}`, 66, infoY, { width });
      infoY += 15;
    }
    if (input.paymentProvider) {
      doc.font("Helvetica").fontSize(10).fillColor(INK).text(`Metode: ${input.paymentProvider.toUpperCase()}${input.paymentMethod ? ` / ${input.paymentMethod}` : ""}`, 66, infoY, { width });
    }
  } else {
    doc.roundedRect(50, y, width, 78, 10).fillColor(LIMO_MEDIA_COLORS.infoTintBg).fill();
    doc.font("Helvetica-Bold").fontSize(11).fillColor(PRIMARY).text("Cara pembayaran", 66, y + 12, { width });
    doc.font("Helvetica").fontSize(10).fillColor(INK).text("Buka halaman Tagihan di portal Wali LIMO, pilih tagihan ini, lalu lanjutkan pembayaran melalui kanal yang tersedia.", 66, y + 32, { width: width - 32 });
  }

  if (input.description) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text("Catatan", 50, y + 96, { width: 160 });
    doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(input.description, 210, y + 96, { width: width - 160 });
  }

  // ── Footer brand ──────────────────────────────────────────────────
  // Catatan: teks dengan y > page.height - margin bawah membuat pdfkit menambah halaman baru;
  // jaga semua elemen footer berada di atas 791.89 (841.89 - 50).
  const footerY = doc.page.height - 112;
  doc.rect(50, footerY, 120, 3).fillColor(PRIMARY).fill();
  doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(`Dokumen ini dibuat otomatis oleh sistem ${input.schoolName}. Status tagihan mengikuti data terakhir pada sistem.`, 50, footerY + 12, { width: 330 });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(PRIMARY_DARK).text("limoedu.id", 50, footerY + 12, { width, align: "right" });
  doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(`${input.schoolName} / Admin Keuangan`, 50, footerY + 44, { width, align: "right" });

  doc.end();
  return done;
}

export async function getInvoicePdf(actor: Actor, tagihanId: string) {
  const data = await getInvoiceData(actor, tagihanId);
  const buffer = await buildInvoicePdf(data);
  return { buffer, filename: `invoice-${data.id}.pdf` };
}
