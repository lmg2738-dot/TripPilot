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

export function isPlainTextErrorResponse(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower.includes("<!doctype") ||
    lower.startsWith("<html") ||
    lower.includes("api not found") ||
    lower === "unauthorized" ||
    lower.startsWith("unauthorized ") ||
    lower.includes("invalid api key") ||
    lower.includes("no endpoints found") ||
    lower.includes("model not found") ||
    lower.includes("provider returned error") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("rate limit")
  );
}

export function formatNonJsonPreview(text: string, maxLen = 200): string {
  if (isHtmlResponse(text)) return "HTML 오류 페이지 응답";
  if (isPlainTextErrorResponse(text)) return text.trim().slice(0, maxLen);
  return text.slice(0, maxLen);
}

export function buildPublicDataUrl(
  baseUrl: string,
  serviceKey: string,
  params: Record<string, string> = {},
): string {
  const rest = new URLSearchParams(params);
  const restQuery = rest.toString();
  const isPreEncoded = /%[0-9A-Fa-f]{2}/.test(serviceKey);
  if (isPreEncoded) {
    return restQuery ? `${baseUrl}?serviceKey=${serviceKey}&${restQuery}` : `${baseUrl}?serviceKey=${serviceKey}`;
  }
  rest.set("serviceKey", serviceKey);
  return `${baseUrl}?${rest.toString()}`;
}

/** 한국도로공사 OpenAPI는 query 파라미터명이 key 입니다. */
export function buildExApiUrl(
  baseUrl: string,
  apiKey: string,
  params: Record<string, string> = {},
): string {
  const rest = new URLSearchParams(params);
  const restQuery = rest.toString();
  const isPreEncoded = /%[0-9A-Fa-f]{2}/.test(apiKey);
  if (isPreEncoded) {
    return restQuery ? `${baseUrl}?key=${apiKey}&${restQuery}` : `${baseUrl}?key=${apiKey}`;
  }
  rest.set("key", apiKey);
  return `${baseUrl}?${rest.toString()}`;
}

export async function fetchExApiJson(
  baseUrl: string,
  apiKey: string,
  params: Record<string, string> = {},
): Promise<{ json: unknown; res: Response } | null> {
  const keyCandidates = apiKey.includes("%")
    ? [apiKey, safeDecodeURIComponent(apiKey)]
    : [apiKey];

  let last: { json: unknown; res: Response } | null = null;
  for (const key of keyCandidates) {
    const url = buildExApiUrl(baseUrl, key, params);
    const result = await fetchJsonSafe(url);
    if (!result) continue;
    last = result;
    if (result.res.ok) return result;
    if ([401, 403].includes(result.res.status)) continue;
  }
  return last;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const DEFAULT_FETCH_INIT: RequestInit = {
  headers: { Accept: "application/json", "User-Agent": "TripPilot/1.0" },
  signal: AbortSignal.timeout(20_000),
};

export async function fetchJsonSafe(url: string, init?: RequestInit): Promise<{ json: unknown; res: Response } | null> {
  try {
    const res = await fetch(url, { ...DEFAULT_FETCH_INIT, ...init, headers: { ...DEFAULT_FETCH_INIT.headers, ...init?.headers } });
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

export async function fetchPublicDataJson(
  baseUrl: string,
  serviceKey: string,
  params: Record<string, string> = {},
): Promise<{ json: unknown; res: Response } | null> {
  const keyCandidates = serviceKey.includes("%")
    ? [serviceKey, safeDecodeURIComponent(serviceKey)]
    : [serviceKey];

  let last: { json: unknown; res: Response } | null = null;
  for (const key of keyCandidates) {
    const url = buildPublicDataUrl(baseUrl, key, params);
    const result = await fetchJsonSafe(url);
    if (!result) continue;
    last = result;
    if (result.res.ok) return result;
    if (result.res.status === 401) continue;
    return result;
  }
  return last;
}

export async function fetchJsonSafeWithFallback(
  urls: string[],
  init?: RequestInit,
): Promise<{ json: unknown; res: Response } | null> {
  for (const url of urls) {
    const result = await fetchJsonSafe(url, init);
    if (result?.res.ok) return result;
  }
  return null;
}
