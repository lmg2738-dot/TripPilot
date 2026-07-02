"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plane,
  ArrowLeft,
  Share2,
  RefreshCw,
  CloudRain,
  ThumbsUp,
  ThumbsDown,
  Gem,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { api, ensureSession, type Trip } from "@/lib/api";
import { normalizeTrip } from "@/lib/trip-normalize";
import ChatBot from "@/components/ChatBot";

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    ensureSession()
      .then(() => api.getTrip(id))
      .then((data) => setTrip(normalizeTrip(data)))
      .catch(() => router.push("/dashboard"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleRegenerate = async () => {
    setActionLoading("regenerate");
    try {
      const updated = await api.regenerateTrip(id);
      setTrip(normalizeTrip(updated));
    } catch (err) {
      alert(err instanceof Error ? err.message : "재생성 실패");
    } finally {
      setActionLoading("");
    }
  };

  const handleShare = async () => {
    setActionLoading("share");
    try {
      const result = await api.shareTrip(id);
      const url = `${window.location.origin}${result.share_url}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      alert("공유 링크가 클립보드에 복사되었습니다!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "공유 실패");
    } finally {
      setActionLoading("");
    }
  };

  if (loading || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const { itinerary, budget } = trip;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-600 hover:text-brand-600">
            <ArrowLeft className="w-5 h-5" />
            <Plane className="w-5 h-5" />
            <span className="font-bold">{trip.title}</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              disabled={!!actionLoading}
              className="btn-secondary text-sm flex items-center gap-1"
              title="비 예보 시 일정 재생성"
            >
              <RefreshCw className={`w-4 h-4 ${actionLoading === "regenerate" ? "animate-spin" : ""}`} />
              재생성
            </button>
            <button onClick={handleShare} disabled={!!actionLoading} className="btn-secondary text-sm flex items-center gap-1">
              <Share2 className="w-4 h-4" />
              공유
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {itinerary.ai_reasoning && (
          <div className="card bg-blue-50 border-blue-100">
            <h3 className="font-bold text-brand-700 flex items-center gap-2 mb-2">
              <CloudRain className="w-5 h-5" />
              AI 일정 설명
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">{itinerary.ai_reasoning}</p>
          </div>
        )}

        {itinerary.days?.map((day) => (
          <div key={day.day} className="card">
            <h2 className="text-lg font-bold mb-4">
              Day {day.day} <span className="text-slate-400 font-normal text-base">{day.date}</span>
            </h2>
            <div className="space-y-1">
              {day.schedule?.map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[5.5rem_1fr] sm:grid-cols-[6.5rem_1fr_auto] gap-x-3 gap-y-1 py-3 border-b border-slate-50 last:border-0 items-start"
                >
                  <span className="text-brand-600 font-mono text-sm font-bold leading-snug whitespace-nowrap">
                    {item.time || "—"}
                  </span>
                  <div className="min-w-0">
                    {item.place && <p className="font-medium leading-snug">{item.place}</p>}
                    {item.activity && (
                      <p className={`text-sm text-slate-500 leading-snug ${item.place ? "mt-0.5" : ""}`}>
                        {item.activity}
                      </p>
                    )}
                  </div>
                  {idx < (day.schedule?.length ?? 0) - 1 && (
                    <span className="hidden sm:block text-slate-300 self-center">↓</span>
                  )}
                </div>
              ))}
            </div>
            {day.tips && (
              <p className="mt-3 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">{day.tips}</p>
            )}
          </div>
        ))}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-bold mb-4">AI 추천</h3>
            {itinerary.recommendations?.length ? (
              <div className="space-y-3">
                {itinerary.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {rec.recommended ? (
                      <ThumbsUp className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    ) : (
                      <ThumbsDown className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{rec.place}</p>
                      {rec.reason && <p className="text-xs text-slate-500 mt-0.5">{rec.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">추천 정보가 없습니다. 일정 재생성을 시도해 보세요.</p>
            )}
          </div>

          <div className="card">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Gem className="w-4 h-4 text-purple-500" />
              숨겨진 명소
            </h3>
            {itinerary.hidden_gems?.length ? (
              <div className="space-y-3">
                {itinerary.hidden_gems.map((gem, i) => (
                  <div key={i}>
                    <p className="font-medium text-sm">{gem.place}</p>
                    {gem.reason && <p className="text-xs text-slate-500 mt-0.5">{gem.reason}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">숨겨진 명소 정보가 없습니다.</p>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-4">예상 경비</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "숙소", value: budget.accommodation },
              { label: "기름값", value: budget.fuel },
              { label: "톨게이트", value: budget.toll },
              { label: "입장료", value: budget.entrance_fees },
              { label: "식비", value: budget.food },
            ].map((item) => (
              <div key={item.label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className="font-bold">{item.value.toLocaleString()}원</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
            <span className="font-bold">합계</span>
            <span className="text-2xl font-bold text-brand-600">{budget.total.toLocaleString()}원</span>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <CloudRain className="w-5 h-5 text-sky-500" />
            비 오면 대체 일정
          </h3>
          {itinerary.indoor_alternatives?.length ? (
            <div className="space-y-2">
              {itinerary.indoor_alternatives.map((alt, i) => (
                <div key={i} className="text-sm bg-slate-50 rounded-lg px-4 py-3">
                  {alt.original && alt.alternative ? (
                    <>
                      <span className="text-slate-600">{alt.original}</span>
                      <span className="mx-2 text-slate-400">→</span>
                      <span className="font-medium text-brand-600">{alt.alternative}</span>
                    </>
                  ) : (
                    <span className="font-medium text-brand-600">{alt.alternative || alt.original}</span>
                  )}
                  {alt.reason && <p className="text-xs text-slate-500 mt-1">{alt.reason}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">대체 일정이 없습니다. 재생성 시 비 대비 실내 코스가 추가됩니다.</p>
          )}
        </div>

        {itinerary.travel_tips?.length > 0 && (
          <div className="card">
            <h3 className="font-bold mb-4">여행 팁</h3>
            <ul className="space-y-2">
              {itinerary.travel_tips.map((tip, i) => (
                <li key={i} className="text-sm text-slate-600 flex gap-2">
                  <span className="text-brand-500 shrink-0">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      <button
        onClick={() => setShowChat(true)}
        className="fixed bottom-6 right-6 bg-brand-600 hover:bg-brand-700 text-white rounded-full p-4 shadow-lg transition-colors"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {showChat && <ChatBot tripId={id} onClose={() => setShowChat(false)} />}
    </div>
  );
}
