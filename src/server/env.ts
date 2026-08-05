import { z } from "zod";

export const DEFAULT_SESSION_COOKIE_NAME = "limo_session";

const optionalNumberFromString = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error("Expected a numeric value");
    }

    return parsed;
  });

const optionalBooleanFromString = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value) {
      return false;
    }

    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  });

const optionalFeatureFlagFromString = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }

    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().min(1).default(DEFAULT_SESSION_COOKIE_NAME),
  SESSION_ABSOLUTE_DAYS: optionalNumberFromString.default("30"),
  SESSION_IDLE_MINUTES: optionalNumberFromString.default("10080"),
  PRIVATE_STORAGE_PATH: z.string().min(1),
  BACKUP_DIR: z.string().min(1).default("./backups"),
  BACKUP_RETENTION_DAYS: optionalNumberFromString.default("14"),
  BACKUP_WEBHOOK_SECRET: z.string().optional().default(""),
  MAX_REGISTRATION_FILE_MB: optionalNumberFromString.default("10"),
  MAX_MATERIAL_FILE_MB: optionalNumberFromString.default("25"),
  MAX_RPP_FILE_MB: optionalNumberFromString.default("20"),
  MAX_ASSIGNMENT_FILE_MB: optionalNumberFromString.default("25"),
  MAYAR_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  MAYAR_BASE_URL: z.string().url().optional().or(z.literal("")),
  MAYAR_API_KEY: z.string().optional().default(""),
  MAYAR_MERCHANT_ID: z.string().optional().default(""),
  MAYAR_WEBHOOK_SECRET: z.string().optional().default(""),
  NOTIFICATION_PROVIDER: z.enum(["console", "email", "whatsapp", "n8n"]).default("console"),
  N8N_EMAIL_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  N8N_WHATSAPP_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  N8N_WEBHOOK_SECRET: z.string().optional().default(""),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: optionalNumberFromString,
  SMTP_SECURE: optionalBooleanFromString,
  SMTP_FROM: z.string().email().optional().or(z.literal("")).default(""),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),
  STUDENT_PORTAL_ENABLED: optionalFeatureFlagFromString,
  LEARNING_MODULES_ENABLED: optionalFeatureFlagFromString,
  ASSIGNMENTS_ENABLED: optionalFeatureFlagFromString,
  GRADEBOOK_ENABLED: optionalFeatureFlagFromString,
  CALENDAR_ENABLED: optionalFeatureFlagFromString,
  CLASS_DISCUSSION_ENABLED: optionalFeatureFlagFromString,
  PERIODIC_REPORTS_ENABLED: optionalFeatureFlagFromString,
  GUARDIAN_ASSISTED_SUBMISSION_ENABLED: optionalFeatureFlagFromString,
}).superRefine((env, ctx) => {
  const enforceProductionSecrets = env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";

  if (enforceProductionSecrets && env.NOTIFICATION_PROVIDER === "console") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["NOTIFICATION_PROVIDER"], message: "Production wajib memakai provider notifikasi nyata, bukan console" });
  }

  if (enforceProductionSecrets && !env.MAYAR_API_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["MAYAR_API_KEY"], message: "MAYAR_API_KEY wajib diisi di production" });
  }

  if (enforceProductionSecrets && !env.MAYAR_WEBHOOK_SECRET) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["MAYAR_WEBHOOK_SECRET"], message: "MAYAR_WEBHOOK_SECRET wajib diisi di production" });
  }

  if (enforceProductionSecrets && !env.MAYAR_MERCHANT_ID) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["MAYAR_MERCHANT_ID"], message: "MAYAR_MERCHANT_ID wajib diisi di production" });
  }

  if (env.NOTIFICATION_PROVIDER === "email") {
    if (!env.SMTP_HOST) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["SMTP_HOST"], message: "SMTP_HOST wajib diisi saat NOTIFICATION_PROVIDER=email" });
    }

    if (!env.SMTP_PORT) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["SMTP_PORT"], message: "SMTP_PORT wajib diisi saat NOTIFICATION_PROVIDER=email" });
    }

    if (!env.SMTP_FROM && !env.SMTP_USER) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["SMTP_FROM"], message: "SMTP_FROM atau SMTP_USER wajib diisi saat NOTIFICATION_PROVIDER=email" });
    }
  }

  if (env.NOTIFICATION_PROVIDER === "n8n") {
    if (!env.N8N_EMAIL_WEBHOOK_URL) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["N8N_EMAIL_WEBHOOK_URL"], message: "N8N_EMAIL_WEBHOOK_URL wajib diisi saat NOTIFICATION_PROVIDER=n8n" });
    }

    if (!env.N8N_WHATSAPP_WEBHOOK_URL) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["N8N_WHATSAPP_WEBHOOK_URL"], message: "N8N_WHATSAPP_WEBHOOK_URL wajib diisi saat NOTIFICATION_PROVIDER=n8n" });
    }

    if (!env.N8N_WEBHOOK_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["N8N_WEBHOOK_SECRET"], message: "N8N_WEBHOOK_SECRET wajib diisi saat NOTIFICATION_PROVIDER=n8n" });
    }
  }
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    throw new Error(`Invalid application environment: ${JSON.stringify(issues)}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function isProduction() {
  return getEnv().NODE_ENV === "production";
}

export function getSessionCookieName() {
  return getEnv().SESSION_COOKIE_NAME;
}
