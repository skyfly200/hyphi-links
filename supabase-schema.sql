-- Run this in your Supabase project's SQL editor
-- Dashboard → SQL Editor → New query → paste & run

-- ── Links table ──────────────────────────────────────────────────────────────
create table if not exists links (
  code        text primary key,
  destination text not null,
  label       text,
  is_public   boolean default false,
  created_at  timestamptz default now()
);

-- ── Clicks table ─────────────────────────────────────────────────────────────
-- NOTE: no FK on code — clicks must log even if the link isn't in Supabase yet
create table if not exists clicks (
  id          bigint generated always as identity primary key,
  code        text not null,
  destination text,
  referrer    text,
  country     char(2),
  user_agent  text,
  ip_hash     text,
  clicked_at  timestamptz default now()
);

-- ── Indexes for common queries ────────────────────────────────────────────────
create index if not exists clicks_code_idx        on clicks(code);
create index if not exists clicks_clicked_at_idx  on clicks(clicked_at desc);
create index if not exists clicks_country_idx     on clicks(country);

-- ── Row-level security ────────────────────────────────────────────────────────
alter table links  enable row level security;
alter table clicks enable row level security;

-- ── Helpful view: links with click counts ─────────────────────────────────────
create or replace view link_stats as
select
  l.code,
  l.destination,
  l.label,
  l.is_public,
  l.created_at,
  count(c.id)                                        as total_clicks,
  max(c.clicked_at)                                  as last_clicked_at,
  count(c.id) filter (where c.clicked_at > now() - interval '24 hours') as clicks_24h,
  count(c.id) filter (where c.clicked_at > now() - interval '7 days')   as clicks_7d,
  count(c.id) filter (where c.clicked_at > now() - interval '30 days')  as clicks_30d
from links l
left join clicks c on c.code = l.code
group by l.code, l.destination, l.label, l.is_public, l.created_at
order by l.created_at desc;

-- ── Migration: run these if upgrading an existing database ────────────────────
-- 1. Add is_public column if missing
alter table links add column if not exists is_public boolean default false;

-- 2. Drop the FK constraint so clicks log even without a Supabase-side link record
--    (Netlify Blobs is the source of truth; Supabase sync is best-effort)
alter table clicks drop constraint if exists clicks_code_fkey;
