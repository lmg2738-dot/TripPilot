import { formatNonJsonPreview, readResponseBody } from "./http";
import { logger } from "./logger";

const BLOCKLIST = new Set<string>();
const FALLBACK = [
  "google/gemma-3-12b-it:free",
  "google/gemma-2-9b-it:free",
  "meta-llama/llama-3.3-8b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "qwen/qwen2.5-7b-instruct:free",
  "microsoft/phi-3-mini-128k-instruct:free",
  "qwen/qwen-2-7b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
];

let cache: { models: string[]; at: number } = { models: [], at: 0 };

function isFree(pricing: { prompt?: string; completion?: string }): boolean {
  return parseFloat(pricing.prompt ?? "1") === 0 && parseFloat(pricing.completion ?? "1") === 0;
}

function normalizeModelId(modelId: string): string {
  // 일부 진단/표시 과정에서 끝에 구분자 문자가 붙는 케이스 방어
  return modelId.trim().replace(/[|.]+$/g, "");
}

function dedupeModels(models: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of models) {
    const normalized = normalizeModelId(m);
    if (!normalized || seen.has(normalized) || BLOCKLIST.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function isAuthFailure(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return lower === "unauthorized" || lower.startsWith("unauthorized ") || lower.includes("invalid api key");
}

function shouldTryNextModel(status: number, text: string): boolean {
  if (isAuthFailure(text)) return false;
  const lower = text.toLowerCase();
  if (lower.includes("<!doctype") || lower.startsWith("<html")) return true;
  if ([404, 408, 409, 425, 429, 500, 502, 503, 504].includes(status)) return true;
  if (
    lower.includes("no endpoints found") ||
    lower.includes("model not found") ||
    lower.includes("provider returned error") ||
    lower.includes("rate limit") ||
    lower.includes("quota") ||
    lower.includes("temporarily unavailable")
  ) {
    return true;
  }
  return false;
}

function shouldTreatAsModelContentFailure(text: string): boolean {
  if (isAuthFailure(text)) return true;
  const lower = text.toLowerCase();
  return (
    lower.includes("<!doctype") ||
    lower.startsWith("<html") ||
    lower.includes("api not found") ||
    lower.includes("no endpoints found") ||
    lower.includes("model not found") ||
    lower.includes("provider returned error") ||
    lower.includes("temporarily unavailable")
  );
}

export async function fetchFreeModels(forceRefresh = false): Promise<string[]> {
  if (!forceRefresh && cache.models.length && Date.now() - cache.at < 3600_000) return cache.models;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? ""}` },
    });
    const { json, text } = await readResponseBody(res);
    if (!res.ok || !json) {
      throw new Error(text || `모델 목록 조회 실패: HTTP ${res.status}`);
    }
    const data = json as { data?: { id: string; pricing?: { prompt?: string; completion?: string } }[] };
    const modelsFromApi = (data.data ?? [])
      .filter((m: { id: string; pricing?: { prompt?: string; completion?: string } }) =>
        m.id && !BLOCKLIST.has(m.id) && isFree(m.pricing ?? {}))
      .map((m: { id: string }) => m.id);
    const models = dedupeModels([...modelsFromApi, ...FALLBACK]);
    cache = { models: models.length ? models : dedupeModels(FALLBACK), at: Date.now() };
  } catch (error) {
    logger.warn("OpenRouter 모델 목록 조회 실패, fallback 사용", {
      operation: "fetchFreeModels",
      error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
    });
    cache = { models: dedupeModels(FALLBACK), at: Date.now() };
  }
  return cache.models;
}

function markFailed(id: string) {
  const normalized = normalizeModelId(id);
  BLOCKLIST.add(normalized);
  cache.models = cache.models.filter((m) => m !== normalized);
}

export async function chatCompletion(
  messages: { role: string; content: string }[],
  opts: { jsonMode?: boolean; apiKey: string; siteUrl: string; appName: string } = {
    jsonMode: false,
    apiKey: "",
    siteUrl: "",
    appName: "",
  },
): Promise<string> {
  const tried = new Set<string>();
  let lastError: unknown;
  let forceRefreshed = false;

  while (true) {
    const models = await fetchFreeModels(forceRefreshed);
    const candidates = models.filter((m) => !tried.has(m));
    if (!candidates.length) {
      if (!forceRefreshed) {
        // 1회 강제 새로고침 후 재시도 (새 무료 모델 반영)
        forceRefreshed = true;
        continue;
      }
      break;
    }

    for (const model of candidates) {
      tried.add(model);
      try {
        const body: Record<string, unknown> = { model, messages, temperature: 0.7 };
        if (opts.jsonMode) body.response_format = { type: "json_object" };

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${opts.apiKey}`,
            "HTTP-Referer": opts.siteUrl,
            "X-Title": opts.appName,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const { json, text: responseText } = await readResponseBody(res);

        if ([401, 403].includes(res.status) || isAuthFailure(responseText)) {
          const authError = new Error(`OpenRouter 인증 오류: ${responseText || `HTTP ${res.status}`}. OPENROUTER_API_KEY를 확인하세요.`);
          logger.error("OpenRouter 인증 실패", authError, { operation: "chatCompletion", model, status: res.status });
          throw authError;
        }

        if (!res.ok) {
          if (shouldTryNextModel(res.status, responseText)) {
            logger.warn("OpenRouter 모델 실패, 다음 모델 시도", {
              operation: "chatCompletion",
              model,
              status: res.status,
              preview: formatNonJsonPreview(responseText, 120),
            });
            markFailed(model);
            lastError = new Error(`${model}: ${responseText || `HTTP ${res.status}`}`);
            continue;
          }
          throw new Error(responseText || `OpenRouter 요청 실패: HTTP ${res.status}`);
        }

        if (!json) {
          const preview = formatNonJsonPreview(responseText);
          if (shouldTryNextModel(res.status, responseText)) {
            logger.warn("OpenRouter 비JSON 응답, 다음 모델 시도", {
              operation: "chatCompletion",
              model,
              status: res.status,
              preview,
            });
            markFailed(model);
            lastError = new Error(`${model}: ${preview || "JSON 응답 아님"}`);
            continue;
          }
          throw new Error(preview || "OpenRouter JSON 응답 파싱 실패");
        }

        const data = json as { choices?: { message?: { content?: string } }[] };
        const content = data.choices?.[0]?.message?.content ?? "";
        const trimmed = String(content).trim();
        if (!trimmed) {
          logger.warn("OpenRouter 빈 응답, 다음 모델 시도", { operation: "chatCompletion", model });
          markFailed(model);
          lastError = new Error(`${model}: 빈 응답`);
          continue;
        }
        if (shouldTreatAsModelContentFailure(trimmed)) {
          logger.warn("OpenRouter 콘텐츠 오류, 다음 모델 시도", {
            operation: "chatCompletion",
            model,
            preview: trimmed.slice(0, 120),
          });
          markFailed(model);
          lastError = new Error(`${model}: ${trimmed.slice(0, 200)}`);
          continue;
        }
        if (opts.jsonMode) {
          try {
            // JSON 모드에서는 실제 JSON인지 검증 후 반환
            parseJsonContent(trimmed);
          } catch (parseError) {
            logger.warn("OpenRouter JSON 형식 오류, 다음 모델 시도", {
              operation: "chatCompletion",
              model,
              error: parseError instanceof Error ? { message: parseError.message } : { message: String(parseError) },
            });
            markFailed(model);
            lastError = new Error(`${model}: JSON 응답 형식 아님`);
            continue;
          }
        }
        return trimmed;
      } catch (e) {
        // 인증 에러는 순회 의미가 없으므로 즉시 실패
        if (e instanceof Error && e.message.includes("OpenRouter 인증 오류")) {
          throw e;
        }
        markFailed(model);
        lastError = e;
        logger.warn("OpenRouter 모델 요청 예외, 다음 모델 시도", {
          operation: "chatCompletion",
          model,
          error: e instanceof Error ? { name: e.name, message: e.message } : { message: String(e) },
        });
      }
    }
  }

  const finalError = new Error(`무료 모델 모두 실패: ${lastError}`);
  logger.error("OpenRouter 모든 무료 모델 실패", finalError, {
    operation: "chatCompletion",
    triedModels: [...tried],
    jsonMode: opts.jsonMode ?? false,
  });
  throw finalError;
}

export function parseJsonContent(content: string): Record<string, unknown> {
  let text = content.trim();
  if (text.startsWith("```")) {
    const lines = text.split("\n");
    text = lines.slice(1, lines.at(-1)?.trim() === "```" ? -1 : undefined).join("\n");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`AI JSON 파싱 실패: ${text.slice(0, 200)}`);
  }
}
