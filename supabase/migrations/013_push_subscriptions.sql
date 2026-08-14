-- Web Push subscriptions (PWA browsers)
create table if not exists public.push_subscriptions (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid not null references public.users(id) on delete cascade,
  endpoint   text not null,
  p256dh     text,
  auth       text,
  updated_at timestamptz default now(),
  unique(user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "users manage own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role can read all (for edge function)
create policy "service role full access"
  on public.push_subscriptions for all
  to service_role using (true);

-- VIP memberships table (for future payments)
create table if not exists public.memberships (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null references public.users(id) on delete cascade unique,
  plan        text not null default 'free', -- 'free' | 'vip' | 'pro'
  status      text not null default 'active', -- 'active' | 'cancelled' | 'expired'
  expires_at  timestamptz,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.memberships enable row level security;

create policy "users read own membership"
  on public.memberships for select
  using (auth.uid() = user_id);

-- Donations table
create table if not exists public.donations (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.users(id) on delete set null,
  amount      numeric(10,2) not null,
  currency    text not null default 'USD',
  donor_name  text,
  message     text,
  status      text not null default 'pending', -- 'pending' | 'completed' | 'failed'
  created_at  timestamptz default now()
);

alter table public.donations enable row level security;

create policy "anyone can insert donation"
  on public.donations for insert with check (true);

create policy "users see own donations"
  on public.donations for select using (auth.uid() = user_id);
