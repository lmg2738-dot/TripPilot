import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TripPilot AI - AI 여행 비서",
  description: "날씨·교통·축제·혼잡도를 모두 반영해 여행 일정을 자동으로 생성하는 AI 여행 비서",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
