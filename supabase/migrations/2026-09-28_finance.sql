-- Kova Studio: finance tracking for the admin panel.
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run.
-- Safe to run more than once.

-- 1. Money received for a payment grant (in kobo, so N8,000 = 800000), how it was paid, and which pack.
alter table public.credit_ledger add column if not exists amount_kobo bigint check (amount_kobo is null or amount_kobo >= 0);
alter table public.credit_ledger add column if not exists method text check (method is null or method in ('transfer', 'paystack', 'cash', 'other'));
alter table public.credit_ledger add column if not exists pack_id text;
create index if not exists credit_ledger_reason_idx on public.credit_ledger (reason, created_at desc);

-- 2. Money going out: AI provider top-ups (fal / Decart), hosting, ads, anything else.
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
alter table public.expenses enable row level security;
-- No policies on purpose: only the server (secret key) reads or writes expenses.

-- 3. grant_seconds now also records the money for payments.
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

revoke all on function public.grant_seconds(uuid, text, int, boolean, text, uuid, bigint, text, text) from public, anon, authenticated;
grant execute on function public.grant_seconds(uuid, text, int, boolean, text, uuid, bigint, text, text) to service_role;
