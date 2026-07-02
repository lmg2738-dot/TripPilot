import type { Trip } from "./api";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function normalizeItinerary(raw: unknown): Trip["itinerary"] {
  const data = asRecord(raw);
  const daysRaw = Array.isArray(data.days) ? data.days : [];

  return {
    title: asString(data.title, "여행 일정"),
    days: daysRaw.map((dayValue, index) => {
      const day = asRecord(dayValue);
      const scheduleRaw = Array.isArray(day.schedule) ? day.schedule : [];
      return {
        day: asNumber(day.day, index + 1),
        date: asString(day.date),
        schedule: scheduleRaw.map((itemValue) => {
          const item = asRecord(itemValue);
          return {
            time: asString(item.time),
            place: asString(item.place),
            activity: asString(item.activity),
            type: asString(item.type, "attraction"),
          };
        }),
        tips: asString(day.tips),
      };
    }),
    recommendations: (Array.isArray(data.recommendations) ? data.recommendations : []).map((recValue) => {
      const rec = asRecord(recValue);
      return {
        place: asString(rec.place),
        reason: asString(rec.reason),
        recommended: asBoolean(rec.recommended, true),
      };
    }),
    hidden_gems: (Array.isArray(data.hidden_gems) ? data.hidden_gems : []).map((gemValue) => {
      const gem = asRecord(gemValue);
      return {
        place: asString(gem.place),
        reason: asString(gem.reason),
      };
    }),
    transportation: asString(data.transportation),
    indoor_alternatives: (Array.isArray(data.indoor_alternatives) ? data.indoor_alternatives : []).map((altValue) => {
      const alt = asRecord(altValue);
      return {
        original: asString(alt.original),
        alternative: asString(alt.alternative),
        reason: asString(alt.reason),
      };
    }),
    ai_reasoning: asString(data.ai_reasoning),
    travel_tips: (Array.isArray(data.travel_tips) ? data.travel_tips : []).map((tip) => asString(tip)).filter(Boolean),
  };
}

export function normalizeBudget(raw: unknown): Trip["budget"] {
  const data = asRecord(raw);
  const accommodation = asNumber(data.accommodation);
  const fuel = asNumber(data.fuel);
  const toll = asNumber(data.toll);
  const entrance_fees = asNumber(data.entrance_fees);
  const food = asNumber(data.food);
  const total = asNumber(data.total, accommodation + fuel + toll + entrance_fees + food);

  return { accommodation, fuel, toll, entrance_fees, food, total };
}

export function normalizeTrip(raw: Trip): Trip {
  return {
    ...raw,
    itinerary: normalizeItinerary(raw.itinerary),
    budget: normalizeBudget(raw.budget),
  };
}
