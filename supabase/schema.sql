-- TripPilot AI Supabase 스키마
-- Supabase SQL Editor에서 실행하세요

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  session_id text unique not null,
  name text not null default '여행자',
  plan_type text not null default 'free',
  trip_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  title text not null,
  destination text not null,
  start_date text not null,
  end_date text not null,
  preferences jsonb not null default '{}',
  itinerary jsonb not null default '{}',
  budget jsonb not null default '{}',
  share_token text unique,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  content_id text not null,
  content_type text not null,
  title text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_users_session on users(session_id);
create index if not exists idx_trips_owner on trips(owner_id);
create index if not exists idx_trips_share on trips(share_token);

alter table users enable row level security;
alter table trips enable row level security;
alter table favorites enable row level security;

create policy "users_all" on users for all using (true) with check (true);
create policy "trips_all" on trips for all using (true) with check (true);
create policy "favorites_all" on favorites for all using (true) with check (true);
