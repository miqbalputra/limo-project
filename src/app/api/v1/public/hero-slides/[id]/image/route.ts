import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { readHeroImage } from "@/server/providers/storage/hero-storage";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const variant = new URL(request.url).searchParams.get("variant") === "mobile" ? "mobile" : "desktop";
  const slide = await prisma.heroSlide.findFirst({ where: { id, isActive: true }, select: { desktopImagePath: true, mobileImagePath: true, desktopImageMimeType: true, mobileImageMimeType: true } });
  if (!slide) return new NextResponse("Not found", { status: 404 });
  const path = variant === "mobile" ? slide.mobileImagePath : slide.desktopImagePath;
  const mime = variant === "mobile" ? slide.mobileImageMimeType : slide.desktopImageMimeType;
  try { const bytes = await readHeroImage(path); return new NextResponse(bytes, { headers: { "Content-Type": mime, "Content-Disposition": "inline", "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } }); } catch { return new NextResponse("Not found", { status: 404 }); }
}
