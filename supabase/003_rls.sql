-- ===========================================================================
-- CarRental — Row Level Security
--
-- Run this in the Supabase SQL Editor AFTER 001 and 002.
-- Safe to re-run: every policy is dropped before being recreated.
--
-- WHY THIS MATTERS
-- The anon key is embedded in the React bundle, so it is public. Without RLS,
-- anyone who opens DevTools can read every booking, rewrite your pricing, and
-- insert a confirmed booking for $0.01. RLS is what stops that — not the
-- Flask code, which can always be bypassed by calling Supabase directly.
--
-- !! READ THIS BEFORE RUNNING !!
-- Your 3 seed bookings have user_id = NULL, so after this runs they belong to
-- nobody and will disappear from "My bookings" for every user. That is
-- correct behaviour. Section 7 shows how to claim them for your own account
-- once you have signed up, so you still have demo data.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Profiles
--
-- Supabase owns auth.users and we cannot add columns to it, so roles live in
-- our own table keyed by the same id.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  role       text not null default 'customer'
             check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);


-- Create a profile automatically whenever someone signs up, so there is never
-- a logged-in user without one.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- Backfill profiles for anyone who signed up before this script ran.
insert into profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- 2. is_admin() helper
--
-- SECURITY DEFINER IS REQUIRED. A policy on `profiles` that itself queries
-- `profiles` causes infinite recursion and every query fails with
-- "infinite recursion detected in policy". Running as the owner skips RLS
-- inside the function and breaks the loop.
-- ---------------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;


-- ---------------------------------------------------------------------------
-- 3. Turn RLS on
--
-- Until a policy grants access, everything is denied. Order matters: enable
-- first, then add policies.
-- ---------------------------------------------------------------------------
alter table car_categories enable row level security;
alter table cars           enable row level security;
alter table bookings       enable row level security;
alter table profiles       enable row level security;


-- ---------------------------------------------------------------------------
-- 4. car_categories — public read, admin write
-- ---------------------------------------------------------------------------
drop policy if exists categories_public_read on car_categories;
create policy categories_public_read on car_categories
  for select
  using (true);

drop policy if exists categories_admin_write on car_categories;
create policy categories_admin_write on car_categories
  for all
  using (is_admin())
  with check (is_admin());


-- ---------------------------------------------------------------------------
-- 5. cars — anyone sees active cars, admins see and change everything
--
-- This also closes the /api/cars/:id hole: an inactive car is now invisible
-- to the public at the database level, not just filtered in the app.
-- ---------------------------------------------------------------------------
drop policy if exists cars_public_read on cars;
create policy cars_public_read on cars
  for select
  using (is_active or is_admin());

drop policy if exists cars_admin_write on cars;
create policy cars_admin_write on cars
  for all
  using (is_admin())
  with check (is_admin());


-- ---------------------------------------------------------------------------
-- 6. bookings — yours and only yours
--
-- Policies are OR'd together, so the customer and admin rules coexist.
-- ---------------------------------------------------------------------------

-- Read: your own, or anything if you are an admin.
drop policy if exists bookings_read_own on bookings;
create policy bookings_read_own on bookings
  for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

-- Create: only for yourself. `with check` is evaluated on the NEW row, so a
-- user cannot insert a booking owned by somebody else.
-- The 002 trigger overwrites total_price and forces status to 'pending',
-- so there is nothing to gain by lying about either.
drop policy if exists bookings_insert_own on bookings;
create policy bookings_insert_own on bookings
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Cancel: a customer may move their own pending/confirmed booking to
-- 'cancelled' and nothing else. `using` filters which rows they may touch;
-- `with check` constrains what the row may become — which is what stops
-- someone self-approving a pending booking into 'confirmed'.
drop policy if exists bookings_cancel_own on bookings;
create policy bookings_cancel_own on bookings
  for update
  to authenticated
  using (user_id = auth.uid() and status in ('pending', 'confirmed'))
  with check (user_id = auth.uid() and status = 'cancelled');

-- `with check` above only looks at status and user_id, so on its own it would
-- let a customer slip `total_price = 0` or a different car_id into the same
-- UPDATE that cancels. Policies can't compare old and new values, so close it
-- with column privileges instead: through the API, status is the only column
-- of a booking anyone can change. (Fixing dates or car is a SQL Editor /
-- service_role job.)
revoke update on bookings from anon, authenticated;
grant update (status) on bookings to authenticated;

-- Admins may set any status.
drop policy if exists bookings_admin_update on bookings;
create policy bookings_admin_update on bookings
  for update
  using (is_admin())
  with check (is_admin());

-- Deleting is admin-only. Customers cancel; they do not erase history.
drop policy if exists bookings_admin_delete on bookings;
create policy bookings_admin_delete on bookings
  for delete
  using (is_admin());


-- ---------------------------------------------------------------------------
-- 7. profiles — read your own; only admins change roles
--
-- Deliberately no self-update policy. If users could update their own row
-- they could set role = 'admin' and grant themselves the whole database.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_read_own on profiles;
create policy profiles_read_own on profiles
  for select
  to authenticated
  using (id = auth.uid() or is_admin());

drop policy if exists profiles_admin_write on profiles;
create policy profiles_admin_write on profiles
  for all
  using (is_admin())
  with check (is_admin());


-- ===========================================================================
-- 8. MANUAL STEPS — do these after signing up in the app
-- ===========================================================================

-- (a) Make yourself an admin. Replace the email with the one you signed up
--     with, then run just this statement:
--
--     update profiles set role = 'admin'
--     where email = 'you@example.com';

-- (b) Claim the 3 seed bookings so they show up under your account.
--     Without this, "My bookings" is empty because those rows have no owner:
--
--     update bookings
--     set user_id = (select id from auth.users where email = 'you@example.com')
--     where user_id is null;

-- (c) Confirm it all worked:
--
--     select tablename, rowsecurity from pg_tables
--     where schemaname = 'public' order by tablename;
--     -- rowsecurity must be true for all four tables
--
--     select tablename, policyname, cmd from pg_policies
--     where schemaname = 'public' order by tablename, policyname;
--     -- expect 11 policies


-- ---------------------------------------------------------------------------
-- 9. Verify RLS is actually on
-- ---------------------------------------------------------------------------
select
  tablename,
  rowsecurity as rls_enabled,
  (select count(*) from pg_policies p
   where p.schemaname = 'public' and p.tablename = t.tablename) as policies
from pg_tables t
where schemaname = 'public'
  and tablename in ('cars', 'car_categories', 'bookings', 'profiles')
order by tablename;
