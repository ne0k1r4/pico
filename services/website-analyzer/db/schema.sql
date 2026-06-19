create extension if not exists "pgcrypto";

create table if not exists website_analyses (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  final_url text not null,
  origin text not null,
  title text,
  name text,
  description text,
  theme_color text,
  favicon_url text,
  profile jsonb not null,
  analyzed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_analyses_url_http check (url ~ '^https?://'),
  constraint website_analyses_final_url_http check (final_url ~ '^https?://')
);

create index if not exists website_analyses_origin_idx on website_analyses (origin);
create index if not exists website_analyses_analyzed_at_idx on website_analyses (analyzed_at desc);
create index if not exists website_analyses_profile_gin_idx on website_analyses using gin (profile);
