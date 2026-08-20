import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { getEnv } from "@/server/env";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { encryptPaymentCredentials, decryptPaymentCredentials } from "@/server/security/payment-config";
import type { PaymentGatewayRuntimeConfig, PaymentProviderName } from "@/server/providers/payment/types";
import { testMayarConnection } from "@/server/providers/payment/mayar";
import { testPakasirConnection } from "@/server/providers/payment/pakasir";

const providerSchema = z.enum(["mayar", "pakasir"]);
const settingsSchema = z.object({
  mayar: z.object({
    enabled: z.boolean().default(false),
    environment: z.enum(["sandbox", "production"]).default("sandbox"),
    apiKey: z.string().trim().max(500).optional().default(""),
    merchantId: z.string().trim().max(191).optional().default(""),
    webhookSecret: z.string().trim().max(500).optional().default(""),
    baseUrl: z.string().trim().url().or(z.literal("")).optional().default(""),
  }).optional(),
  pakasir: z.object({
    enabled: z.boolean().default(false),
    environment: z.string().trim().max(32).default("sandbox"),
    apiKey: z.string().trim().max(500).optional().default(""),
    projectSlug: z.string().trim().min(2).max(191).optional().default(""),
    webhookSecret: z.string().trim().max(500).optional().default(""),
  }).optional(),
  primaryProvider: providerSchema.nullable().optional(),
});

type SettingsInput = z.infer<typeof settingsSchema>;
type PublicConfig = Record<string, unknown>;

function enumProvider(provider: PaymentProviderName) {
  return provider.toUpperCase() as "MAYAR" | "PAKASIR";
}

function lowerProvider(provider: "MAYAR" | "PAKASIR"): PaymentProviderName {
  return provider.toLowerCase() as PaymentProviderName;
}

function readPublicConfig(value: unknown): PublicConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as PublicConfig;
}

function legacyMayarConfig(): PaymentGatewayRuntimeConfig | null {
  const env = getEnv();
  if (!env.MAYAR_API_KEY) return null;
  return {
    provider: "mayar",
    enabled: true,
    isPrimary: true,
    environment: env.MAYAR_ENV,
    baseUrl: env.MAYAR_BASE_URL || undefined,
    merchantId: env.MAYAR_MERCHANT_ID || undefined,
    apiKey: env.MAYAR_API_KEY,
    webhookSecret: env.MAYAR_WEBHOOK_SECRET,
    source: "environment",
  };
}

async function getRows() {
  return prisma.paymentGatewayConfig.findMany({ orderBy: { provider: "asc" } });
}

async function rowToRuntime(row: Awaited<ReturnType<typeof getRows>>[number]): Promise<PaymentGatewayRuntimeConfig> {
  const publicConfig = readPublicConfig(row.publicConfig);
  const credentials = row.encryptedCredentials ? decryptPaymentCredentials(row.encryptedCredentials) : {};
  return {
    provider: lowerProvider(row.provider),
    enabled: row.enabled,
    isPrimary: row.isPrimary,
    environment: row.environment,
    baseUrl: typeof publicConfig.baseUrl === "string" ? publicConfig.baseUrl : undefined,
    merchantId: typeof publicConfig.merchantId === "string" ? publicConfig.merchantId : undefined,
    projectSlug: typeof publicConfig.projectSlug === "string" ? publicConfig.projectSlug : undefined,
    apiKey: credentials.apiKey || "",
    webhookSecret: credentials.webhookSecret || "",
    source: "database",
  };
}

export async function getPaymentGatewayRuntimeConfig(provider: PaymentProviderName, options: { requireEnabled?: boolean } = {}) {
  const row = await prisma.paymentGatewayConfig.findUnique({ where: { provider: enumProvider(provider) } });
  const runtime = row ? await rowToRuntime(row) : provider === "mayar" ? legacyMayarConfig() : null;
  if (!runtime || !runtime.apiKey || (options.requireEnabled && !runtime.enabled)) return null;
  return runtime;
}

export async function listPaymentGatewaySettings(actor: Actor) {
  requireAdmin(actor);
  const rows = await getRows();
  const byProvider = new Map(rows.map((row) => [lowerProvider(row.provider), row]));
  const legacy = rows.length === 0 ? legacyMayarConfig() : null;
  const appUrl = getEnv().APP_URL.replace(/\/$/, "");

  return ["mayar", "pakasir"].map((provider) => {
    const name = provider as PaymentProviderName;
    const row = byProvider.get(name);
    const runtime = row ? null : name === "mayar" ? legacy : null;
    const publicConfig = readPublicConfig(row?.publicConfig);
    const rowCredentials = row?.encryptedCredentials ? decryptPaymentCredentials(row.encryptedCredentials) : null;
    const credentialsConfigured = Boolean(rowCredentials?.apiKey || runtime?.apiKey);
    const webhookConfigured = Boolean(rowCredentials?.webhookSecret || runtime?.webhookSecret);
    return {
      provider: name,
      enabled: row?.enabled ?? Boolean(runtime?.enabled),
      isPrimary: row?.isPrimary ?? Boolean(runtime?.isPrimary),
      environment: row?.environment ?? runtime?.environment ?? "sandbox",
      merchantId: typeof publicConfig.merchantId === "string" ? publicConfig.merchantId : runtime?.merchantId || "",
      projectSlug: typeof publicConfig.projectSlug === "string" ? publicConfig.projectSlug : runtime?.projectSlug || "",
      baseUrl: typeof publicConfig.baseUrl === "string" ? publicConfig.baseUrl : runtime?.baseUrl || "",
      apiKeyConfigured: credentialsConfigured,
      webhookSecretConfigured: webhookConfigured,
      source: row ? "database" : runtime ? "environment" : "none",
      lastTestedAt: row?.lastTestedAt?.toISOString() ?? null,
      lastTestStatus: row?.lastTestStatus ?? null,
      lastTestMessage: row?.lastTestMessage ?? null,
      webhookUrl: `${appUrl}/api/v1/webhooks/${name}?secret=<WEBHOOK_SECRET>`,
    };
  });
}

export async function getPaymentGatewayWebhookUrl(actor: Actor, provider: PaymentProviderName) {
  requireAdmin(actor);
  const config = await getPaymentGatewayRuntimeConfig(provider);
  if (!config?.webhookSecret) throw new ValidationError(`Webhook secret ${provider === "mayar" ? "Mayar" : "Pakasir"} belum tersedia`);
  const appUrl = getEnv().APP_URL.replace(/\/$/, "");
  return `${appUrl}/api/v1/webhooks/${provider}?secret=${encodeURIComponent(config.webhookSecret)}`;
}

export async function getActivePaymentGateways() {
  const rows = await getRows();
  if (rows.length === 0) {
    const legacy = legacyMayarConfig();
    return legacy ? [legacy] : [];
  }
  const values = await Promise.all(rows.filter((row) => row.enabled).map(rowToRuntime));
  return values.filter((item) => item.apiKey);
}

export async function getPrimaryPaymentGateway() {
  const active = await getActivePaymentGateways();
  return active.find((item) => item.isPrimary) || active[0] || null;
}

export async function savePaymentGatewaySettings(actor: Actor, input: unknown) {
  requireAdmin(actor);
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Pengaturan payment gateway belum valid", parsed.error.flatten().fieldErrors);
  const data = parsed.data;
  const existingRows = await getRows();
  const existing = new Map(existingRows.map((row) => [lowerProvider(row.provider), row]));
  const definitions: { provider: PaymentProviderName; input: NonNullable<SettingsInput["mayar"]> | NonNullable<SettingsInput["pakasir"]>; }[] = [];
  if (data.mayar) definitions.push({ provider: "mayar", input: data.mayar });
  if (data.pakasir) definitions.push({ provider: "pakasir", input: data.pakasir });
  if (definitions.length === 0) throw new ValidationError("Minimal satu blok konfigurasi provider harus dikirim");

  const rowsToSave = definitions.map(({ provider, input: definition }) => {
    const previousRow = existing.get(provider);
    const previousRuntime = previousRow ? undefined : provider === "mayar" ? legacyMayarConfig() : null;
    const previousCredentials = previousRow?.encryptedCredentials ? decryptPaymentCredentials(previousRow.encryptedCredentials) : {
      apiKey: previousRuntime?.apiKey || "",
      webhookSecret: previousRuntime?.webhookSecret || "",
    };
    const apiKey = definition.apiKey || previousCredentials.apiKey || "";
    const webhookSecret = definition.webhookSecret || previousCredentials.webhookSecret || "";
    const publicConfig = provider === "mayar"
      ? { merchantId: "merchantId" in definition ? definition.merchantId : "", baseUrl: "baseUrl" in definition ? definition.baseUrl : "" }
      : { projectSlug: "projectSlug" in definition ? definition.projectSlug : "" };
    if (definition.enabled && !apiKey) throw new ValidationError(`API key ${provider === "mayar" ? "Mayar" : "Pakasir"} wajib diisi saat provider diaktifkan`);
    if (definition.enabled && !webhookSecret) throw new ValidationError(`Webhook secret ${provider === "mayar" ? "Mayar" : "Pakasir"} wajib diisi saat provider diaktifkan`);
    if (definition.enabled && provider === "mayar" && definition.environment === "production" && !publicConfig.merchantId) throw new ValidationError("Merchant ID Mayar wajib diisi untuk environment production");
    if (definition.enabled && provider === "pakasir" && !publicConfig.projectSlug) throw new ValidationError("Project slug Pakasir wajib diisi saat provider diaktifkan");
    return {
      provider,
      enabled: definition.enabled,
      environment: definition.environment,
      publicConfig,
      encryptedCredentials: encryptPaymentCredentials({ apiKey, webhookSecret }),
    };
  });

  const requestedPrimary = data.primaryProvider || null;
  const enabledProviders = rowsToSave.filter((row) => row.enabled).map((row) => row.provider);
  if (requestedPrimary && !enabledProviders.includes(requestedPrimary)) throw new ValidationError("Provider utama harus dalam keadaan aktif");
  const previousPrimary = existingRows.find((row) => row.isPrimary && row.enabled);
  const previousPrimaryProvider = previousPrimary ? lowerProvider(previousPrimary.provider) : null;
  const primary = requestedPrimary || (previousPrimaryProvider && enabledProviders.includes(previousPrimaryProvider) ? previousPrimaryProvider : enabledProviders[0] || null);

  await prisma.$transaction(async (tx) => {
    for (const row of rowsToSave) {
      await tx.paymentGatewayConfig.upsert({
        where: { provider: enumProvider(row.provider) },
        update: { enabled: row.enabled, isPrimary: row.provider === primary, environment: row.environment, publicConfig: row.publicConfig, encryptedCredentials: row.encryptedCredentials, lastTestStatus: null, lastTestMessage: null },
        create: { provider: enumProvider(row.provider), enabled: row.enabled, isPrimary: row.provider === primary, environment: row.environment, publicConfig: row.publicConfig, encryptedCredentials: row.encryptedCredentials },
      });
    }
    await tx.paymentGatewayConfig.updateMany({ where: { provider: { notIn: rowsToSave.map((row) => enumProvider(row.provider)) } }, data: { enabled: false, isPrimary: false } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "PAYMENT_GATEWAY_CONFIG_UPDATED", entityType: "PaymentGatewayConfig", metadata: { providers: rowsToSave.map((row) => ({ provider: row.provider, enabled: row.enabled, isPrimary: row.provider === primary, environment: row.environment })) } } });
  });

  return { items: await listPaymentGatewaySettings(actor) };
}

export async function testPaymentGateway(actor: Actor, provider: PaymentProviderName) {
  requireAdmin(actor);
  const config = await getPaymentGatewayRuntimeConfig(provider);
  if (!config) throw new NotFoundError(`Konfigurasi ${provider} belum tersedia`);
  const result = provider === "mayar" ? await testMayarConnection(config) : await testPakasirConnection(config);
  await prisma.paymentGatewayConfig.updateMany({ where: { provider: enumProvider(provider) }, data: { lastTestedAt: new Date(), lastTestStatus: "SUCCESS", lastTestMessage: result.message } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "PAYMENT_GATEWAY_TESTED", entityType: "PaymentGatewayConfig", entityId: provider, metadata: { provider, success: true } } });
  return result;
}

function requireAdmin(actor: Actor) {
  if (actor.role !== "ADMIN") throw new ForbiddenError();
}

export function newPakasirOrderId(tagihanId: string) {
  return `LIMO-${tagihanId}-${randomUUID().slice(0, 8)}`;
}
