import { z } from "zod";
import { isoDateSchema } from "@/server/validation/common";

export const updateSchoolSettingSchema = z.object({
  name: z.string().trim().min(2).max(200),
  tagline: z.string().trim().max(200).optional().or(z.literal("")),
  address: z.string().trim().max(1000).optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  website: z.string().trim().url().max(500).optional().or(z.literal("")),
});

export const createAcademicYearSchema = z.object({
  label: z.string().trim().min(4).max(32),
  semester: z.enum(["GANJIL", "GENAP"]).default("GANJIL"),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
});

export const updateAcademicYearSchema = createAcademicYearSchema.partial();
