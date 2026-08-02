import { prisma } from "@/server/db/prisma";
import { getEnv } from "@/server/env";
import { checkPrivateStorage } from "@/server/providers/storage/local-storage";
import { apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  const checks = {
    environment: "ok",
    database: "ok",
    privateStorage: "ok",
  } as Record<string, "ok" | "failed">;

  try {
    getEnv();
  } catch {
    checks.environment = "failed";
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    checks.database = "failed";
  }

  try {
    await checkPrivateStorage();
  } catch {
    checks.privateStorage = "failed";
  }

  const ready = Object.values(checks).every((value) => value === "ok");

  return apiOk({ status: ready ? "ready" : "not_ready", service: "limo-web", checks, timestamp: new Date().toISOString() }, { requestId }, { status: ready ? 200 : 503 });
}
