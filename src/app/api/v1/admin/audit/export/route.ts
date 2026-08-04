import { requireActor, requireRole } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { apiError } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";

export const runtime = "nodejs";

const MAX_EXPORT_ROWS = 10_000;

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    requireRole(actor, ["ADMIN"]);

    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() || undefined;
    const action = url.searchParams.get("action")?.trim() || undefined;
    const entityType = url.searchParams.get("entityType")?.trim() || undefined;
    const where = {
      ...(action ? { action: { contains: action } } : {}),
      ...(entityType ? { entityType: { contains: entityType } } : {}),
      ...(search ? { OR: [{ action: { contains: search } }, { entityType: { contains: search } }, { entityId: { contains: search } }] } : {}),
    };
    const items = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_EXPORT_ROWS,
      select: {
        createdAt: true,
        action: true,
        entityType: true,
        entityId: true,
        reason: true,
        metadata: true,
        ipAddress: true,
        actor: { select: { name: true, email: true, role: true } },
      },
    });

    const lines = [
      ["Waktu", "Aksi", "Tipe Entitas", "ID Entitas", "Actor", "Email Actor", "Role Actor", "Alasan", "IP Address", "Metadata"],
      ...items.map((item) => [
        item.createdAt.toISOString(),
        item.action,
        item.entityType,
        item.entityId,
        item.actor?.name ?? "System",
        item.actor?.email ?? "",
        item.actor?.role ?? "SYSTEM",
        item.reason,
        item.ipAddress,
        item.metadata === null || item.metadata === undefined ? "" : JSON.stringify(item.metadata),
      ]),
    ].map((row) => row.map(csvCell).join(","));
    const body = `\ufeff${lines.join("\r\n")}\r\n`;
    const suffix = new Date().toISOString().slice(0, 10);

    return new Response(body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="limo-audit-${suffix}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
