-- ===========================================================================
-- CarRental — admin audit log
--
-- Run this in the Supabase SQL Editor AFTER 001, 002 and 003.
-- Safe to re-run: every function is "create or replace" and every trigger
-- and policy is dropped before being recreated.
--
-- If 001 is ever re-run, run this again too: dropping the cars / bookings
-- tables drops the audit triggers on them. The audit_log table itself has no
-- foreign keys, so it (and its history) survives.
--
-- WHY TRIGGERS AND NOT FLASK
-- An admin's token works against Supabase REST directly, skipping Flask, so
-- a log written by Flask would miss anything done that way. A trigger fires
-- on every change no matter which path made it, the same reason prices and
-- booking limits live in the database (see 002).
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. The table
--
-- Append-only. Rows are written only by audit_row_change() below; no API
-- role has INSERT, UPDATE or DELETE on it (section 4).
-- ---------------------------------------------------------------------------
create table if not exists audit_log (
  id          bigint generated always as identity primary key,
  -- No foreign key on purpose: the trail must outlive a deleted user, and a
  -- cascade would have to rewrite or remove history to delete one.
  -- NULL = no logged-in user: the SQL Editor or the service_role key.
  actor_id    uuid,
  action      text not null,      -- e.g. 'car.deactivated', 'booking.status_changed'
  target_type text not null
              check (target_type in ('car', 'category', 'booking', 'user')),
  -- Text because cars and bookings have integer ids and users have uuids.
  target_id   text not null,
  -- UPDATE: {"source", "changes": {column: {"from", "to"}}}, changed columns only.
  -- INSERT / DELETE: {"source", "row": <the whole row>}.
  metadata    jsonb not null default '{}',
  ip_address  inet,
  created_at  timestamptz not null default now()
);

-- The admin tab reads newest first, optionally for one target type.
create index if not exists audit_log_type_id_idx on audit_log (target_type, id desc);
create index if not exists audit_log_target_idx  on audit_log (target_type, target_id);


-- ---------------------------------------------------------------------------
-- 2. Caller's IP address
--
-- PostgREST exposes the HTTP request headers to SQL as `request.headers`.
-- Flask sends the end user's IP as X-Client-IP (supabase_client.py), because
-- for a request that came through Flask, X-Forwarded-For only holds Flask's
-- own server address. A direct REST call has no X-Client-IP, so it falls
-- back to X-Forwarded-For, which is then the caller.
--
-- BEST EFFORT, NOT PROOF: a caller talking to Supabase directly can send any
-- X-Client-IP it likes. Treat the column as a lead, not evidence.
-- ---------------------------------------------------------------------------
create or replace function audit_request_ip()
returns inet
language plpgsql
stable
set search_path = public
as $$
declare
  headers jsonb;
begin
  headers := nullif(current_setting('request.headers', true), '')::jsonb;
  return nullif(trim(coalesce(
    headers ->> 'x-client-ip',
    split_part(headers ->> 'x-forwarded-for', ',', 1)
  )), '')::inet;
exception
  -- A malformed header must never stop the admin's change from saving.
  when others then
    return null;
end;
$$;

-- Not an API endpoint. The trigger runs it as the owner, which keeps access.
revoke execute on function audit_request_ip() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3. The trigger
--
-- One function for every audited table. tg_argv[0] names the target type.
--
-- Who gets logged:
--   * admins (auth.uid() is an admin)
--   * no logged-in user at all: the SQL Editor or the service_role key.
--     Those are the trusted maintenance paths (dates and cars of a booking
--     can only be changed there), so they are exactly what an audit should see.
-- Customers are skipped: their bookings and cancellations are their own data
-- and already sit in the bookings table.
--
-- SECURITY DEFINER because no API role may insert into audit_log; running as
-- the owner is the only way in. set search_path for the same reason as 002.
-- AFTER, not BEFORE, so the row logged is the final one, including the
-- total_price that set_booking_price() computed.
-- ---------------------------------------------------------------------------
create or replace function audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_type text := tg_argv[0];
  actor       uuid := auth.uid();
  source      text := case when auth.uid() is null then 'database' else 'api' end;
  row_data    jsonb;
  changes     jsonb;
  -- The one column whose change gets a more specific action name.
  key_column  text := case target_type
                        when 'car'     then 'is_active'
                        when 'booking' then 'status'
                        when 'user'    then 'role'
                      end;
  action      text;
  metadata    jsonb;
begin
  if actor is not null and not is_admin() then
    return null;
  end if;

  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
  else
    row_data := to_jsonb(new);
  end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value))
      into changes
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o on o.key = n.key
    where n.value is distinct from o.value;

    -- Saving a form without changing anything is not worth a log entry.
    if changes is null then
      return null;
    end if;

    if changes ? key_column and (select count(*) from jsonb_object_keys(changes)) = 1 then
      action := case target_type
        when 'car' then
          case when (changes -> 'is_active' ->> 'to')::boolean
               then 'car.activated' else 'car.deactivated' end
        when 'booking' then 'booking.status_changed'
        when 'user'    then 'user.role_changed'
      end;
    else
      action := target_type || '.updated';
    end if;

    metadata := jsonb_build_object('source', source, 'changes', changes);
  else
    action := target_type || case tg_op when 'INSERT' then '.created' else '.deleted' end;
    metadata := jsonb_build_object('source', source, 'row', row_data);
  end if;

  insert into audit_log (actor_id, action, target_type, target_id, metadata, ip_address)
  values (actor, action, target_type, row_data ->> 'id', metadata, audit_request_ip());

  return null;  -- ignored for AFTER triggers
end;
$$;

drop trigger if exists cars_audit on cars;
create trigger cars_audit
  after insert or update or delete on cars
  for each row execute function audit_row_change('car');

drop trigger if exists car_categories_audit on car_categories;
create trigger car_categories_audit
  after insert or update or delete on car_categories
  for each row execute function audit_row_change('category');

drop trigger if exists bookings_audit on bookings;
create trigger bookings_audit
  after insert or update or delete on bookings
  for each row execute function audit_row_change('booking');

-- Not INSERT: profiles are created by the signup trigger, which is not an
-- admin action and would log every new customer.
drop trigger if exists profiles_audit on profiles;
create trigger profiles_audit
  after update or delete on profiles
  for each row execute function audit_row_change('user');


-- ---------------------------------------------------------------------------
-- 4. Who can read it, and nobody can change it
--
-- Supabase grants every API role full privileges on new tables, so take
-- them all back, then give back only SELECT. RLS narrows that to admins.
-- service_role keeps SELECT but not write access, so a leaked service key
-- still cannot erase the trail.
-- ---------------------------------------------------------------------------
revoke all on audit_log from anon, authenticated, service_role;
grant select on audit_log to authenticated, service_role;

alter table audit_log enable row level security;

drop policy if exists audit_log_admin_read on audit_log;
create policy audit_log_admin_read on audit_log
  for select
  to authenticated
  using (is_admin());

-- History never changes, even from the SQL Editor. Deleting old rows there
-- (for retention) is still possible; the API roles have no DELETE grant.
create or replace function audit_log_block_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log entries cannot be changed';
end;
$$;

drop trigger if exists audit_log_no_update on audit_log;
create trigger audit_log_no_update
  before update on audit_log
  for each row execute function audit_log_block_update();


-- ---------------------------------------------------------------------------
-- 5. Check it is installed — expect 4 rows, one per audited table
-- ---------------------------------------------------------------------------
select event_object_table as audited_table, trigger_name
from information_schema.triggers
where trigger_name like '%\_audit' and event_manipulation = 'UPDATE'
order by event_object_table;
