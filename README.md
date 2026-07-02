# TripPilot AI

> 날씨·교통·축제·혼잡도를 반영해 여행 일정을 자동 생성하는 AI 여행 비서

## Vercel 배포

**Root Directory:** `frontend`

### Vercel 환경변수 (필수)

| 변수명 | 노출 | 설명 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 클라이언트 | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트 | Supabase anon key |
| `OPENROUTER_API_KEY` | 서버 전용 | OpenRouter API 키 (무료 모델 자동 선택) |
| `PUBLIC_DATA_API_KEY` | 서버 전용 | 공공data포털 인증키 (기상청·관광공사·열차 공통) |
| `EX_API_KEY` | 서버 전용 | 한국도로공사 교통 API |

### Vercel 환경변수 (선택)

| 변수명 | 설명 |
|--------|------|
| `OPENROUTER_SITE_URL` | OpenRouter Referer (기본: Vercel URL) |
| `OPENROUTER_APP_NAME` | OpenRouter 앱 이름 |
| `KIPRIS_API_KEY` | KIPRIS API (향후 확장) |
| `KOSIS_API_KEY` | KOSIS API (향후 확장) |
| `FREE_TRIP_LIMIT` | 무료 여행 생성 횟수 (기본 3) |

> **주의:** API 키는 절대 GitHub에 커밋하지 마세요. Vercel Environment Variables에만 등록하세요.

### Supabase 설정

1. [Supabase](https://supabase.com) 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 실행
3. URL과 anon key를 Vercel에 등록

## 주요 기능

- 세션 기반 인증 (JWT 없음)
- OpenRouter **무료 모델만** 자동 선택 (장애 모델 자동 제외)
- TourAPI / 기상청 / 도로공사 / KTX 연동
- AI 일정 생성 및 챗봇
- Supabase 데이터 저장

## 로컬 개발

```bash
cd frontend
cp .env.example .env.local   # 값 직접 입력
npm install
npm run dev
```

```bash
# (선택) Python 백엔드 로컬 실행
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## 프로젝트 구조

```
frontend/          Next.js (Vercel 배포)
  src/app/api/     Serverless API Routes
  src/lib/         OpenRouter, Supabase, 공공데이터
backend/           FastAPI (로컬 개발용, 선택)
supabase/          DB 스키마
```

## 수익 모델

- 무료: 여행 3회
- Premium: 9,900원/월 무제한
