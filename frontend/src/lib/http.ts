import { logger } from "./logger";

export function isHtmlResponse(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return trimmed.startsWith("<!doctype") || trimmed.startsWith("<html");
}

export async function readResponseBody(res: Response): Promise<{ json: unknown | null; text: string }> {
  const text = await res.text();
  if (!text.trim()) return { json: null, text: "" };
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

export function formatNonJsonPreview(text: string, maxLen = 200): string {
  if (isHtmlResponse(text)) return "HTML 오류 페이지 응답";
  return text.slice(0, maxLen);
}

export async function fetchJsonSafe(url: string, init?: RequestInit): Promise<{ json: unknown; res: Response } | null> {
  try {
    const res = await fetch(url, init);
    const { json, text } = await readResponseBody(res);
    if (!json) {
      logger.warn("fetchJsonSafe: JSON 파싱 실패", {
        operation: "fetchJsonSafe",
        status: res.status,
        preview: formatNonJsonPreview(text),
        url: url.split("?")[0],
      });
      return null;
    }
    return { json, res };
  } catch (error) {
    logger.warn("fetchJsonSafe: 요청 실패", {
      operation: "fetchJsonSafe",
      url: url.split("?")[0],
      error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
    });
    return null;
  }
}
