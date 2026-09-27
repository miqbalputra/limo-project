import "server-only";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError } from "@/server/errors/application-error";
import { canAccessInvoice } from "@/server/policies/access-policy";
import { formatRupiah } from "@/lib/money";
import { formatUiLabel } from "@/lib/ui-labels";

const INK = "#101828";
const MUTED = "#667085";
const ACCENT = "#2372B8";
const SUCCESS = "#027A48";
const DANGER = "#B42318";

export type InvoiceData = {
  id: string;
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

  doc.font("Helvetica-Bold").fontSize(12).fillColor(MUTED).text("LITTLE MOSLEMS ACADEMY", { width, align: "left" });
  doc.font("Helvetica-Bold").fontSize(24).fillColor(INK).text("INVOICE / TAGIHAN", { width });
  doc.moveTo(50, 118).lineTo(50 + width, 118).lineWidth(1).strokeColor(ACCENT).stroke();

  doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(`Nomor: ${input.id}`, 50, 132, { width, align: "right" });
  doc.text(`Diterbitkan: ${input.issuedAtLabel}`, 50, 146, { width, align: "right" });
  doc.text(`Periode: ${input.periodeLabel}`, 50, 160, { width, align: "right" });

  let y = 190;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Ditagihkan kepada", 50, y, { width: 160 });
  doc.font("Helvetica").fontSize(11).fillColor(INK).text(input.studentName, 210, y, { width: width - 160 });
  y += 18;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Nomor induk", 50, y, { width: 160 });
  doc.font("Helvetica").fontSize(11).fillColor(INK).text(`${input.studentNumber} / ${input.programName}`, 210, y, { width: width - 160 });
  y += 18;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Status", 50, y, { width: 160 });
  doc.font("Helvetica-Bold").fontSize(11).fillColor(input.isPaid ? SUCCESS : DANGER).text(input.statusLabel.toUpperCase(), 210, y, { width: width - 160 });
  y += 18;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Jatuh tempo", 50, y, { width: 160 });
  doc.font("Helvetica").fontSize(11).fillColor(INK).text(input.dueDateLabel, 210, y, { width: width - 160 });

  y += 30;
  doc.rect(50, y, width, 24).fillColor("#F2F4F7").fill();
  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(10).text("Rincian", 58, y + 7, { width: 300 });
  doc.text("Nominal", 50, y + 7, { width: width + 42, align: "right" });
  y += 24;

  const writeRow = (label: string, value: string, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(11).fillColor(INK).text(label, 58, y + 8, { width: 300 });
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(11).fillColor(INK).text(value, 50, y + 8, { width: width + 42, align: "right" });
    y += 24;
    doc.moveTo(50, y).lineTo(50 + width, y).lineWidth(0.5).strokeColor("#EAECF0").stroke();
  };

  writeRow(`Tagihan ${input.jenis} / ${input.periodeLabel}`, formatRupiah(input.subtotal));
  if (input.discount > 0) writeRow(`Diskon${input.voucherCode ? ` (${input.voucherCode})` : ""}`, `- ${formatRupiah(input.discount)}`);
  writeRow("Total tagihan", formatRupiah(input.amount), true);

  y += 12;
  if (input.isPaid) {
    doc.font("Helvetica-Bold").fontSize(11).fillColor(SUCCESS).text("Sudah dibayar", 50, y, { width });
    y += 18;
    if (input.paidAtLabel) {
      doc.font("Helvetica").fontSize(11).fillColor(INK).text(`Dibayar pada ${input.paidAtLabel}`, 50, y, { width });
      y += 18;
    }
    if (input.paymentProvider) {
      doc.font("Helvetica").fontSize(11).fillColor(INK).text(`Metode: ${input.paymentProvider.toUpperCase()}${input.paymentMethod ? ` / ${input.paymentMethod}` : ""}`, 50, y, { width });
      y += 18;
    }
  } else {
    doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Cara pembayaran", 50, y, { width });
    y += 18;
    doc.font("Helvetica").fontSize(11).fillColor(INK).text("Buka halaman Tagihan pada portal Wali LIMO, lalu pilih tagihan ini dan lanjutkan pembayaran melalui kanal yang tersedia.", 50, y, { width });
    y += 34;
  }

  if (input.description) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text("Catatan", 50, y, { width: 160 });
    doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(input.description, 210, y, { width: width - 160 });
  }

  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Dokumen ini dibuat otomatis oleh sistem LIMO. Status tagihan mengikuti data terakhir pada sistem.", 50, doc.page.height - 110, { width });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text("LIMO / Admin Keuangan", 50, doc.page.height - 82, { width, align: "right" });

  doc.end();
  return done;
}

export async function getInvoicePdf(actor: Actor, tagihanId: string) {
  const data = await getInvoiceData(actor, tagihanId);
  const buffer = await buildInvoicePdf(data);
  return { buffer, filename: `invoice-${data.id}.pdf` };
}
