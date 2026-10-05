-- ===========================================================================
-- CarRental — functions
--
-- Run this in the Supabase SQL Editor after 001_schema_and_seed.sql.
-- Safe to re-run: everything here uses "create or replace".
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- available_cars(pickup, return, category)
--
-- Active cars with no overlapping live booking. Called from Flask via
-- db.rpc('available_cars', ...) — "no overlapping booking" is a NOT EXISTS
-- subquery that the REST API can't express on its own.
--
-- The overlap test is:  b.pickup_at < p_return AND b.return_at > p_pickup
-- which treats a booking ending the day another starts as NOT overlapping.
--
-- !! SECURITY DEFINER IS LOAD-BEARING !!
-- Once RLS is on, anonymous visitors cannot read the bookings table. Without
-- `security definer` this function would run as the caller, the NOT EXISTS
-- would match nothing, and EVERY car would look available — silently
-- overbooking the fleet. Running as the owner lets it see bookings.
--
-- This leaks nothing: the function returns `setof cars` only. No booking row,
-- date, or customer ever comes back.
-- `set search_path` is required on security definer functions so a caller
-- can't shadow `cars`/`bookings` with their own tables.
-- ---------------------------------------------------------------------------
create or replace function available_cars(
  p_pickup   date,
  p_return   date,
  p_category integer default null
)
returns setof cars
language sql
stable
security definer
set search_path = public
as $$
  select c.*
  from cars c
  where c.is_active
    and (p_category is null or c.category_id = p_category)
    and not exists (
      select 1
      from bookings b
      where b.car_id = c.id
        and b.status in ('pending', 'confirmed', 'active')
        and b.pickup_at < p_return
        and b.return_at > p_pickup
    )
  order by c.id;
$$;


-- ---------------------------------------------------------------------------
-- Force total_price to be computed by the database.
--
-- Flask already prices bookings from the cars table, but the React app holds
-- the anon key and can POST to Supabase directly, bypassing Flask entirely.
-- So the only real guarantee is here: whatever price arrives, we overwrite it
-- with days x the car's current daily_rate.
--
-- Also pins new bookings to 'pending' so a customer can't self-confirm, and
-- refuses inactive cars — Flask checks that too, but a direct Supabase call
-- would skip Flask, and the foreign key alone happily accepts an inactive car.
-- ---------------------------------------------------------------------------
-- security definer here too: the trigger must read the true daily_rate even
-- when RLS would hide that car row from the person inserting.
create or replace function set_booking_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rate   numeric(10,2);
  active boolean;
begin
  select daily_rate, is_active into rate, active from cars where id = new.car_id;

  if rate is null then
    raise exception 'car % does not exist', new.car_id;
  end if;

  if not active and (tg_op = 'INSERT' or new.car_id is distinct from old.car_id) then
    raise exception 'car % is not available for booking', new.car_id
      using errcode = 'check_violation';
  end if;

  new.total_price := rate * (new.return_at - new.pickup_at);

  if tg_op = 'INSERT' then
    new.status := 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_set_price on bookings;

create trigger bookings_set_price
  before insert or update of car_id, pickup_at, return_at on bookings
  for each row execute function set_booking_price();


-- ---------------------------------------------------------------------------
-- Booking limits, so one account can't hoard the fleet.
--
-- Without these, a single customer could hold every car for every date as
-- 'pending' (pending bookings block others via bookings_no_overlap), book
-- dates in the past, or book a car for years. Like the price trigger, this
-- lives in the database because the anon key lets anyone skip Flask.
--
-- Applies to logged-in API callers only. The SQL Editor and service_role
-- have no auth.uid() and are trusted maintenance paths.
--
-- security definer so the count sees all of the caller's bookings no matter
-- how RLS changes later.
-- ---------------------------------------------------------------------------
create or replace function enforce_booking_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_live_bookings constant integer := 3;
  max_nights        constant integer := 30;
  max_days_ahead    constant integer := 365;
  live_count        integer;
begin
  if auth.uid() is null then
    return new;
  end if;

  -- One day of slack: current_date is UTC, which is already "tomorrow" for
  -- US users in the evening, so their "today" must still be accepted.
  if new.pickup_at < current_date - 1 then
    raise exception 'Pickup date is in the past.'
      using errcode = 'check_violation';
  end if;

  if new.pickup_at > current_date + max_days_ahead then
    raise exception 'Bookings can be made at most % days ahead.', max_days_ahead
      using errcode = 'check_violation';
  end if;

  if new.return_at - new.pickup_at > max_nights then
    raise exception 'A booking can be at most % nights.', max_nights
      using errcode = 'check_violation';
  end if;

  -- Serialise this user's inserts: otherwise two simultaneous requests could
  -- both count 2 live bookings and each add a third, ending up with 4.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));

  select count(*) into live_count
  from bookings
  where user_id = auth.uid()
    and status in ('pending', 'confirmed', 'active')
    and return_at >= current_date;

  if live_count >= max_live_bookings then
    -- Custom SQLSTATE so Flask can show a specific message (errors.py).
    raise exception 'Limit of % upcoming bookings reached.', max_live_bookings
      using errcode = 'CR001';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_limits on bookings;

create trigger bookings_limits
  before insert on bookings
  for each row execute function enforce_booking_limits();


-- ---------------------------------------------------------------------------
-- Check it works — should list the 11 active cars, minus any booked that week
-- ---------------------------------------------------------------------------
select id, make, model, daily_rate
from available_cars('2026-10-05', '2026-10-07');
