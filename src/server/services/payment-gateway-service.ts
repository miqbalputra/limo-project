import "server-only";
import { z } from "zod";
import type { Actor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import { getEnv } from "@/server/env";
import { NotFoundError, ValidationError } from "@/server/errors/application-error";
import { encryptPaymentCredentials, decryptPaymentCredentials } from "@/server/security/payment-config";
import type { PaymentGatewayRuntimeConfig, PaymentProviderName } from "@/server/providers/payment/types";
import { testMayarConnection } from "@/server/providers/payment/mayar";

const providerSchema = z.enum(["mayar"]);
const settingsSchema = z.object({
  mayar: z.object({
    enabled: z.boolean().default(false),
    environment: z.enum(["sandbox", "production"]).default("sandbox"),
    apiKey: z.string().trim().max(500).optional().default(""),
    merchantId: z.string().trim().max(191).optional().default(""),
    webhookSecret: z.string().trim().max(500).optional().default(""),
    baseUrl: z.string().trim().url().or(z.literal("")).optional().default(""),
  }).optional(),
  primaryProvider: providerSchema.nullable().optional(),
});

type SettingsInput = z.infer<typeof settingsSchema>;
type PublicConfig = Record<string, unknown>;

function enumProvider(provider: PaymentProviderName) {
  return provider.toUpperCase() as "MAYAR";
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

function rowToRuntime(row: Awaited<ReturnType<typeof getRows>>[number]): PaymentGatewayRuntimeConfig | null {
  // Baris provider lain (mis. PAKASIR dari data lama) diabaikan — hanya MAYAR aktif.
  if (row.provider !== "MAYAR") return null;
  const publicConfig = readPublicConfig(row.publicConfig);
  const credentials = row.encryptedCredentials ? decryptPaymentCredentials(row.encryptedCredentials) : {};
  return {
    provider: "mayar",
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
  const runtime = row ? rowToRuntime(row) : provider === "mayar" ? legacyMayarConfig() : null;
  if (!runtime || !runtime.apiKey || (options.requireEnabled && !runtime.enabled)) return null;
  return runtime;
}

export async function listPaymentGatewaySettings(actor: Actor) {
  await requirePermission(actor, "admin.billing.manage");
  const rows = await getRows();
  const mayarRow = rows.find((row) => row.provider === "MAYAR") ?? null;
  const legacy = mayarRow ? null : legacyMayarConfig();
  const appUrl = getEnv().APP_URL.replace(/\/$/, "");

  return (["mayar"] as PaymentProviderName[]).map((provider) => {
    const name = provider;
    const row = mayarRow;
    const runtime = row ? null : legacy;
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
  await requirePermission(actor, "admin.billing.manage");
  const config = await getPaymentGatewayRuntimeConfig(provider);
  if (!config?.webhookSecret) throw new ValidationError("Webhook secret Mayar belum tersedia");
  const appUrl = getEnv().APP_URL.replace(/\/$/, "");
  return `${appUrl}/api/v1/webhooks/${provider}?secret=${encodeURIComponent(config.webhookSecret)}`;
}

export async function getActivePaymentGateways() {
  const rows = await getRows();
  if (rows.length === 0) {
    const legacy = legacyMayarConfig();
    return legacy ? [legacy] : [];
  }
  return rows.filter((row) => row.enabled).map(rowToRuntime).filter((item): item is PaymentGatewayRuntimeConfig => item !== null && Boolean(item.apiKey));
}

export async function getPrimaryPaymentGateway() {
  const active = await getActivePaymentGateways();
  return active.find((item) => item.isPrimary) || active[0] || null;
}

export async function savePaymentGatewaySettings(actor: Actor, input: unknown) {
  await requirePermission(actor, "admin.billing.manage");
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Pengaturan payment gateway belum valid", parsed.error.flatten().fieldErrors);
  const data = parsed.data;
  const existingRows = await getRows();
  const existing = new Map(existingRows.map((row) => [row.provider as "MAYAR", row]));
  const definitions: { provider: PaymentProviderName; input: NonNullable<SettingsInput["mayar"]>; }[] = [];
  if (data.mayar) definitions.push({ provider: "mayar", input: data.mayar });
  if (definitions.length === 0) throw new ValidationError("Minimal satu blok konfigurasi provider harus dikirim");

  const rowsToSave = definitions.map(({ provider, input: definition }) => {
    const previousRow = existing.get("MAYAR");
    const previousRuntime = previousRow ? undefined : provider === "mayar" ? legacyMayarConfig() : null;
    const previousCredentials = previousRow?.encryptedCredentials ? decryptPaymentCredentials(previousRow.encryptedCredentials) : {
      apiKey: previousRuntime?.apiKey || "",
      webhookSecret: previousRuntime?.webhookSecret || "",
    };
    const apiKey = definition.apiKey || previousCredentials.apiKey || "";
    const webhookSecret = definition.webhookSecret || previousCredentials.webhookSecret || "";
    const publicConfig = { merchantId: definition.merchantId, baseUrl: definition.baseUrl };
    if (definition.enabled && !apiKey) throw new ValidationError("API key Mayar wajib diisi saat provider diaktifkan");
    if (definition.enabled && !webhookSecret) throw new ValidationError("Webhook secret Mayar wajib diisi saat provider diaktifkan");
    if (definition.enabled && definition.environment === "production" && !publicConfig.merchantId) throw new ValidationError("Merchant ID Mayar wajib diisi untuk environment production");
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
  const previousPrimaryProvider = previousPrimary?.provider === "MAYAR" ? ("mayar" as PaymentProviderName) : null;
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
  await requirePermission(actor, "admin.billing.manage");
  const config = await getPaymentGatewayRuntimeConfig(provider);
  if (!config) throw new NotFoundError(`Konfigurasi ${provider} belum tersedia`);
  const result = await testMayarConnection(config);
  await prisma.paymentGatewayConfig.updateMany({ where: { provider: enumProvider(provider) }, data: { lastTestedAt: new Date(), lastTestStatus: "SUCCESS", lastTestMessage: result.message } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "PAYMENT_GATEWAY_TESTED", entityType: "PaymentGatewayConfig", entityId: provider, metadata: { provider, success: true } } });
  return result;
}

