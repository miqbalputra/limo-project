import { z } from "zod";

export const completionRuleSchema = z.object({
  ruleType: z.enum(["VIEWED", "SUBMITTED", "GRADED", "PASSED", "MANUAL"]),
  minimumScore: z.coerce.number().finite().min(0).max(100).optional(),
  requiredDurationSeconds: z.coerce.number().int().min(1).max(86_400).optional(),
  isRequired: z.boolean().default(true),
});

export const manualCompletionSchema = z.object({
  completed: z.boolean(),
  reason: z.string().trim().min(3).max(1000),
});
