-- Kova Studio: close a metering hole where a session that sent at least one heartbeat but
-- never confirmed the AI actually started ("generating") was billed zero seconds and
-- refunded in full when force-closed for going stale or running over time, no matter how
-- long the underlying stream actually ran (fal has no provider-side cutoff, unlike Decart).
--
-- Deliberately narrow: only applies when we are force-closing a session (end_reason 'stale'
-- or 'time_up') and we have proof of life from at least one heartbeat. A user pressing stop,
-- a cancelled or failed start, a provider error, or a session that never sent a single
-- heartbeat all keep refunding in full, same as before.
--
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run.
-- Safe to run more than once.

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
  elsif p_reason in ('stale', 'time_up') and s.last_heartbeat_at is not null then
    -- The AI never confirmed it started, and we are force-closing this session because it
    -- went quiet or ran over time (the cron sweep or the heartbeat route's own cutoff), not
    -- because the user stopped cleanly or something failed on our end. We only have proof
    -- of life up to the last heartbeat we actually received, so bill against that instead of
    -- p_contact (when the sweep happens to run, which can be long after the client went
    -- quiet), minus a grace window long enough for a normal connection to negotiate
    -- (lib/live/fal.ts times out negotiation at 25s).
    --
    -- Deliberately narrow: a clean user_stop, a cancelled/failed start, a provider error, or
    -- a session that never sent a single heartbeat (no proof of life at all, most likely an
    -- honest crash before anything connected) all keep the original floor of 0 and refund in
    -- full below. A client that suppresses every heartbeat from the start still gets a full
    -- refund; this closes the "sent at least one heartbeat, then went dark" case, not that one.
    v_floor := greatest(0, floor(extract(epoch from (s.last_heartbeat_at - s.started_at)))::int - 20);
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

revoke all on function public.settle_session(uuid, int, text, timestamptz) from public, anon, authenticated;
grant execute on function public.settle_session(uuid, int, text, timestamptz) to service_role;
