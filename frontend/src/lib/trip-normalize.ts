import type { Trip } from "./api";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return fallback;
  return String(value).trim();
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

function pickString(record: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return fallback;
}

function firstArray(...candidates: unknown[]): unknown[] {
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate;
  }
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function unwrapItineraryRoot(raw: unknown): Record<string, unknown> {
  const data = asRecord(raw);
  const nested = asRecord(data.itinerary);
  if (nested.days || nested.recommendations || nested.hidden_gems || nested.hiddenGems) {
    return { ...data, ...nested };
  }
  return data;
}

function normalizeScheduleItem(itemValue: unknown) {
  if (typeof itemValue === "string") {
    const timeMatch = itemValue.match(/^(\d{1,2}:\d{2}(?:~\d{1,2}:\d{2})?)\s*(.*)$/);
    if (timeMatch) {
      return { time: timeMatch[1], place: "", activity: timeMatch[2].trim(), type: "attraction" };
    }
    return { time: "", place: "", activity: itemValue, type: "attraction" };
  }

  const item = asRecord(itemValue);
  const time = pickString(item, ["time", "time_range", "timeRange", "start_time", "startTime", "시간", "시각"]);
  const place = pickString(item, ["place", "name", "location", "spot", "title", "장소", "명소", "destination"]);
  let activity = pickString(item, ["activity", "description", "details", "content", "memo", "note", "활동", "내용", "설명"]);

  if (!activity && !place) {
    activity = pickString(item, ["text", "summary", "일정"]);
  }
  if (!place && activity && !time) {
    return { time: "", place: "", activity, type: asString(item.type, "attraction") };
  }

  return {
    time,
    place,
    activity,
    type: asString(item.type, "attraction"),
  };
}

function normalizeRecommendation(recValue: unknown) {
  if (typeof recValue === "string") {
    return { place: recValue, reason: "", recommended: true };
  }
  const rec = asRecord(recValue);
  const place = pickString(rec, ["place", "name", "location", "spot", "title", "장소", "명소"]);
  const reason = pickString(rec, ["reason", "description", "note", "comment", "why", "이유", "추천이유", "설명"]);
  const hasRecommended = rec.recommended !== undefined || rec.추천 !== undefined;
  return {
    place,
    reason,
    recommended: hasRecommended ? asBoolean(rec.recommended ?? rec.추천, true) : true,
  };
}

function normalizeHiddenGem(gemValue: unknown) {
  if (typeof gemValue === "string") {
    return { place: gemValue, reason: "" };
  }
  const gem = asRecord(gemValue);
  return {
    place: pickString(gem, ["place", "name", "location", "spot", "title", "장소", "명소"]),
    reason: pickString(gem, ["reason", "description", "note", "why", "이유", "설명", "특징"]),
  };
}

function normalizeIndoorAlternative(altValue: unknown) {
  if (typeof altValue === "string") {
    return { original: "", alternative: altValue, reason: "" };
  }
  const alt = asRecord(altValue);
  return {
    original: pickString(alt, ["original", "outdoor", "from", "before", "야외", "원래", "기존"]),
    alternative: pickString(alt, ["alternative", "indoor", "to", "after", "replacement", "실내", "대체", "대안"]),
    reason: pickString(alt, ["reason", "description", "note", "why", "이유", "설명"]),
  };
}

function normalizeDay(dayValue: unknown, index: number) {
  const day = asRecord(dayValue);
  const scheduleRaw = firstArray(day.schedule, day.activities, day.items, day.plan, day.일정);
  return {
    day: asNumber(day.day ?? day.day_number ?? day.dayNumber, index + 1),
    date: asString(day.date ?? day.day_date ?? day.dayDate),
    schedule: scheduleRaw.map(normalizeScheduleItem).filter((item) => item.time || item.place || item.activity),
    tips: pickString(day, ["tips", "tip", "note", "notes", "advice", "팁", "조언"]),
  };
}

function enrichItinerary(itinerary: Trip["itinerary"]): Trip["itinerary"] {
  const scheduleItems = itinerary.days.flatMap((day) => day.schedule);
  const places = scheduleItems
    .map((item) => ({
      place: item.place || item.activity,
      activity: item.activity,
      type: item.type,
    }))
    .filter((item) => item.place);

  let recommendations = itinerary.recommendations;
  if (!recommendations.length && places.length) {
    recommendations = places.slice(0, 5).map((item) => ({
      place: item.place,
      reason: item.activity || "일정에 포함된 장소",
      recommended: true,
    }));
  }

  let hidden_gems = itinerary.hidden_gems;
  if (!hidden_gems.length && places.length > 2) {
    hidden_gems = places.slice(-2).map((item) => ({
      place: item.place,
      reason: "일정에 포함된 로컬 명소",
    }));
  }

  let indoor_alternatives = itinerary.indoor_alternatives;
  if (!indoor_alternatives.length) {
    const indoorKeywords = /박물관|미술관|아쿠아리움|실내|쇼핑|카페|전시|체험관|스파|찜질방/;
    const outdoorItems = scheduleItems.filter(
      (item) => item.type === "attraction" && !indoorKeywords.test(`${item.place} ${item.activity}`),
    );
    const indoorItems = scheduleItems.filter((item) => indoorKeywords.test(`${item.place} ${item.activity}`));

    indoor_alternatives = outdoorItems.slice(0, 3).map((outdoor, index) => {
      const indoor = indoorItems[index % Math.max(indoorItems.length, 1)];
      return {
        original: outdoor.place || outdoor.activity,
        alternative: indoor?.place || indoor?.activity || "근처 실내 명소",
        reason: "비 오는 날 실내 대체 코스",
      };
    });
  }

  return {
    ...itinerary,
    recommendations,
    hidden_gems,
    indoor_alternatives,
  };
}

export function normalizeItinerary(raw: unknown): Trip["itinerary"] {
  const data = unwrapItineraryRoot(raw);
  const daysRaw = firstArray(data.days, data.day_plans, data.dayPlans, data.itinerary_days);

  const recommendations = firstArray(
    data.recommendations,
    data.ai_recommendations,
    data.aiRecommendations,
    data.recommended_places,
  )
    .map(normalizeRecommendation)
    .filter((rec) => rec.place || rec.reason);

  const hidden_gems = firstArray(data.hidden_gems, data.hiddenGems, data.hidden_spots, data.hiddenSpots, data.gems)
    .map(normalizeHiddenGem)
    .filter((gem) => gem.place || gem.reason);

  const indoor_alternatives = firstArray(
    data.indoor_alternatives,
    data.indoorAlternatives,
    data.rainy_day_alternatives,
    data.rainyDayAlternatives,
    data.rain_alternatives,
    data.rainAlternatives,
  )
    .map(normalizeIndoorAlternative)
    .filter((alt) => alt.original || alt.alternative || alt.reason);

  return enrichItinerary({
    title: pickString(data, ["title", "trip_title", "tripTitle"], "여행 일정"),
    days: daysRaw.map(normalizeDay),
    recommendations,
    hidden_gems,
    transportation: pickString(data, ["transportation", "transport", "교통", "이동수단"]),
    indoor_alternatives,
    ai_reasoning: pickString(data, ["ai_reasoning", "aiReasoning", "reasoning", "summary", "설명"]),
    travel_tips: firstArray(data.travel_tips, data.travelTips, data.tips_list, data.tips)
      .map((tip) => (typeof tip === "string" ? tip : pickString(asRecord(tip), ["tip", "text", "content", "내용"])))
      .filter(Boolean),
  });
}

export function normalizeBudget(raw: unknown): Trip["budget"] {
  const data = asRecord(raw);
  const accommodation = asNumber(data.accommodation);
  const fuel = asNumber(data.fuel);
  const toll = asNumber(data.toll);
  const entrance_fees = asNumber(data.entrance_fees ?? data.entranceFees);
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
