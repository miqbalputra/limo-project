import { ImageResponse } from "next/og";
import { requireActor } from "@/server/auth/session";
import { apiError } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getInvoiceData, type InvoiceData } from "@/server/services/invoice-pdf-service";
import { getBrandLogoDataUrl } from "@/server/services/brand-media";
import { formatRupiah } from "@/lib/money";
import { LIMO_COLORS, LIMO_MEDIA_COLORS } from "@/lib/limo-brand";

export const runtime = "nodejs";

const INK = LIMO_MEDIA_COLORS.text;
const MUTED = LIMO_MEDIA_COLORS.muted;
const PRIMARY = LIMO_MEDIA_COLORS.primary;
const PRIMARY_DARK = LIMO_MEDIA_COLORS.primaryDark;
const SKY_SOFT = LIMO_COLORS.sky[200];


function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", fontSize: 19, marginBottom: 14 }}>
      <div style={{ display: "flex", width: 250, flexShrink: 0, color: MUTED }}>{label}</div>
      <div style={{ display: "flex", flex: 1, color: INK, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, marginBottom: 14 }}>
      <div style={{ display: "flex", color: INK }}>{label}</div>
      <div style={{ display: "flex", color: INK, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

async function InvoiceImage({ data }: { data: InvoiceData }) {
  const logo = await getBrandLogoDataUrl();
  return (
    <div style={{ backgroundColor: LIMO_MEDIA_COLORS.white, color: INK, display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
      <div style={{ backgroundColor: PRIMARY_DARK, display: "flex", flexDirection: "row", alignItems: "center", padding: "36px 48px", width: "100%" }}>
        {/* next/og (Satori) tidak mendukung next/image — img biasa wajib di sini */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt="Logo LIMO"
          width={104}
          height={104}
          style={{ backgroundColor: LIMO_MEDIA_COLORS.white, borderRadius: 26, objectFit: "cover" }}
        />
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 30 }}>
          <div style={{ color: LIMO_MEDIA_COLORS.white, display: "flex", fontSize: 27, fontWeight: 700, letterSpacing: 2 }}>{data.schoolName.toUpperCase()}</div>
          <div style={{ color: SKY_SOFT, display: "flex", fontSize: 17, letterSpacing: 1, marginTop: 8 }}>Bridging The World, Benefiting The Ummah</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "40px 48px 36px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 48, fontWeight: 800 }}>INVOICE / TAGIHAN</div>
              <div style={{ color: MUTED, display: "flex", fontSize: 18, marginTop: 8 }}>Dokumen tagihan resmi program {data.programName}</div>
            </div>
            <div style={{ backgroundColor: data.isPaid ? LIMO_MEDIA_COLORS.successPillBg : LIMO_MEDIA_COLORS.dangerPillBg, borderRadius: 999, color: data.isPaid ? LIMO_MEDIA_COLORS.successText : LIMO_MEDIA_COLORS.dangerText, display: "flex", fontSize: 19, fontWeight: 700, paddingBottom: 8, paddingLeft: 22, paddingRight: 22, paddingTop: 8 }}>
              {data.statusLabel.toUpperCase()}
            </div>
          </div>
          <div style={{ backgroundColor: PRIMARY, display: "flex", height: 4, marginTop: 22, width: 180 }} />
        </div>

        <div style={{ border: `1px solid ${LIMO_MEDIA_COLORS.border}`, borderRadius: 20, display: "flex", flexDirection: "column", marginTop: 28, padding: 28 }}>
          <MetaRow label="Nomor invoice" value={data.id} />
          <MetaRow label="Diterbitkan" value={data.issuedAtLabel} />
          <MetaRow label="Periode" value={data.periodeLabel} />
          <MetaRow label="Ditagihkan kepada" value={data.studentName} />
          <MetaRow label="Nomor induk" value={data.studentNumber} />
          <MetaRow label="Program" value={data.programName} />
          <MetaRow label="Jenis tagihan" value={data.jenis} />
          <MetaRow label="Jatuh tempo" value={data.dueDateLabel} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
          <div style={{ color: MUTED, display: "flex", fontSize: 15, fontWeight: 700, letterSpacing: 3, marginBottom: 14 }}>RINCIAN TAGIHAN</div>
          <div style={{ border: `1px solid ${LIMO_MEDIA_COLORS.border}`, borderRadius: 20, display: "flex", flexDirection: "column", padding: 28 }}>
            <DetailRow label={`Tagihan ${data.jenis} / ${data.periodeLabel}`} value={formatRupiah(data.subtotal)} />
            {data.discount > 0 ? <DetailRow label={`Diskon${data.voucherCode ? ` (${data.voucherCode})` : ""}`} value={`- ${formatRupiah(data.discount)}`} /> : null}
            <div style={{ alignItems: "center", backgroundColor: LIMO_MEDIA_COLORS.primarySoft, borderRadius: 16, display: "flex", justifyContent: "space-between", marginTop: 6, padding: "20px 24px" }}>
              <div style={{ color: PRIMARY_DARK, display: "flex", fontSize: 22, fontWeight: 700 }}>TOTAL TAGIHAN</div>
              <div style={{ color: PRIMARY_DARK, display: "flex", fontSize: 30, fontWeight: 800 }}>{formatRupiah(data.amount)}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 26 }}>
          {data.isPaid ? (
            <div style={{ backgroundColor: LIMO_MEDIA_COLORS.successTintBg, borderRadius: 16, display: "flex", flexDirection: "column", padding: 20 }}>
              <div style={{ color: LIMO_MEDIA_COLORS.successText, display: "flex", fontSize: 22, fontWeight: 700 }}>Sudah dibayar</div>
              {data.paidAtLabel ? <div style={{ display: "flex", fontSize: 18, marginTop: 6 }}>Dibayar pada {data.paidAtLabel}</div> : null}
              {data.paymentProvider ? <div style={{ display: "flex", fontSize: 18, marginTop: 4 }}>Metode: {data.paymentProvider.toUpperCase()}{data.paymentMethod ? ` / ${data.paymentMethod}` : ""}</div> : null}
            </div>
          ) : (
            <div style={{ backgroundColor: LIMO_MEDIA_COLORS.infoTintBg, borderRadius: 16, display: "flex", flexDirection: "column", padding: 20 }}>
              <div style={{ color: PRIMARY, display: "flex", fontSize: 22, fontWeight: 700 }}>Cara pembayaran</div>
              <div style={{ display: "flex", fontSize: 18, lineHeight: 1.5, marginTop: 6 }}>
                Buka halaman Tagihan di portal Wali LIMO, pilih tagihan ini, lalu lanjutkan pembayaran melalui kanal yang tersedia.
              </div>
            </div>
          )}
        </div>

        {data.description ? <div style={{ color: MUTED, display: "flex", fontSize: 16, marginTop: 20 }}>Catatan: {data.description}</div> : null}

        <div style={{ borderTop: `1px solid ${LIMO_MEDIA_COLORS.border}`, display: "flex", justifyContent: "space-between", marginTop: "auto", paddingTop: 18 }}>
          <div style={{ color: MUTED, display: "flex", fontSize: 14, width: 620 }}>Dokumen ini dibuat otomatis oleh sistem {data.schoolName}. Status tagihan mengikuti data terakhir pada sistem.</div>
          <div style={{ color: PRIMARY_DARK, display: "flex", fontSize: 15, fontWeight: 700 }}>limoedu.id</div>
        </div>
      </div>
    </div>
  );
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const data = await getInvoiceData(actor, id);
    const image = new ImageResponse(await InvoiceImage({ data }), { width: 1000, height: 1414 });

    const headers = new Headers(image.headers);
    headers.set("Content-Disposition", `attachment; filename="invoice-${data.id}.png"`);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Request-Id", requestId);

    return new Response(image.body, { status: 200, headers });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

