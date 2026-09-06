-- 在 Supabase SQL Editor 執行一次。
-- 舊 Google Sheet 不需要搬；這張表只放 neiwneiw 後台之後新增/管理的卡池。

create extension if not exists pgcrypto;

create table if not exists public.gacha_pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pool_type text not null check (pool_type in ('single', 'multi', 'daily', 'free')),
  characters text[] not null default '{}',
  start_date date not null,
  end_date date not null,
  is_rerun boolean not null default false,
  note text not null default '',
  image_urls text[] not null default '{}',
  image_paths text[] not null default '{}',
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gacha_date_range check (end_date >= start_date)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_gacha_pools_updated_at on public.gacha_pools;
create trigger set_gacha_pools_updated_at
before update on public.gacha_pools
for each row execute function public.set_updated_at();

alter table public.gacha_pools enable row level security;

-- 本版本的公開頁與後台都透過 Vercel /api 存取 Supabase。
-- 不建立 anon policy，避免瀏覽器端直接修改資料。

-- 建立公開 Storage bucket：media
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;
