export type PaymentProviderName = "mayar" | "pakasir";

export type PaymentGatewayRuntimeConfig = {
  provider: PaymentProviderName;
  enabled: boolean;
  isPrimary: boolean;
  environment: string;
  baseUrl?: string;
  merchantId?: string;
  projectSlug?: string;
  apiKey: string;
  webhookSecret: string;
  source: "database" | "environment";
};

export type PaymentCreationInput = {
  tagihanId: string;
  name: string;
  email: string;
  mobile: string;
  description: string;
  amount: number | string;
  expiredAt: Date;
  paymentMethod?: string;
  redirectUrl?: string;
};

export type PaymentCreationResult = {
  provider: PaymentProviderName;
  providerReference: string;
  paymentUrl: string;
  paymentMethod: string;
  expiresAt: Date | null;
  rawPayload: object;
};
