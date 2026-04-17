-- Run this in your Supabase project's SQL editor
-- Dashboard → SQL Editor → New query → paste & run

-- ── Links table ──────────────────────────────────────────────────────────────
create table if not exists links (
  code        text primary key,
  destination text not null,
  label       text,
  created_at  timestamptz default now()
);

-- ── Clicks table ─────────────────────────────────────────────────────────────
create table if not exists clicks (
  id          bigint generated always as identity primary key,
  code        text not null references links(code) on delete cascade,
  destination text,
  referrer    text,
  country     char(2),
  user_agent  text,
  ip_hash     text,   -- hashed, not raw IP
  clicked_at  timestamptz default now()
);

-- ── Indexes for common queries ────────────────────────────────────────────────
create index if not exists clicks_code_idx        on clicks(code);
create index if not exists clicks_clicked_at_idx  on clicks(clicked_at desc);
create index if not exists clicks_country_idx     on clicks(country);

-- ── Row-level security ────────────────────────────────────────────────────────
-- We use the service role key from the function, so RLS doesn't block us.
-- But enable it anyway so the anon key can't read anything.
alter table links  enable row level security;
alter table clicks enable row level security;

-- No public access — service role key bypasses RLS automatically
-- If you ever want a public read API, add a policy here.

-- ── Helpful view: links with click counts ─────────────────────────────────────
create or replace view link_stats as
select
  l.code,
  l.destination,
  l.label,
  l.created_at,
  count(c.id)                                        as total_clicks,
  max(c.clicked_at)                                  as last_clicked_at,
  count(c.id) filter (where c.clicked_at > now() - interval '24 hours') as clicks_24h,
  count(c.id) filter (where c.clicked_at > now() - interval '7 days')   as clicks_7d,
  count(c.id) filter (where c.clicked_at > now() - interval '30 days')  as clicks_30d
from links l
left join clicks c on c.code = l.code
group by l.code, l.destination, l.label, l.created_at
order by l.created_at desc;
