type LogLevel = "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

function formatError(error: unknown): LogContext {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function write(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: "trippilot",
    message,
    ...context,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** 세션 ID 등 민감 식별자 마스킹 */
export function maskId(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export const logger = {
  info(message: string, context?: LogContext) {
    write("info", message, context);
  },

  warn(message: string, context?: LogContext) {
    write("warn", message, context);
  },

  error(message: string, error?: unknown, context?: LogContext) {
    write("error", message, {
      ...context,
      ...(error !== undefined ? { error: formatError(error) } : {}),
    });
  },
};
