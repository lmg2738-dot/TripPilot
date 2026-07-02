"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plane, Plus, MapPin, Calendar, LogOut } from "lucide-react";
import { api, clearAuth, ensureSession, type Trip, type User } from "@/lib/api";
import { env } from "@/lib/env";
import { normalizeTrip } from "@/lib/trip-normalize";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ensureSession()
      .then((u) => {
        setUser(u);
        return api.listTrips();
      })
      .then((list) => setTrips(list.map(normalizeTrip)))
      .catch(() => router.push("/"))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    clearAuth();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-brand-600">
            <Plane className="w-6 h-6" />
            TripPilot AI
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              {user?.name} · {user?.plan_type === "premium" ? "Premium" : `무료 (${user?.trip_count}/${env.publicFreeTripLimit()})`}
            </span>
            <button onClick={handleLogout} className="text-slate-400 hover:text-slate-600">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">내 여행</h1>
          <Link href="/" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            새 여행
          </Link>
        </div>

        {trips.length === 0 ? (
          <div className="card text-center py-16">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">아직 생성된 여행이 없습니다</p>
            <Link href="/" className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              첫 여행 만들기
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {trips.map((trip) => (
              <Link
                key={trip.id}
                href={`/trips/${trip.id}`}
                className="card hover:shadow-md transition-shadow flex items-center justify-between"
              >
                <div>
                  <h3 className="font-bold text-lg">{trip.title}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {trip.destination}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {trip.start_date} ~ {trip.end_date}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-brand-600">
                    {(trip.budget?.total ?? 0).toLocaleString()}원
                  </p>
                  <p className="text-xs text-slate-400">예상 경비</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
