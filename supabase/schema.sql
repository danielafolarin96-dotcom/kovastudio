-- =====================================================================
-- Kova Studio database
-- Run this ONCE in Supabase: Dashboard > SQL Editor > New query > paste > Run
-- Safe to re-run: it only creates things that are missing and replaces functions.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Settings (one row). Admins can edit signup_free_seconds from /admin.
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  signup_free_seconds int not null default 0 check (signup_free_seconds >= 0),
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Profiles: one per user. Time balances are in seconds.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  channel_slug text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  has_paid boolean not null default false,       -- true = no watermark, ever
  free_seconds int not null default 0 check (free_seconds >= 0),
  paid_seconds int not null default 0 check (paid_seconds >= 0),
  accepted_terms_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Live sessions (one row per "Go live").
-- Time is reserved up front, then unused time is refunded when it ends.
-- ---------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  bucket text not null check (bucket in ('free', 'paid', 'admin')),
  watermark boolean not null,
  reserved_seconds int not null check (reserved_seconds >= 0),
  reported_seconds int not null default 0,
  billed_seconds int,
  character_name text,
  started_at timestamptz not null default now(),
  generating_at timestamptz,
  last_heartbeat_at timestamptz,
  ended_at timestamptz,
  end_reason text
);
create index if not exists sessions_user_started_idx on public.sessions (user_id, started_at desc);
create index if not exists sessions_open_idx on public.sessions (user_id) where ended_at is null;
create index if not exists sessions_started_idx on public.sessions (started_at desc);

-- ---------------------------------------------------------------------
-- Every change to a balance is written here (signup, grants, payments, usage).
-- ---------------------------------------------------------------------
create table if not exists public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  bucket text not null check (bucket in ('free', 'paid')),
  seconds int not null,
  reason text not null,
  session_id uuid references public.sessions (id) on delete set null,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);
-- Money received for payments (kobo), how it was paid, and which pack.
alter table public.credit_ledger add column if not exists amount_kobo bigint check (amount_kobo is null or amount_kobo >= 0);
alter table public.credit_ledger add column if not exists method text check (method is null or method in ('transfer', 'paystack', 'cash', 'other'));
alter table public.credit_ledger add column if not exists pack_id text;
create index if not exists credit_ledger_reason_idx on public.credit_ledger (reason, created_at desc);

-- Money going out: AI provider top-ups (fal / Decart), hosting, ads, anything else.
create table if not exists public.expenses (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('ai_topup', 'hosting', 'marketing', 'fees', 'other')),
  amount_kobo bigint not null check (amount_kobo >= 0),
  amount_usd numeric(12, 2),
  note text,
  spent_on date not null default current_date,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists expenses_spent_idx on public.expenses (spent_on desc);


-- ---------------------------------------------------------------------
-- Paystack checkout attempts (Phase 2). One row per initialize() call.
-- Credits are granted through complete_payment() below, never from here directly.
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  pack_id text not null,
  credits int not null,
  amount_kobo bigint not null,
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'abandoned')),
  paystack_id bigint,
  channel text,
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payments_user_created_idx on public.payments (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Channel broadcasts: links a live session to the user's public channel.
-- ---------------------------------------------------------------------
create table if not exists public.live_shares (
  session_id uuid primary key references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  room_name text not null,
  subscribe_token text not null,
  watermark boolean not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists live_shares_room_idx on public.live_shares (room_name);
create index if not exists live_shares_user_open_idx on public.live_shares (user_id) where ended_at is null;

-- ---------------------------------------------------------------------
-- Preset character gallery (managed by admins).
-- ---------------------------------------------------------------------
create table if not exists public.presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'General',
  image_path text not null,
  prompt_extra text,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Storage bucket for preset images (public read).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('presets', 'presets', true)
on conflict (id) do nothing;

-- =====================================================================
-- Row level security
-- The browser can only read its own profile/sessions and active presets.
-- Everything else goes through server routes using the secret key.
-- =====================================================================
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.live_shares enable row level security;
alter table public.presets enable row level security;
alter table public.expenses enable row level security; -- no policies: server only
alter table public.payments enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists "read own sessions" on public.sessions;
create policy "read own sessions" on public.sessions
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "read active presets" on public.presets;
create policy "read active presets" on public.presets
  for select to anon, authenticated using (active);

drop policy if exists "read own payments" on public.payments;
create policy "read own payments" on public.payments
  for select to authenticated using (user_id = (select auth.uid()));

-- =====================================================================
-- New user -> profile with the signup free time
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_free int;
begin
  select signup_free_seconds into v_free from public.app_settings where id = 1;
  v_free := coalesce(v_free, 0);

  insert into public.profiles (id, email, display_name, free_seconds)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    v_free
  )
  on conflict (id) do nothing;

  if v_free > 0 then
    insert into public.credit_ledger (user_id, bucket, seconds, reason)
    values (new.id, 'free', v_free, 'signup');
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Settle a session: bill what was used, refund the rest.
-- p_contact = the last moment we know the session was alive.
-- =====================================================================
create or replace function public.settle_session(
  p_session uuid,
  p_reported int,
  p_reason text,
  p_contact timestamptz default now()
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sessions%rowtype;
  v_reported int;
  v_floor int := 0;
  v_billed int;
  v_refund int;
begin
  select * into s from public.sessions where id = p_session for update;
  if not found then
    raise exception 'session_not_found';
  end if;
  if s.ended_at is not null then
    return s.billed_seconds;
  end if;

  v_reported := greatest(s.reported_seconds, least(greatest(coalesce(p_reported, 0), 0), s.reserved_seconds));

  -- Server-side floor: time between the AI starting and our last contact.
  if s.generating_at is not null then
    v_floor := greatest(0, floor(extract(epoch from (p_contact - s.generating_at)))::int - 5);
  end if;

  v_billed := least(s.reserved_seconds, greatest(v_reported, v_floor, 0));
  v_refund := s.reserved_seconds - v_billed;

  update public.sessions
     set ended_at = now(),
         billed_seconds = v_billed,
         reported_seconds = v_reported,
         end_reason = left(coalesce(p_reason, 'ended'), 120)
   where id = p_session;

  if v_refund > 0 and s.bucket in ('free', 'paid') then
    if s.bucket = 'free' then
      update public.profiles set free_seconds = free_seconds + v_refund where id = s.user_id;
    else
      update public.profiles set paid_seconds = paid_seconds + v_refund where id = s.user_id;
    end if;
    insert into public.credit_ledger (user_id, bucket, seconds, reason, session_id)
    values (s.user_id, s.bucket, v_refund, 'session_refund', s.id);
  end if;

  update public.live_shares set ended_at = now() where session_id = p_session and ended_at is null;

  return v_billed;
end;
$$;

-- =====================================================================
-- Start a session: settles stale ones, picks the bucket, reserves time.
-- Returns the new session id, bucket, reserved seconds and watermark flag.
-- =====================================================================
create or replace function public.begin_session(
  p_user uuid,
  p_is_admin boolean,
  p_max_paid int,
  p_max_free int,
  p_max_admin int,
  p_character text default null
)
returns table (session_id uuid, bucket text, reserved_seconds int, watermark boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  prof public.profiles%rowtype;
  stale record;
  v_bucket text;
  v_reserve int;
  v_watermark boolean;
  v_id uuid;
begin
  -- Close sessions that stopped sending heartbeats (tab closed, crash, network loss).
  for stale in
    select s.id, coalesce(s.last_heartbeat_at, s.started_at) as contact
      from public.sessions s
     where s.user_id = p_user
       and s.ended_at is null
       and coalesce(s.last_heartbeat_at, s.started_at) < now() - interval '45 seconds'
  loop
    perform public.settle_session(stale.id, 0, 'stale', stale.contact);
  end loop;

  if exists (select 1 from public.sessions s where s.user_id = p_user and s.ended_at is null) then
    raise exception 'already_live';
  end if;

  select * into prof from public.profiles where id = p_user for update;
  if not found then
    raise exception 'no_profile';
  end if;

  if p_is_admin then
    v_bucket := 'admin';
    v_reserve := p_max_admin;
  elsif prof.paid_seconds > 0 then
    v_bucket := 'paid';
    v_reserve := least(prof.paid_seconds, p_max_paid);
    update public.profiles set paid_seconds = paid_seconds - v_reserve where id = p_user;
  elsif prof.free_seconds > 0 then
    v_bucket := 'free';
    v_reserve := least(prof.free_seconds, p_max_free);
    update public.profiles set free_seconds = free_seconds - v_reserve where id = p_user;
  else
    raise exception 'no_time';
  end if;

  v_watermark := not (p_is_admin or prof.has_paid);

  insert into public.sessions (user_id, bucket, watermark, reserved_seconds, character_name)
  values (p_user, v_bucket, v_watermark, v_reserve, left(p_character, 80))
  returning id into v_id;

  if v_bucket in ('free', 'paid') then
    insert into public.credit_ledger (user_id, bucket, seconds, reason, session_id)
    values (p_user, v_bucket, -v_reserve, 'session_reserve', v_id);
  end if;

  return query select v_id, v_bucket, v_reserve, v_watermark;
end;
$$;

-- =====================================================================
-- Heartbeat from the studio every few seconds while live.
-- =====================================================================
create or replace function public.session_heartbeat(
  p_session uuid,
  p_user uuid,
  p_reported int,
  p_generating boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  update public.sessions s
     set last_heartbeat_at = now(),
         reported_seconds = greatest(s.reported_seconds, least(greatest(coalesce(p_reported, 0), 0), s.reserved_seconds)),
         generating_at = coalesce(
           s.generating_at,
           case when p_generating
                then now() - make_interval(secs => least(greatest(coalesce(p_reported, 0), 0), s.reserved_seconds))
           end
         )
   where s.id = p_session and s.user_id = p_user and s.ended_at is null
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;

-- =====================================================================
-- Admin: add time to a user. p_mark_paid removes their watermark.
-- =====================================================================
drop function if exists public.grant_seconds(uuid, text, int, boolean, text, uuid);
create or replace function public.grant_seconds(
  p_user uuid,
  p_bucket text,
  p_seconds int,
  p_mark_paid boolean,
  p_note text,
  p_admin uuid,
  p_amount_kobo bigint default null,
  p_method text default null,
  p_pack text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_bucket not in ('free', 'paid') then
    raise exception 'bad_bucket';
  end if;
  if p_seconds = 0 then
    raise exception 'zero_seconds';
  end if;
  if p_amount_kobo is not null and p_amount_kobo < 0 then
    raise exception 'bad_amount';
  end if;

  if p_bucket = 'free' then
    update public.profiles set free_seconds = greatest(0, free_seconds + p_seconds) where id = p_user;
  else
    update public.profiles set paid_seconds = greatest(0, paid_seconds + p_seconds) where id = p_user;
  end if;
  if not found then
    raise exception 'no_profile';
  end if;

  if p_mark_paid then
    update public.profiles set has_paid = true where id = p_user;
  end if;

  insert into public.credit_ledger (user_id, bucket, seconds, reason, note, created_by, amount_kobo, method, pack_id)
  values (
    p_user,
    p_bucket,
    p_seconds,
    case when p_mark_paid then 'payment' else 'grant' end,
    left(p_note, 200),
    p_admin,
    case when p_mark_paid then p_amount_kobo else null end,
    case when p_mark_paid then p_method else null end,
    left(p_pack, 40)
  );
end;
$$;

-- =====================================================================
-- Complete a Paystack payment. Called from the webhook and from /pay/return,
-- both of which may race for the same reference, so the row is locked and
-- checked before anything is granted. Grants credits exactly once.
-- =====================================================================
create or replace function public.complete_payment(
  p_reference text,
  p_amount_kobo bigint,
  p_currency text,
  p_paystack_id bigint,
  p_channel text,
  p_raw jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.payments%rowtype;
begin
  select * into pay from public.payments where reference = p_reference for update;
  if not found then
    return 'unknown';
  end if;

  if pay.status = 'paid' then
    return 'already';
  end if;

  if pay.amount_kobo <> p_amount_kobo or upper(pay.currency) <> upper(coalesce(p_currency, pay.currency)) then
    update public.payments set status = 'failed', raw = p_raw where reference = p_reference;
    return 'mismatch';
  end if;

  update public.payments
     set status = 'paid',
         paid_at = now(),
         paystack_id = p_paystack_id,
         channel = p_channel,
         raw = p_raw
   where reference = p_reference;

  perform public.grant_seconds(
    pay.user_id,
    'paid',
    pay.credits * 60,
    true,
    'Paystack ' || pay.reference,
    null,
    pay.amount_kobo,
    'paystack',
    pay.pack_id
  );

  return 'paid';
end;
$$;

-- Only the server (secret key) may call these functions.
revoke all on function public.settle_session(uuid, int, text, timestamptz) from public, anon, authenticated;
revoke all on function public.begin_session(uuid, boolean, int, int, int, text) from public, anon, authenticated;
revoke all on function public.session_heartbeat(uuid, uuid, int, boolean) from public, anon, authenticated;
revoke all on function public.grant_seconds(uuid, text, int, boolean, text, uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.complete_payment(text, bigint, text, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.settle_session(uuid, int, text, timestamptz) to service_role;
grant execute on function public.begin_session(uuid, boolean, int, int, int, text) to service_role;
grant execute on function public.session_heartbeat(uuid, uuid, int, boolean) to service_role;
grant execute on function public.grant_seconds(uuid, text, int, boolean, text, uuid, bigint, text, text) to service_role;
grant execute on function public.complete_payment(text, bigint, text, bigint, text, jsonb) to service_role;

-- Backfill profiles for any users who signed up before this script ran.
insert into public.profiles (id, email, free_seconds)
select u.id, u.email, (select signup_free_seconds from public.app_settings where id = 1)
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id);
