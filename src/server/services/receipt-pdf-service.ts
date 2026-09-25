import "server-only";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors/application-error";
import { canAccessInvoice } from "@/server/policies/access-policy";
import { formatRupiah } from "@/lib/money";

const INK = "#101828";
const MUTED = "#667085";
const ACCENT = "#2372B8";

type ReceiptInput = {
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

  doc.font("Helvetica-Bold").fontSize(12).fillColor(MUTED).text("LITTLE MOSLEMS ACADEMY", { width, align: "left" });
  doc.font("Helvetica-Bold").fontSize(24).fillColor(INK).text("KUITANSI PEMBAYARAN", { width });
  doc.moveTo(50, 118).lineTo(50 + width, 118).lineWidth(1).strokeColor(ACCENT).stroke();

  doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(`Nomor: ${input.reference}`, 50, 132, { width, align: "right" });
  doc.text(`Tanggal: ${formatDateTime(input.paidAt)}`, 50, 146, { width, align: "right" });

  let y = 176;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Diterima dari", 50, y, { width: 160 });
  doc.font("Helvetica").fontSize(11).fillColor(INK).text(input.studentName, 210, y, { width: width - 160 });
  y += 18;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Nomor induk", 50, y, { width: 160 });
  doc.font("Helvetica").fontSize(11).fillColor(INK).text(`${input.studentNumber} / ${input.programName}`, 210, y, { width: width - 160 });

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
  writeRow("Total dibayar", formatRupiah(input.amount), true);

  y += 12;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Metode pembayaran", 50, y, { width: 170 });
  doc.font("Helvetica").fontSize(11).fillColor(INK).text(`${input.provider.toUpperCase()}${input.paymentMethod ? ` / ${input.paymentMethod}` : ""}`, 220, y, { width: width - 170 });
  y += 18;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Referensi", 50, y, { width: 170 });
  doc.font("Helvetica").fontSize(11).fillColor(INK).text(input.reference, 220, y, { width: width - 170 });

  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Kuitansi ini dibuat otomatis oleh sistem LIMO dan sah tanpa tanda tangan basah.", 50, doc.page.height - 110, { width });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text("LIMO / Admin Keuangan", 50, doc.page.height - 82, { width, align: "right" });

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

  const buffer = await buildReceiptPdf({
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
