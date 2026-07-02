import { NextResponse } from "next/server";
import { logger, maskId } from "./logger";

type ApiErrorContext = {
  route: string;
  operation?: string;
  sessionId?: string | null;
  userId?: string;
  tripId?: string;
  [key: string]: unknown;
};

function sanitizeContext(context: ApiErrorContext): Record<string, unknown> {
  const { sessionId, ...rest } = context;
  return {
    ...rest,
    ...(sessionId !== undefined ? { sessionId: maskId(sessionId) } : {}),
  };
}

export function handleApiError(
  error: unknown,
  fallback: string,
  context: ApiErrorContext,
  status = 500,
) {
  logger.error(fallback, error, sanitizeContext(context));
  const detail = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ detail }, { status });
}

export function logDbError(message: string, error: unknown, context: ApiErrorContext) {
  logger.error(message, error, sanitizeContext(context));
}

export function logApiWarn(message: string, context: ApiErrorContext) {
  logger.warn(message, sanitizeContext(context));
}
