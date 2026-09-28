-- Phase 2: Paystack checkout (naira).
-- Paste this into Supabase > SQL Editor and press Run.

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

alter table public.payments enable row level security;

drop policy if exists "read own payments" on public.payments;
create policy "read own payments" on public.payments
  for select to authenticated using (user_id = (select auth.uid()));

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

revoke all on function public.complete_payment(text, bigint, text, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.complete_payment(text, bigint, text, bigint, text, jsonb) to service_role;
