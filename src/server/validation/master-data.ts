import { z } from "zod";

export const createProgramSchema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(["ENGLISH", "ARABIC"]),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const createLevelSchema = z.object({
  programId: z.string().min(8).max(64),
  name: z.string().trim().min(2).max(120),
  order: z.coerce.number().int().min(0).max(1000).default(0),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const createKelasSchema = z.object({
  programId: z.string().min(8).max(64),
  levelId: z.string().min(8).max(64),
  guruProfileId: z.string().min(8).max(64).optional().or(z.literal("")),
  name: z.string().trim().min(2).max(120),
  scheduleNote: z.string().trim().max(500).optional().or(z.literal("")),
});

export const updateProgramSchema = createProgramSchema.pick({ name: true, description: true });
export const updateLevelSchema = createLevelSchema.pick({ name: true, order: true, description: true });
export const updateKelasSchema = createKelasSchema.pick({ name: true, guruProfileId: true, scheduleNote: true });

export const createGuruSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  address: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const createWaliSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  address: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const createSiswaSchema = z.object({
  nomorInduk: z.string().trim().min(3).max(64),
  name: z.string().trim().min(2).max(120),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  programId: z.string().min(8).max(64),
  waliProfileId: z.string().min(8).max(64).optional().or(z.literal("")),
  kelasId: z.string().min(8).max(64).optional().or(z.literal("")),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export const updateSiswaSchema = z.object({
  name: z.string().trim().min(2).max(120),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  programId: z.string().min(8).max(64),
  status: z.enum(["ACTIVE", "INACTIVE", "GRADUATED", "ARCHIVED"]),
});

export const siswaListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional().default(""),
  programId: z.string().max(64).optional().default(""),
  kelasId: z.string().max(64).optional().default(""),
  status: z.enum(["ACTIVE", "INACTIVE", "GRADUATED", "ARCHIVED"]).optional(),
  sort: z.enum(["name", "nomorInduk", "createdAt"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

export const siswaWaliSchema = z.object({
  waliProfileId: z.string().min(8).max(64),
  relationship: z.string().trim().min(2).max(64).default("Wali"),
  isPrimary: z.boolean().default(false),
});

export const transferSiswaSchema = z.object({
  kelasId: z.string().min(8).max(64),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
