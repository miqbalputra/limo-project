import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApplicationError } from "@/server/errors/application-error";
import { logger } from "@/server/logging/logger";

type ResponseMeta = {
  requestId: string;
};

export function apiOk<TData>(data: TData, meta: ResponseMeta, init?: ResponseInit) {
  return NextResponse.json(
    {
      data,
      meta,
    },
    {
      ...init,
      headers: {
        "Cache-Control": "no-store",
        ...init?.headers,
      },
    },
  );
}

export function apiError(error: unknown, meta: ResponseMeta) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Data yang dikirim belum valid",
          fields: error.flatten().fieldErrors,
        },
        meta,
      },
      { status: 400 },
    );
  }

  if (error instanceof ApplicationError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
        meta,
      },
      { status: error.status },
    );
  }

  logger.error("Unhandled route error", {
    requestId: meta.requestId,
    errorName: error instanceof Error ? error.name : "Unknown",
    errorMessage: error instanceof Error ? error.message : String(error),
  });

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi kesalahan pada server",
      },
      meta,
    },
    { status: 500 },
  );
}
