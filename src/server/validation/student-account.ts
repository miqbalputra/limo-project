import { z } from "zod";

export const createSiswaAccountSchema = z.object({
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  loginIdentifier: z.string().trim().min(3).max(64).optional().or(z.literal("")),
});

export const updateSiswaAccountStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
