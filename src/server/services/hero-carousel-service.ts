import "server-only";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { removeHeroImage, storeHeroImage } from "@/server/providers/storage/hero-storage";
import { heroSlidePayloadSchema, heroSlideUpdateSchema } from "@/server/validation/hero-carousel";

function requireAdmin(actor: Actor) {
  if (actor.role !== "ADMIN") throw new ForbiddenError();
}

const slideSelect = {
  id: true, sortOrder: true, isActive: true, desktopImagePath: true, mobileImagePath: true,
  desktopImageMimeType: true, mobileImageMimeType: true, eyebrow: true, title: true, subtitle: true,
  description: true, ctaLabel: true, ctaHref: true, cta2Label: true, cta2Href: true, altText: true, createdAt: true, updatedAt: true,
} as const;

export async function listHeroSlides(actor: Actor) {
  requireAdmin(actor);
  return { items: await prisma.heroSlide.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: slideSelect }) };
}

export async function listPublishedHeroSlides() {
  return prisma.heroSlide.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: slideSelect });
}

export async function createHeroSlide(actor: Actor, input: unknown, desktop: File | null, mobile: File | null) {
  requireAdmin(actor);
  if (!desktop || !mobile) throw new ValidationError("Gambar desktop dan mobile wajib diisi");
  const parsed = heroSlidePayloadSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data hero belum valid", parsed.error.flatten().fieldErrors);
  const storedDesktop = await storeHeroImage(desktop, "desktop");
  let storedMobile;
  try { storedMobile = await storeHeroImage(mobile, "mobile"); } catch (error) { await removeHeroImage(storedDesktop.storagePath); throw error; }
  try {
    const item = await prisma.heroSlide.create({ data: { ...parsed.data, desktopImagePath: storedDesktop.storagePath, mobileImagePath: storedMobile.storagePath, desktopImageMimeType: storedDesktop.mimeType, mobileImageMimeType: storedMobile.mimeType }, select: slideSelect });
    await prisma.auditLog.create({ data: { actorId: actor.id, action: "HERO_SLIDE_CREATED", entityType: "HeroSlide", entityId: item.id } });
    return { item };
  } catch (error) { await Promise.all([removeHeroImage(storedDesktop.storagePath), removeHeroImage(storedMobile.storagePath)]); throw error; }
}

export async function updateHeroSlide(actor: Actor, id: string, input: unknown, desktop: File | null, mobile: File | null) {
  requireAdmin(actor);
  const existing = await prisma.heroSlide.findUnique({ where: { id }, select: slideSelect });
  if (!existing) throw new NotFoundError("Hero slide tidak ditemukan");
  const parsed = heroSlideUpdateSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data hero belum valid", parsed.error.flatten().fieldErrors);
  const newDesktop = desktop ? await storeHeroImage(desktop, "desktop") : null;
  const newMobile = mobile ? await storeHeroImage(mobile, "mobile") : null;
  try {
    const item = await prisma.heroSlide.update({ where: { id }, data: { ...parsed.data, ...(newDesktop ? { desktopImagePath: newDesktop.storagePath, desktopImageMimeType: newDesktop.mimeType } : {}), ...(newMobile ? { mobileImagePath: newMobile.storagePath, mobileImageMimeType: newMobile.mimeType } : {}) }, select: slideSelect });
    await prisma.auditLog.create({ data: { actorId: actor.id, action: "HERO_SLIDE_UPDATED", entityType: "HeroSlide", entityId: id } });
    await Promise.all([newDesktop ? removeHeroImage(existing.desktopImagePath) : Promise.resolve(), newMobile ? removeHeroImage(existing.mobileImagePath) : Promise.resolve()]);
    return { item };
  } catch (error) { await Promise.all([newDesktop ? removeHeroImage(newDesktop.storagePath) : Promise.resolve(), newMobile ? removeHeroImage(newMobile.storagePath) : Promise.resolve()]); throw error; }
}

export async function archiveHeroSlide(actor: Actor, id: string) {
  requireAdmin(actor);
  const existing = await prisma.heroSlide.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Hero slide tidak ditemukan");
  const item = await prisma.heroSlide.update({ where: { id }, data: { isActive: false }, select: slideSelect });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "HERO_SLIDE_ARCHIVED", entityType: "HeroSlide", entityId: id } });
  return { item };
}
