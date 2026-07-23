type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

const sensitiveFieldPatterns = [
  /password/i,
  /secret/i,
  /token/i,
  /cookie/i,
  /authorization/i,
  /signature/i,
  /api[_-]?key/i,
];

function shouldRedact(key: string) {
  return sensitiveFieldPatterns.some((pattern) => pattern.test(key));
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        shouldRedact(key) ? "[REDACTED]" : redactValue(item),
      ]),
    );
  }

  return value;
}

function write(level: LogLevel, message: string, fields: LogFields = {}) {
  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    ...(redactValue(fields) as LogFields),
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write("debug", message, fields),
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};

export function redactForLog(fields: LogFields) {
  return redactValue(fields) as LogFields;
}
