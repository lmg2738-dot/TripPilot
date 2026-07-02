import { env } from "../env";
import { fetchJsonSafeWithFallback, fetchPublicDataJson } from "../http";
import { logger } from "../logger";

const AREA_CODES: Record<string, string> = {
  서울: "1", 부산: "6", 제주: "39", 대구: "4", 인천: "2",
};

const TRAIN_STATION_IDS: Record<string, string> = {
  서울: "NAT010000",
  용산: "NAT010032",
  부산: "NAT014445",
  대구: "NAT013189",
  동대구: "NAT013271",
  광주: "NAT014253",
  대전: "NAT011668",
  수원: "NAT010754",
  천안아산: "NAT010369",
  오송: "NAT010779",
  포항: "NAT8B0351",
  울산: "NAT014749",
  창원: "NAT881014",
  경주: "NAT013294",
  전주: "NAT040257",
  여수: "NAT041595",
  목포: "NAT031879",
  강릉: "NAT060125",
  제주: "NAT883012",
};

const MOCK_BUSAN = [
  { content_id: "126128", title: "해운대해수욕장", address: "부산 해운대구", category: "A01", image: "", overview: "대표 해수욕장", map_x: 129.15, map_y: 35.16 },
  { content_id: "2784167", title: "블루라인파크", address: "부산 기장군", category: "A01", image: "", overview: "해안열차", map_x: 129.22, map_y: 35.24 },
  { content_id: "128622", title: "송도해상케이블카", address: "부산 서구", category: "A01", image: "", overview: "케이블카", map_x: 129.02, map_y: 35.08 },
];

function resolveAreaCode(destination: string): string {
  return Object.entries(AREA_CODES).find(([name]) => destination.includes(name))?.[1] ?? "6";
}

function resolveStationId(place: string): string {
  if (/^NAT/i.test(place)) return place;
  const match = Object.entries(TRAIN_STATION_IDS).find(([name]) => place.includes(name));
  return match?.[1] ?? "NAT010000";
}

function getKmaBaseDateTime(now = new Date()): { baseDate: string; baseTime: string } {
  const kstMs = now.getTime() + (9 * 60 - now.getTimezoneOffset()) * 60 * 1000;
  const kst = new Date(kstMs);
  let year = kst.getUTCFullYear();
  let month = kst.getUTCMonth() + 1;
  let day = kst.getUTCDate();
  const hour = kst.getUTCHours();
  const baseHours = [23, 20, 17, 14, 11, 8, 5, 2];

  let selected = 23;
  if (hour < 2) {
    const prev = new Date(kstMs - 86_400_000);
    year = prev.getUTCFullYear();
    month = prev.getUTCMonth() + 1;
    day = prev.getUTCDate();
    selected = 23;
  } else {
    selected = baseHours.find((h) => hour >= h) ?? 2;
  }

  return {
    baseDate: `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`,
    baseTime: `${String(selected).padStart(2, "0")}00`,
  };
}

export async function searchAttractions(destination: string, limit = 20) {
  const key = env.publicDataApiKey();
  if (!key) return MOCK_BUSAN.slice(0, limit);

  const result = await fetchPublicDataJson(
    "https://apis.data.go.kr/B551011/KorService2/areaBasedList2",
    key,
    {
      MobileOS: "ETC",
      MobileApp: "TripPilot",
      numOfRows: String(limit),
      pageNo: "1",
      _type: "json",
      listYN: "Y",
      arrange: "O",
      areaCode: resolveAreaCode(destination),
    },
  );
  if (!result?.res.ok) {
    logger.warn("관광지 API 실패, mock 데이터 사용", { operation: "searchAttractions", destination, status: result?.res.status });
    return MOCK_BUSAN.slice(0, limit);
  }
  const data = result.json as { response?: { body?: { items?: { item?: unknown } } } };
  const items = data?.response?.body?.items?.item ?? [];
  const list = Array.isArray(items) ? items : [items];
  return list.map((i: Record<string, string>) => ({
    content_id: String(i.contentid ?? ""),
    title: i.title ?? "",
    address: i.addr1 ?? "",
    category: i.cat1 ?? "",
    image: i.firstimage ?? "",
    overview: (i.overview ?? "").slice(0, 300),
    map_x: parseFloat(i.mapx ?? "0"),
    map_y: parseFloat(i.mapy ?? "0"),
  }));
}

export async function getWeather(destination: string, days = 3) {
  const key = env.publicDataApiKey();
  const coords: Record<string, [number, number]> = { 부산: [98, 76], 서울: [60, 127], 제주: [52, 38] };
  const [nx, ny] = coords[destination] ?? [60, 127];

  if (!key) {
    return Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.now() + i * 86400000).toISOString().slice(0, 10),
      location: destination, sky: "맑음", temp_min: 18 + i, temp_max: 26 + i,
      rain_probability: 30 + i * 10, wind_speed: 2.5, uv_index: 6, feels_like: 24 + i,
    }));
  }

  const { baseDate, baseTime } = getKmaBaseDateTime();
  const result = await fetchPublicDataJson(
    "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst",
    key,
    {
      pageNo: "1",
      numOfRows: "1000",
      dataType: "JSON",
      base_date: baseDate,
      base_time: baseTime,
      nx: String(nx),
      ny: String(ny),
    },
  );
  if (!result?.res.ok) {
    logger.warn("기상 API 실패, mock 데이터 사용", { operation: "getWeather", destination, status: result?.res.status });
    return Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.now() + i * 86400000).toISOString().slice(0, 10),
      location: destination, sky: "맑음", temp_min: 18 + i, temp_max: 26 + i,
      rain_probability: 30 + i * 10, wind_speed: 2.5, uv_index: 6, feels_like: 24 + i,
    }));
  }
  const data = result.json as { response?: { body?: { items?: { item?: Record<string, string>[] } } } };
  const items: Record<string, string>[] = data?.response?.body?.items?.item ?? [];
  const daily: Record<string, Record<string, string>> = {};
  for (const item of items) {
    const d = item.fcstDate;
    if (!daily[d]) daily[d] = {};
    daily[d][item.category] = item.fcstValue;
  }
  return Object.entries(daily).slice(0, days).map(([date, v]) => ({
    date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`,
    location: destination,
    sky: v.SKY === "4" ? "흐림" : v.SKY === "3" ? "구름많음" : "맑음",
    temp_min: parseFloat(v.TMN ?? v.TMP ?? "20"),
    temp_max: parseFloat(v.TMX ?? v.TMP ?? "28"),
    rain_probability: parseInt(v.POP ?? "0", 10),
    wind_speed: parseFloat(v.WSD ?? "2"),
    uv_index: 5,
    feels_like: parseFloat(v.TMP ?? "24"),
  }));
}

export async function getTraffic(origin: string, destination: string) {
  const key = env.exApiKey();
  const fallback = {
    route: `${origin} → ${destination}`,
    congestion_level: "보통",
    estimated_time_min: 90,
    detour_available: true,
    message: "교통량 보통",
  };
  if (!key) return fallback;

  const query = new URLSearchParams({ key, type: "json", numOfRows: "10", pageNo: "1" }).toString();
  const result = await fetchJsonSafeWithFallback([
    `http://data.ex.co.kr/openapi/trafficapi/liveTraffic?${query}`,
    `https://data.ex.co.kr/openapi/trafficapi/liveTraffic?${query}`,
  ]);
  if (!result?.res.ok) {
    logger.warn("교통 API 실패, mock 데이터 사용", { operation: "getTraffic", origin, destination, status: result?.res.status });
    return fallback;
  }
  const data = result.json;
  const items = Array.isArray(data)
    ? data
    : ((data as { list?: unknown[] } | null)?.list ?? []);
  const item = (items[0] ?? {}) as Record<string, string | undefined>;
  return {
    route: `${origin} → ${destination}`,
    congestion_level: item.congestion ?? "보통",
    estimated_time_min: parseInt(item.travelTime ?? "90", 10),
    detour_available: true,
    message: item.message ?? "조회 완료",
  };
}

export async function getKtxSchedule(departure: string, arrival: string, date: string) {
  const key = env.publicDataApiKey();
  const mock = [
    { train_no: "KTX-101", departure, arrival, departure_time: "06:00", arrival_time: "08:45", duration_min: 165 },
    { train_no: "KTX-105", departure, arrival, departure_time: "08:30", arrival_time: "11:15", duration_min: 165 },
  ];
  if (!key) return mock;

  const depPlaceId = resolveStationId(departure);
  const arrPlaceId = resolveStationId(arrival);
  const result = await fetchPublicDataJson(
    "http://openapi.tago.go.kr/openapi/service/TrainInfoService/getStrtpntAlocFndTrainInfo",
    key,
    {
      depPlaceId,
      arrPlaceId,
      depPlandTime: date.replace(/-/g, ""),
      numOfRows: "10",
      pageNo: "1",
      _type: "json",
    },
  ) ?? await fetchPublicDataJson(
    "https://apis.data.go.kr/1613000/TrainInfoService/getStrtpntAlocFndTrainInfo",
    key,
    {
      depPlaceId,
      arrPlaceId,
      depPlandTime: date.replace(/-/g, ""),
      numOfRows: "10",
      pageNo: "1",
      _type: "json",
    },
  );

  if (!result?.res.ok) {
    logger.warn("KTX API 실패, mock 데이터 사용", {
      operation: "getKtxSchedule",
      departure,
      arrival,
      date,
      depPlaceId,
      arrPlaceId,
      status: result?.res.status,
    });
    return mock;
  }
  const data = result.json as { response?: { body?: { items?: { item?: unknown } } } };
  const items = data?.response?.body?.items?.item ?? [];
  const list = Array.isArray(items) ? items : [items];
  if (!list.length) return mock;
  return list.map((i: Record<string, string>) => ({
    train_no: i.traingradename ?? "KTX",
    departure,
    arrival,
    departure_time: (i.depplandtime ?? "").slice(-4).replace(/(\d{2})(\d{2})/, "$1:$2"),
    arrival_time: (i.arrplandtime ?? "").slice(-4).replace(/(\d{2})(\d{2})/, "$1:$2"),
    duration_min: 165,
  }));
}
