export type ApplicationErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "INTERNAL_ERROR";

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string[]>;

  constructor(
    code: ApplicationErrorCode,
    message: string,
    status: number,
    fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApplicationError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export class ValidationError extends ApplicationError {
  constructor(message = "Data yang dikirim belum valid", fields?: Record<string, string[]>) {
    super("VALIDATION_ERROR", message, 400, fields);
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message = "Anda perlu login untuk mengakses resource ini") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message = "Anda tidak memiliki akses ke resource ini") {
    super("FORBIDDEN", message, 403);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message = "Resource tidak ditemukan") {
    super("NOT_FOUND", message, 404);
  }
}

export class ConflictError extends ApplicationError {
  constructor(message = "Resource tidak dapat diproses karena konflik data") {
    super("CONFLICT", message, 409);
  }
}

export class RateLimitedError extends ApplicationError {
  constructor(message = "Terlalu banyak percobaan. Coba lagi nanti") {
    super("RATE_LIMITED", message, 429);
  }
}

export class ProviderError extends ApplicationError {
  constructor(message = "Provider eksternal gagal memproses permintaan") {
    super("PROVIDER_ERROR", message, 502);
  }
}
