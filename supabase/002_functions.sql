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
-- Check it works — should list the 11 active cars, minus any booked that week
-- ---------------------------------------------------------------------------
select id, make, model, daily_rate
from available_cars('2026-10-05', '2026-10-07');
