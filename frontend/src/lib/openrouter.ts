const BLOCKLIST = new Set<string>();
const FALLBACK = [
  "google/gemma-2-9b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "microsoft/phi-3-mini-128k-instruct:free",
  "qwen/qwen-2-7b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
];

let cache: { models: string[]; at: number } = { models: [], at: 0 };

function isFree(pricing: { prompt?: string; completion?: string }): boolean {
  return parseFloat(pricing.prompt ?? "1") === 0 && parseFloat(pricing.completion ?? "1") === 0;
}

export async function fetchFreeModels(): Promise<string[]> {
  if (cache.models.length && Date.now() - cache.at < 3600_000) return cache.models;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    const data = await res.json();
    const models = (data.data ?? [])
      .filter((m: { id: string; pricing?: { prompt?: string; completion?: string } }) =>
        m.id && !BLOCKLIST.has(m.id) && isFree(m.pricing ?? {}))
      .map((m: { id: string }) => m.id);
    cache = { models: models.length ? models : FALLBACK.filter((m) => !BLOCKLIST.has(m)), at: Date.now() };
  } catch {
    cache = { models: FALLBACK.filter((m) => !BLOCKLIST.has(m)), at: Date.now() };
  }
  return cache.models;
}

function markFailed(id: string) {
  BLOCKLIST.add(id);
  cache.models = cache.models.filter((m) => m !== id);
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
  const models = await fetchFreeModels();
  let lastError: unknown;

  for (const model of models) {
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

      if ([404, 429, 502, 503].includes(res.status)) {
        markFailed(model);
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      if (!res.ok) {
        markFailed(model);
        lastError = new Error(await res.text());
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      if (content.trim()) return content;
    } catch (e) {
      markFailed(model);
      lastError = e;
    }
  }
  throw new Error(`무료 모델 모두 실패: ${lastError}`);
}

export function parseJsonContent(content: string): Record<string, unknown> {
  let text = content.trim();
  if (text.startsWith("```")) {
    const lines = text.split("\n");
    text = lines.slice(1, lines.at(-1)?.trim() === "```" ? -1 : undefined).join("\n");
  }
  return JSON.parse(text);
}
