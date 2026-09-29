import { ImageResponse } from "next/og";
import { requireActor } from "@/server/auth/session";
import { apiError } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getInvoiceData, type InvoiceData } from "@/server/services/invoice-pdf-service";
import { formatRupiah } from "@/lib/money";

export const runtime = "nodejs";

const INK = "#101828";
const MUTED = "#667085";
const ACCENT = "#2372B8";
const SUCCESS = "#027A48";
const DANGER = "#B42318";

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", fontSize: 20, marginBottom: 8 }}>
      <div style={{ display: "flex", width: 220, color: MUTED }}>{label}</div>
      <div style={{ display: "flex", flex: 1, color: INK, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function AmountRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", borderTop: "1px solid #EAECF0", paddingTop: 12, paddingBottom: 12 }}>
      <div style={{ display: "flex", flex: 1, fontSize: bold ? 24 : 20, fontWeight: bold ? 700 : 400, color: INK }}>{label}</div>
      <div style={{ display: "flex", fontSize: bold ? 24 : 20, fontWeight: bold ? 700 : 400, color: INK }}>{value}</div>
    </div>
  );
}

function InvoiceImage({ data }: { data: InvoiceData }) {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: INK, display: "flex", flexDirection: "column", height: "100%", padding: 64, width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ color: MUTED, display: "flex", fontSize: 20, fontWeight: 700, letterSpacing: 3 }}>{data.schoolName.toUpperCase()}</div>
        <div style={{ display: "flex", fontSize: 52, fontWeight: 800, marginTop: 8 }}>INVOICE / TAGIHAN</div>
      </div>
      <div style={{ backgroundColor: ACCENT, display: "flex", height: 2, marginBottom: 24, marginTop: 20, width: "100%" }} />

      <div style={{ alignItems: "flex-end", display: "flex", flexDirection: "column", fontSize: 18, color: MUTED }}>
        <div style={{ display: "flex" }}>Nomor: {data.id}</div>
        <div style={{ display: "flex" }}>Diterbitkan: {data.issuedAtLabel}</div>
        <div style={{ display: "flex" }}>Periode: {data.periodeLabel}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 32 }}>
        <MetaRow label="Ditagihkan kepada" value={data.studentName} />
        <MetaRow label="Nomor induk / program" value={`${data.studentNumber} / ${data.programName}`} />
        <MetaRow label="Jenis tagihan" value={data.jenis} />
        <MetaRow label="Jatuh tempo" value={data.dueDateLabel} />
        <div style={{ alignItems: "center", display: "flex", fontSize: 20, marginBottom: 8 }}>
          <div style={{ display: "flex", width: 220, color: MUTED }}>Status</div>
          <div style={{ backgroundColor: data.isPaid ? "#D1FADF" : "#FEE4E2", borderRadius: 999, color: data.isPaid ? SUCCESS : DANGER, display: "flex", fontSize: 18, fontWeight: 700, paddingBottom: 6, paddingLeft: 16, paddingRight: 16, paddingTop: 6 }}>
            {data.statusLabel.toUpperCase()}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 32 }}>
        <AmountRow label={`Tagihan ${data.jenis} / ${data.periodeLabel}`} value={formatRupiah(data.subtotal)} />
        {data.discount > 0 ? <AmountRow label={`Diskon${data.voucherCode ? ` (${data.voucherCode})` : ""}`} value={`- ${formatRupiah(data.discount)}`} /> : null}
        <AmountRow bold label="Total tagihan" value={formatRupiah(data.amount)} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
        {data.isPaid ? (
          <div style={{ backgroundColor: "#ECFDF3", borderRadius: 16, display: "flex", flexDirection: "column", padding: 20 }}>
            <div style={{ color: SUCCESS, display: "flex", fontSize: 22, fontWeight: 700 }}>Sudah dibayar</div>
            {data.paidAtLabel ? <div style={{ display: "flex", fontSize: 18, marginTop: 6 }}>Dibayar pada {data.paidAtLabel}</div> : null}
            {data.paymentProvider ? <div style={{ display: "flex", fontSize: 18, marginTop: 4 }}>Metode: {data.paymentProvider.toUpperCase()}{data.paymentMethod ? ` / ${data.paymentMethod}` : ""}</div> : null}
          </div>
        ) : (
          <div style={{ backgroundColor: "#EFF8FF", borderRadius: 16, display: "flex", flexDirection: "column", padding: 20 }}>
            <div style={{ color: ACCENT, display: "flex", fontSize: 22, fontWeight: 700 }}>Cara pembayaran</div>
            <div style={{ display: "flex", fontSize: 18, lineHeight: 1.5, marginTop: 6 }}>
              Buka halaman Tagihan di portal Wali LIMO, pilih tagihan ini, lalu lanjutkan pembayaran melalui kanal yang tersedia.
            </div>
          </div>
        )}
      </div>

      {data.description ? <div style={{ color: MUTED, display: "flex", fontSize: 16, marginTop: 20 }}>Catatan: {data.description}</div> : null}

      <div style={{ color: MUTED, display: "flex", fontSize: 14, marginTop: "auto" }}>Dokumen ini dibuat otomatis oleh sistem {data.schoolName}. Status tagihan mengikuti data terakhir pada sistem.</div>
    </div>
  );
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const data = await getInvoiceData(actor, id);
    const image = new ImageResponse(<InvoiceImage data={data} />, { width: 1000, height: 1414 });

    const headers = new Headers(image.headers);
    headers.set("Content-Disposition", `attachment; filename="invoice-${data.id}.png"`);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Request-Id", requestId);

    return new Response(image.body, { status: 200, headers });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
