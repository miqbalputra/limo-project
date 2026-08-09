export type ApiJsonMeta = {
  requestId?: string;
  [key: string]: unknown;
};

export type ApiJsonErrorFields = Record<string, string[]>;

export type ApiJsonRequestOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: HeadersInit;
  fallbackMessage?: string;
};

export type ApiJsonResponse<TData, TMeta = ApiJsonMeta> = {
  data: TData;
  meta: TMeta | undefined;
  status: number;
  requestId: string | undefined;
};

type ApiJsonErrorDetails<TMeta> = {
  code?: string;
  fields?: ApiJsonErrorFields;
  meta?: TMeta;
  requestId?: string;
  status: number;
};

export class ApiJsonError<TMeta = ApiJsonMeta> extends Error {
  readonly code: string | undefined;
  readonly fields: ApiJsonErrorFields | undefined;
  readonly meta: TMeta | undefined;
  readonly requestId: string | undefined;
  readonly status: number;

  constructor(message: string, details: ApiJsonErrorDetails<TMeta>) {
    super(message);
    this.name = "ApiJsonError";
    this.code = details.code;
    this.fields = details.fields;
    this.meta = details.meta;
    this.requestId = details.requestId;
    this.status = details.status;
  }
}

type ParsedError = {
  code?: string;
  fields?: ApiJsonErrorFields;
  message?: string;
};

export async function requestJson<TData = unknown, TMeta = ApiJsonMeta>(
  path: string,
  options: ApiJsonRequestOptions = {},
): Promise<ApiJsonResponse<TData, TMeta>> {
  const {
    body,
    fallbackMessage = "Permintaan gagal diproses",
    headers: callerHeaders,
    ...requestOptions
  } = options;
  const headers = new Headers(callerHeaders);
  const isFormDataBody = typeof FormData !== "undefined" && body instanceof FormData;

  if (!isFormDataBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...requestOptions,
    body: body === undefined ? undefined : isFormDataBody ? body : JSON.stringify(body),
    headers,
  });
  const { malformed, payload } = await readPayload(response);
  const meta = getMeta<TMeta>(payload);
  const requestId = response.headers.get("x-request-id") || getRequestId(meta);
  const parsedError = getError(payload);

  if (!response.ok) {
    throw new ApiJsonError(parsedError?.message || fallbackMessage, {
      code: parsedError?.code || (malformed ? "MALFORMED_JSON" : undefined),
      fields: parsedError?.fields,
      meta,
      requestId,
      status: response.status,
    });
  }

  if (malformed || !isRecord(payload) || !hasOwn(payload, "data")) {
    throw new ApiJsonError(fallbackMessage, {
      code: malformed ? "MALFORMED_JSON" : "INVALID_RESPONSE",
      meta,
      requestId,
      status: response.status,
    });
  }

  return {
    data: payload.data as TData,
    meta,
    requestId,
    status: response.status,
  };
}

async function readPayload(response: Response) {
  try {
    return { malformed: false, payload: await response.json() };
  } catch {
    return { malformed: true, payload: undefined };
  }
}

function getMeta<TMeta>(payload: unknown) {
  return isRecord(payload) && hasOwn(payload, "meta")
    ? (payload.meta as TMeta)
    : undefined;
}

function getRequestId(meta: unknown) {
  return isRecord(meta) && typeof meta.requestId === "string"
    ? meta.requestId
    : undefined;
}

function getError(payload: unknown): ParsedError | undefined {
  if (!isRecord(payload) || !isRecord(payload.error)) return undefined;

  return {
    code: typeof payload.error.code === "string" ? payload.error.code : undefined,
    fields: isRecord(payload.error.fields)
      ? (payload.error.fields as ApiJsonErrorFields)
      : undefined,
    message:
      typeof payload.error.message === "string" && payload.error.message
        ? payload.error.message
        : undefined,
  };
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
