import { z } from "zod";

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

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().min(1).default("limo_session"),
  SESSION_ABSOLUTE_DAYS: optionalNumberFromString.default("30"),
  SESSION_IDLE_MINUTES: optionalNumberFromString.default("10080"),
  PRIVATE_STORAGE_PATH: z.string().min(1),
  MAX_REGISTRATION_FILE_MB: optionalNumberFromString.default("10"),
  MAX_MATERIAL_FILE_MB: optionalNumberFromString.default("25"),
  PAKASIR_PROJECT: z.string().optional().default(""),
  PAKASIR_API_KEY: z.string().optional().default(""),
  PAKASIR_WEBHOOK_SECRET: z.string().optional().default(""),
  NOTIFICATION_PROVIDER: z.enum(["console", "email", "whatsapp"]).default("console"),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: optionalNumberFromString,
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),
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
