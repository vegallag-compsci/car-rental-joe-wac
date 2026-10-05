-- ===========================================================================
-- CarRental — database tests
--
-- Runs against a local database that has had 00_supabase_shim.sql and then
-- 001, 002, 003 applied. Use run-tests.ps1 rather than running this directly.
--
-- Every RLS check runs as a real API role (anon / authenticated /
-- service_role), never as the superuser, because superusers and table owners
-- skip RLS entirely and would make every test pass.
-- ===========================================================================

\set ON_ERROR_STOP 1
\set QUIET 1
-- Hide the output of every helper call; only the report at the end prints.
\o NUL

-- ---------------------------------------------------------------------------
-- Test helpers
-- ---------------------------------------------------------------------------
drop schema if exists t cascade;
create schema t;

create table t.results (
  id      integer generated always as identity,
  section text,
  ok      boolean not null,
  label   text not null,
  detail  text
);

create table t.ctx (section text);
insert into t.ctx values ('');

grant usage on schema t to public;
grant all on all tables in schema t to public;
grant all on all sequences in schema t to public;

create function t.section(name text) returns void language sql as
  $$ update t.ctx set section = name $$;

create function t.ok(cond boolean, label text, detail text default null)
returns void language sql as $$
  insert into t.results (section, ok, label, detail)
  select section, coalesce(cond, false), label, detail from t.ctx;
$$;

create function t.eq(actual anyelement, expected anyelement, label text)
returns void language sql as $$
  select t.ok(actual is not distinct from expected, label,
              format('got %s, want %s', actual, expected));
$$;

-- Run `stmt` and expect it to fail with `want` (any error if null).
-- Always rolls back, so a test that wrongly succeeds leaves no trace.
create function t.throws(stmt text, want text, label text)
returns void language plpgsql as $$
declare
  got text;
begin
  begin
    execute stmt;
    raise exception using errcode = 'UNDO1';
  exception
    when sqlstate 'UNDO1' then
      perform t.ok(false, label, 'no error - statement succeeded');
      return;
    when others then
      get stacked diagnostics got = returned_sqlstate;
  end;
  perform t.ok(want is null or got = want, label, 'sqlstate ' || got);
end;
$$;

-- Rows affected by a write. Always rolls back.
create function t.affected(stmt text) returns integer language plpgsql as $$
declare
  n integer;
begin
  begin
    execute stmt;
    get diagnostics n = row_count;
    raise exception using errcode = 'UNDO1';
  exception
    when sqlstate 'UNDO1' then return n;
  end;
end;
$$;

-- Become one of the API roles. Pass null for anonymous.
create function t.act_as(role_name text, user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(user_id::text, ''), false);
  execute format('set role %I', role_name);
end;
$$;

\set alice '''aaaaaaaa-0000-0000-0000-000000000001'''
\set bob   '''bbbbbbbb-0000-0000-0000-000000000002'''
\set admin '''cccccccc-0000-0000-0000-000000000003'''


-- ===========================================================================
-- 1. Schema + seed (001)
-- ===========================================================================
select t.section('001 schema + seed');

select t.eq((select count(*) from car_categories), 6::bigint, 'seeded 6 categories');
select t.eq((select count(*) from cars),          12::bigint, 'seeded 12 cars');
select t.eq((select count(*) from bookings),       3::bigint, 'seeded 3 bookings');

-- Identity sequences were resynced, so a natural insert gets the next id.
do $$
declare v integer;
begin
  begin
    insert into car_categories (name) values ('__seq_test') returning id into v;
    raise exception using errcode = 'UNDO1';
  exception when sqlstate 'UNDO1' then null;
  end;
  perform t.eq(v, 7, 'category sequence resumes after seed ids');
end $$;

select t.throws($$insert into cars (category_id, make, model, year, color, seats, transmission, daily_rate)
                  values (1, 'x', 'y', 1979, 'red', 4, 'manual', 10)$$,
                '23514', 'year before 1980 rejected');
select t.throws($$insert into cars (category_id, make, model, year, color, seats, transmission, daily_rate)
                  values (1, 'x', 'y', 2020, 'red', 4, 'hover', 10)$$,
                '23514', 'unknown transmission rejected');
select t.throws($$insert into cars (category_id, make, model, year, color, seats, transmission, daily_rate)
                  values (1, 'x', 'y', 2020, 'red', 4, 'manual', 0)$$,
                '23514', 'zero daily_rate rejected');
select t.throws($$insert into cars (category_id, make, model, year, color, seats, transmission, daily_rate)
                  values (99, 'x', 'y', 2020, 'red', 4, 'manual', 10)$$,
                '23503', 'unknown category rejected (FK)');
select t.throws($$insert into bookings (car_id, pickup_at, return_at, total_price)
                  values (5, '2026-11-02', '2026-11-02', 0)$$,
                '23514', 'zero-length booking rejected');
select t.throws($$update bookings set status = 'bogus' where id = 1$$,
                '23514', 'unknown booking status rejected');


-- ===========================================================================
-- 2. Double-booking constraint (001 section 7)
-- ===========================================================================
select t.section('001 no-overlap constraint');

-- Seed booking 1 holds car 4 for [2026-10-04, 2026-10-08).
select t.throws($$insert into bookings (car_id, pickup_at, return_at, total_price)
                  values (4, '2026-10-05', '2026-10-07', 0)$$,
                '23P01', 'overlapping booking rejected');
select t.throws($$insert into bookings (car_id, pickup_at, return_at, total_price)
                  values (4, '2026-10-01', '2026-10-20', 0)$$,
                '23P01', 'enclosing booking rejected');

select t.eq(t.affected($$insert into bookings (car_id, pickup_at, return_at, total_price)
                         values (4, '2026-10-08', '2026-10-10', 0)$$),
            1, 'back-to-back booking (return day = next pickup) allowed');

-- Once booking 1 is cancelled its dates are free again.
do $$
declare freed boolean := false;
begin
  begin
    update bookings set status = 'cancelled' where id = 1;
    insert into bookings (car_id, pickup_at, return_at, total_price)
    values (4, '2026-10-05', '2026-10-07', 0);
    freed := true;
    raise exception using errcode = 'UNDO1';
  exception when others then null;
  end;
  perform t.ok(freed, 'cancelled booking no longer blocks its dates');
end $$;


-- ===========================================================================
-- 3. Price trigger (002)
-- ===========================================================================
select t.section('002 price trigger');

do $$
declare b bookings;
begin
  begin
    -- Car 5 is $62/day. Lie about the price and try to self-confirm.
    insert into bookings (car_id, pickup_at, return_at, status, total_price)
    values (5, '2026-11-01', '2026-11-04', 'confirmed', 0.01)
    returning * into b;
    raise exception using errcode = 'UNDO1';
  exception when sqlstate 'UNDO1' then null;
  end;
  perform t.eq(b.total_price, 186.00::numeric, 'client price overwritten (3 x 62)');
  perform t.eq(b.status, 'pending', 'new booking forced to pending');

  begin
    -- Booking 2 is car 9 ($165) for 3 days. Stretch it to 4.
    update bookings set return_at = '2026-10-22' where id = 2 returning * into b;
    raise exception using errcode = 'UNDO1';
  exception when sqlstate 'UNDO1' then null;
  end;
  perform t.eq(b.total_price, 660.00::numeric, 'changing dates re-prices (4 x 165)');
end $$;

select t.throws($$insert into bookings (car_id, pickup_at, return_at, total_price)
                  values (999, '2026-11-01', '2026-11-02', 0)$$,
                'P0001', 'booking an unknown car rejected');


-- ===========================================================================
-- 4. available_cars() (002)
-- ===========================================================================
select t.section('002 available_cars()');

select t.eq((select count(*) from available_cars('2026-10-05', '2026-10-07')), 10::bigint,
            'Oct 5-7: 11 active cars minus booked Camry');
select t.ok(not exists (select 1 from available_cars('2026-10-05', '2026-10-07') where id = 4),
            'booked car 4 excluded');
select t.ok(not exists (select 1 from available_cars('2026-01-01', '2026-01-02') where id = 3),
            'inactive car 3 never offered');
select t.ok(exists (select 1 from available_cars('2026-10-08', '2026-10-10') where id = 4),
            'car 4 free from its return day');
select t.ok(exists (select 1 from available_cars('2026-10-01', '2026-10-04') where id = 4),
            'car 4 free up to its pickup day');
select t.ok(exists (select 1 from available_cars('2026-09-12', '2026-09-16') where id = 1),
            'returned booking does not block car 1');
select t.eq((select array_agg(id order by id) from available_cars('2026-10-05', '2026-10-07', 2)),
            array[5]::bigint[], 'category filter: only Sedan 5 free Oct 5-7');


-- ===========================================================================
-- 5. Users, profiles, admin (003)
-- ===========================================================================
select t.section('003 profiles');

insert into auth.users (id, email) values
  (:alice, 'alice@test.local'),
  (:bob,   'bob@test.local'),
  (:admin, 'admin@test.local');

select t.eq((select count(*) from profiles), 3::bigint, 'signup trigger created a profile per user');
select t.ok((select bool_and(role = 'customer') from profiles), 'new users default to customer');

update profiles set role = 'admin' where id = :admin;

select t.eq((select count(*) from pg_tables
             where schemaname = 'public' and rowsecurity
               and tablename in ('cars', 'car_categories', 'bookings', 'profiles')),
            4::bigint, 'RLS enabled on all 4 tables');
select t.eq((select count(*) from pg_policies where schemaname = 'public'),
            11::bigint, '11 policies installed');


-- ===========================================================================
-- 6. Anonymous visitor
-- ===========================================================================
select t.section('RLS: anon');
select t.act_as('anon', null);

select t.eq((select count(*) from cars), 11::bigint, 'sees the 11 active cars');
select t.ok(not exists (select 1 from cars where id = 3), 'cannot see inactive car 3');
select t.eq((select count(*) from car_categories), 6::bigint, 'sees all categories');
select t.eq((select count(*) from bookings), 0::bigint, 'sees zero bookings');
select t.eq((select count(*) from profiles), 0::bigint, 'sees zero profiles');
select t.eq(is_admin(), false, 'is_admin() is false');

select t.ok(not exists (select 1 from available_cars('2026-10-05', '2026-10-07') where id = 4),
            'available_cars still hides booked car (security definer works)');

select t.throws($$insert into bookings (car_id, pickup_at, return_at, total_price)
                  values (1, '2099-01-01', '2099-01-02', 0)$$,
                '42501', 'cannot create a booking');
select t.throws($$insert into car_categories (name) values ('hack')$$,
                '42501', 'cannot add a category');
select t.eq(t.affected('update cars set daily_rate = 1'), 0, 'cannot change prices');
select t.eq(t.affected('delete from cars'), 0, 'cannot delete cars');
select t.eq(t.affected('delete from bookings'), 0, 'cannot delete bookings');

reset role;


-- ===========================================================================
-- 7. Customer: alice
--
-- Dates here are relative to today, because enforce_booking_limits() rejects
-- past pickups; fixed dates would make these tests start failing over time.
-- ===========================================================================

-- A future booking of bob's that alice can't see (inserted as superuser, so
-- no limits apply), for the hidden-overlap test below.
insert into bookings (user_id, car_id, pickup_at, return_at, total_price)
values (:bob, 4, current_date + 40, current_date + 44, 0);

select t.section('RLS: customer');
select t.act_as('authenticated', :alice);

select t.eq((select count(*) from bookings), 0::bigint, 'sees none of the unowned seed bookings');
select t.eq((select count(*) from profiles), 1::bigint, 'sees only her own profile');
select t.eq(is_admin(), false, 'is_admin() is false');

select t.throws(format($$insert into bookings (user_id, car_id, pickup_at, return_at, total_price)
                         values (%L, 5, current_date + 30, current_date + 33, 0)$$, :bob),
                '42501', 'cannot book on behalf of another user');

-- A real booking, with a lie about price and status.
insert into bookings (user_id, car_id, pickup_at, return_at, status, total_price)
values (:alice, 5, current_date + 30, current_date + 33, 'confirmed', 1);

select t.eq((select total_price from bookings where car_id = 5), 186.00::numeric,
            'her booking is priced by the database');
select t.eq((select status from bookings where car_id = 5), 'pending',
            'her booking starts pending');

select t.throws(format($$insert into bookings (user_id, car_id, pickup_at, return_at, total_price)
                         values (%L, 4, current_date + 41, current_date + 43, 0)$$, :alice),
                '23P01', 'overlap with a booking she cannot see is still rejected');

select t.throws(format($$insert into bookings (user_id, car_id, pickup_at, return_at, total_price)
                         values (%L, 3, current_date + 50, current_date + 51, 0)$$, :alice),
                '23514', 'cannot book an inactive car directly');

select t.throws($$update bookings set status = 'confirmed' where car_id = 5$$,
                '42501', 'cannot self-confirm');
select t.throws($$update bookings set status = 'cancelled', total_price = 0 where car_id = 5$$,
                '42501', 'cannot rewrite total_price while cancelling');
select t.throws($$update bookings set status = 'cancelled', car_id = 6 where car_id = 5$$,
                '42501', 'cannot move her booking to another car');

select t.eq(t.affected($$update bookings set status = 'cancelled' where id = 1$$),
            0, 'cannot cancel a booking that is not hers');
select t.eq(t.affected($$delete from bookings where car_id = 5$$),
            0, 'cannot delete even her own booking');

-- For real this time (no rollback); the final section checks the result.
update bookings set status = 'cancelled' where car_id = 5;
select t.eq((select status from bookings where car_id = 5), 'cancelled',
            'can cancel her own pending booking');
select t.eq(t.affected($$update bookings set status = 'pending' where car_id = 5$$),
            0, 'cannot un-cancel it');

-- Booking limits (002 enforce_booking_limits). Her only booking is now
-- cancelled, so she has 0 live bookings here.
select t.throws(format($$insert into bookings (user_id, car_id, pickup_at, return_at, total_price)
                         values (%L, 6, current_date - 3, current_date + 2, 0)$$, :alice),
                '23514', 'cannot book a pickup in the past');
select t.eq(t.affected(format($$insert into bookings (user_id, car_id, pickup_at, return_at, total_price)
                                values (%L, 6, current_date - 1, current_date + 2, 0)$$, :alice)),
            1, 'yesterday (UTC time-zone slack) is still allowed');
select t.throws(format($$insert into bookings (user_id, car_id, pickup_at, return_at, total_price)
                         values (%L, 6, current_date + 400, current_date + 402, 0)$$, :alice),
                '23514', 'cannot book more than a year ahead');
select t.throws(format($$insert into bookings (user_id, car_id, pickup_at, return_at, total_price)
                         values (%L, 6, current_date + 10, current_date + 41, 0)$$, :alice),
                '23514', 'cannot book more than 30 nights');
select t.eq(t.affected(format($$insert into bookings (user_id, car_id, pickup_at, return_at, total_price)
                                values (%L, 6, current_date + 100, current_date + 102, 0),
                                       (%L, 7, current_date + 100, current_date + 102, 0),
                                       (%L, 8, current_date + 100, current_date + 102, 0)$$,
                                :alice, :alice, :alice)),
            3, 'can hold 3 upcoming bookings');
select t.throws(format($$insert into bookings (user_id, car_id, pickup_at, return_at, total_price)
                         values (%L, 6, current_date + 100, current_date + 102, 0),
                                (%L, 7, current_date + 100, current_date + 102, 0),
                                (%L, 8, current_date + 100, current_date + 102, 0),
                                (%L, 9, current_date + 100, current_date + 102, 0)$$,
                       :alice, :alice, :alice, :alice),
                'CR001', 'cannot hoard: a 4th upcoming booking is rejected');

select t.eq(t.affected($$update profiles set role = 'admin'$$),
            0, 'cannot promote herself to admin');
select t.throws(format($$insert into profiles (id, role) values (%L, 'admin')$$,
                       gen_random_uuid()),
                '42501', 'cannot insert an admin profile');
select t.eq(t.affected('update cars set daily_rate = 1'), 0, 'cannot change prices');
select t.throws($$insert into cars (category_id, make, model, year, color, seats, transmission, daily_rate)
                  values (1, 'Fake', 'Car', 2024, 'Red', 4, 'manual', 1)$$,
                '42501', 'cannot add a car');
select t.eq(t.affected('update cars set is_active = false'), 0, 'cannot deactivate cars');

reset role;


-- ===========================================================================
-- 8. Another customer: bob
-- ===========================================================================
select t.section('RLS: other customer');
select t.act_as('authenticated', :bob);

select t.eq((select count(*) from bookings where user_id = :alice), 0::bigint, 'cannot see alice''s booking');
select t.eq(t.affected($$update bookings set status = 'cancelled' where car_id = 5$$),
            0, 'cannot cancel alice''s booking');

reset role;


-- ===========================================================================
-- 9. Admin
-- ===========================================================================
select t.section('RLS: admin');
select t.act_as('authenticated', :admin);

select t.eq(is_admin(), true, 'is_admin() is true');
select t.eq((select count(*) from bookings), 5::bigint, 'sees every booking');
select t.eq((select count(*) from cars), 12::bigint, 'sees inactive cars too');
select t.eq((select count(*) from profiles), 3::bigint, 'sees every profile');
select t.eq(t.affected($$update bookings set status = 'confirmed' where id = 2$$),
            1, 'can confirm a booking');
select t.eq(t.affected($$update cars set daily_rate = 45 where id = 1$$),
            1, 'can change prices');
select t.eq(t.affected($$update cars set is_active = true where id = 3$$),
            1, 'can reactivate a car');
select t.eq(t.affected(format($$update profiles set role = 'admin' where id = %L$$, :bob)),
            1, 'can promote a user');
select t.eq(t.affected($$delete from bookings where id = 3$$),
            1, 'can delete a booking');
-- What the Flask admin endpoints do, through the admin's own client (g.db).
select t.eq(t.affected($$insert into cars (category_id, make, model, year, color, seats, transmission, daily_rate)
                         values (2, 'Honda', 'Civic', 2025, 'Blue', 5, 'automatic', 55)$$),
            1, 'can add a car');
select t.eq(t.affected($$update bookings set status = 'returned' where id = 1$$),
            1, 'can mark a booking returned');
select t.eq(t.affected($$update cars set image_url = 'x', model = 'Corolla Hybrid' where id = 1$$),
            1, 'can edit car details');

reset role;


-- ===========================================================================
-- 10. service_role (Flask admin client)
-- ===========================================================================
select t.section('RLS: service_role');
select t.act_as('service_role', null);

select t.eq((select count(*) from bookings), 5::bigint, 'bypasses RLS on bookings');
select t.eq((select count(*) from cars), 12::bigint, 'bypasses RLS on cars');

reset role;


-- ===========================================================================
-- 11. Nothing leaked through
-- ===========================================================================
select t.section('final state');

select t.eq((select role from profiles where id = :alice), 'customer', 'alice is still a customer');
select t.eq((select daily_rate from cars where id = 1), 42.00::numeric, 'car 1 price untouched');
select t.eq((select status from bookings where car_id = 5), 'cancelled', 'alice''s booking is cancelled');
select t.eq((select total_price from bookings where car_id = 5), 186.00::numeric,
            'alice''s cancelled booking kept its price');


-- ===========================================================================
-- Report
-- ===========================================================================
\o
\set QUIET 0
\pset footer off
select case when ok then 'PASS' else 'FAIL' end as result,
       section, label,
       case when ok then '' else coalesce(detail, '') end as detail
from t.results
order by id;

select count(*) filter (where ok)     as passed,
       count(*) filter (where not ok) as failed
from t.results;

do $$
begin
  if exists (select 1 from t.results where not ok) then
    raise exception 'database tests failed';
  end if;
end $$;
