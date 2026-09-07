import { z } from "zod";

export const heroSlidePayloadSchema = z.object({
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  isActive: z.coerce.boolean().default(true),
  eyebrow: z.string().trim().max(160).optional().or(z.literal("")),
  title: z.string().trim().min(2).max(240),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  ctaLabel: z.string().trim().max(120).optional().or(z.literal("")),
  ctaHref: z.string().trim().max(500).optional().or(z.literal("")),
  altText: z.string().trim().min(2).max(255),
});

export const heroSlideUpdateSchema = heroSlidePayloadSchema.partial();
