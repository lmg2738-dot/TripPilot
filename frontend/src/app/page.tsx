"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plane,
  MapPin,
  Calendar,
  Users,
  Car,
  CloudRain,
  Camera,
  Baby,
  Sparkles,
  Loader2,
} from "lucide-react";
import { api, ensureSession, type TripPreferences } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    destination: "부산",
    start_date: "2026-07-01",
    end_date: "2026-07-03",
    companions: "아이랑",
    vehicle: "SUV",
    weather_preference: "비 안오는 곳",
    photo_spots: true,
    with_kids: true,
    budget: 500000,
    extra_notes: "사진 많이 찍는 곳",
  });

  useEffect(() => {
    ensureSession().catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await ensureSession();

      const preferences: TripPreferences = {
        companions: form.companions,
        vehicle: form.vehicle,
        weather_preference: form.weather_preference,
        photo_spots: form.photo_spots,
        with_kids: form.with_kids,
        budget: form.budget,
        interests: ["관광", "맛집", "사진"],
        extra_notes: form.extra_notes,
      };

      const trip = await api.createTrip({
        destination: form.destination,
        start_date: form.start_date,
        end_date: form.end_date,
        preferences,
      });

      router.push(`/trips/${trip.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "일정 생성에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-br from-brand-600 to-brand-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Plane className="w-10 h-10" />
            <h1 className="text-4xl font-bold">TripPilot AI</h1>
          </div>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto">
            날씨·교통·축제·혼잡도를 모두 반영해 여행 일정을 자동으로 생성하는 AI 여행 비서
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 -mt-8">
        <form onSubmit={handleSubmit} className="card space-y-5">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-600" />
            여행 정보 입력
          </h2>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-1.5">
              <MapPin className="w-4 h-4" /> 목적지
            </label>
            <input
              className="input-field"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              placeholder="예: 부산, 제주, 경주"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-1.5">
                <Calendar className="w-4 h-4" /> 출발일
              </label>
              <input
                type="date"
                className="input-field"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-1.5">
                <Calendar className="w-4 h-4" /> 귀국일
              </label>
              <input
                type="date"
                className="input-field"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-1.5">
              <Users className="w-4 h-4" /> 동행
            </label>
            <input
              className="input-field"
              value={form.companions}
              onChange={(e) => setForm({ ...form, companions: e.target.value })}
              placeholder="예: 아이랑, 친구들이랑"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-1.5">
              <Car className="w-4 h-4" /> 교통수단
            </label>
            <input
              className="input-field"
              value={form.vehicle}
              onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
              placeholder="예: SUV, KTX, 대중교통"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-1.5">
              <CloudRain className="w-4 h-4" /> 날씨 선호
            </label>
            <input
              className="input-field"
              value={form.weather_preference}
              onChange={(e) => setForm({ ...form, weather_preference: e.target.value })}
              placeholder="예: 비 안오는 곳"
            />
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.photo_spots}
                onChange={(e) => setForm({ ...form, photo_spots: e.target.checked })}
                className="rounded border-slate-300 text-brand-600"
              />
              <Camera className="w-4 h-4 text-slate-500" />
              <span className="text-sm">사진 명소</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.with_kids}
                onChange={(e) => setForm({ ...form, with_kids: e.target.checked })}
                className="rounded border-slate-300 text-brand-600"
              />
              <Baby className="w-4 h-4 text-slate-500" />
              <span className="text-sm">아이 동반</span>
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 mb-1.5 block">
              추가 요청
            </label>
            <textarea
              className="input-field resize-none"
              rows={2}
              value={form.extra_notes}
              onChange={(e) => setForm({ ...form, extra_notes: e.target.value })}
              placeholder="자유롭게 입력하세요"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                AI가 일정을 설계하고 있습니다...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                AI 여행 일정 생성
              </>
            )}
          </button>
        </form>

        <div className="grid grid-cols-3 gap-4 my-12 text-center">
          {[
            { title: "TourAPI", desc: "관광지·맛집·축제" },
            { title: "기상청", desc: "날씨·강수·체감온도" },
            { title: "도로공사", desc: "교통량·정체" },
          ].map((item) => (
            <div key={item.title} className="card py-4">
              <p className="font-bold text-brand-600">{item.title}</p>
              <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
