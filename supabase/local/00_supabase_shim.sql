-- ===========================================================================
-- Local stand-in for the parts of Supabase our migrations depend on.
--
-- Plain PostgreSQL has no `auth` schema, no auth.uid(), and none of the
-- anon / authenticated / service_role roles. This file creates minimal
-- versions of each so 001-003 run unmodified against a local database.
--
-- NEVER run this against a real Supabase project — it already has all of this.
-- ===========================================================================

-- Roles are cluster-wide, so only create them once.
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

-- Same lookup Supabase uses: PostgREST puts the JWT claims in a GUC.
-- Tests impersonate a user with:  set request.jwt.claim.sub = '<uuid>';
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid;
$$;

grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase grants every API role full table privileges by default and relies
-- on RLS to restrict them. Mirror that, or the tests would pass for the wrong
-- reason (a missing GRANT rather than a working policy).
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
