# CarRental API (Flask)

Python/Flask API that sits between the React app and Supabase.

```
React  ──HTTP──>  Flask  ──supabase-py──>  Supabase (Postgres + RLS + Auth)
```

## First-time setup

From the `api/` folder:

```bash
# 1. Create a virtual environment
python -m venv .venv

# 2. Activate it
.venv\Scripts\activate       # Windows (cmd / PowerShell)
source .venv/bin/activate    # macOS / Linux / Git Bash

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create your .env and paste your keys in
cp .env.example .env
```

Fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` from
**Supabase → Project Settings → API**. Leave `SUPABASE_SERVICE_ROLE_KEY`
blank unless you're building admin routes.

## Running it

```bash
python run.py
```

Then check it's healthy:

```
http://localhost:5000/api/health
```

That endpoint tells you whether Flask is up, whether your keys loaded, and
whether Supabase is actually reachable — check it first whenever something
looks broken.

## Verifying the whole stack

```bash
python verify.py
```

Checks config, Supabase connectivity, which SQL migrations have been applied,
whether RLS is actually protecting the database, and every API endpoint. It
prints a prioritised list of what to fix, and exits non-zero if anything is a
blocker.

Safe to run any time — it never creates, changes, or deletes a row. The
security probes deliberately violate a CHECK constraint, so the outcome shows
whether RLS stopped the request first, and nothing is ever written.

**Run this after applying any SQL migration** to confirm it took effect.

## Database setup

Run these in the Supabase SQL Editor, in order, before the API will fully
work:

| File | What it does | Required |
| --- | --- | --- |
| `supabase/001_schema_and_seed.sql` | Tables + the 12 seed cars | Yes |
| `supabase/002_functions.sql` | Availability search, server-side pricing | Yes |
| `supabase/003_rls.sql` | Row Level Security | **Yes — before deploying** |

Without 002, date filtering returns 501 and booking prices are whatever the
client claims. Without 003, the database is wide open to anyone holding the
anon key — which ships in the React bundle.

## Endpoints

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/health` | — | Diagnostics |
| GET | `/api/categories` | — | All categories |
| GET | `/api/cars` | — | `?category=3&sort=price-asc&pickup=&return=` |
| GET | `/api/cars/:id` | — | One car |
| GET | `/api/auth/google` | — | **Browser link, not fetch.** Starts Google sign-in. `?next=/path` |
| GET | `/api/auth/callback` | — | Supabase redirects here; never called by the app |
| POST | `/api/auth/refresh` | — | `{ refresh_token }` → new session |
| GET | `/api/auth/me` | ✅ | `{ id, email, name, avatar_url, role }` |
| POST | `/api/auth/logout` | ✅ | Revokes the session's refresh token |
| GET | `/api/bookings` | ✅ | The caller's own bookings, each with an embedded `car` |
| POST | `/api/bookings` | ✅ | `{ car_id, pickup_at, return_at }` |
| POST | `/api/bookings/:id/cancel` | ✅ | Sets status to `cancelled` |
| GET | `/api/admin/cars` | 🔒 | Whole fleet, including inactive cars |
| POST | `/api/admin/cars` | 🔒 | Create. Required: `category_id, make, model, year, color, seats, transmission, daily_rate` |
| PATCH | `/api/admin/cars/:id` | 🔒 | Any subset of the create fields, plus `mileage, image_url, is_active` |
| GET | `/api/admin/bookings` | 🔒 | Everyone's bookings with `car` and `customer_email`. `?status=pending` |
| PATCH | `/api/admin/bookings/:id` | 🔒 | `{ status }` only |
| GET | `/api/admin/users` | 🔒 | Profiles and roles. `?email=jane` matches part of the email, any case (max 25) |
| PATCH | `/api/admin/users/:uuid` | 🔒 | `{ role: "customer" \| "admin" }`. Not your own |

✅ = logged in. 🔒 = logged in as an admin (403 otherwise).

### How admin access is enforced

`@require_admin` returns a clear 403 for non-admins, but it is **not** the
security boundary. Admin queries run through `g.db`, the admin's own client,
so RLS's `is_admin()` policies decide. If the decorator were removed, a
customer would still read nothing and change nothing. Don't switch these
routes to `get_admin_client()`: that would make the decorator the only
protection.

Admin writes accept only listed fields (`validation.car_payload`), so `id`,
`created_at`, or a booking's `total_price` can't be set through the API. There
is no car DELETE on purpose: bookings reference cars, so deactivate instead.

Passing **both** `pickup` and `return` to `/api/cars` returns only cars with
no overlapping booking. That path calls the `available_cars` function from
`supabase/002_functions.sql`, so run that file first.

Authenticated endpoints need the user's Supabase JWT:

```
Authorization: Bearer <token>
```

## Google login

Google is the only sign-in method. The whole flow runs through Flask
(`app/routes/auth.py`), so the React app never talks to Supabase and needs no
Supabase keys:

```
React  --link-->  /api/auth/google  --302-->  Supabase  -->  Google
React  <--302 with #tokens--  /api/auth/callback  <--302 ?code=--  Supabase
```

It uses Supabase's PKCE flow: a one-time secret kept in an HttpOnly cookie
means a stolen `?code=` is useless in another browser. The session reaches
React in the URL **fragment** (`#access_token=...`), which browsers never send
to servers, and React clears it from the address bar immediately.

One-time setup (also listed in `.env.example`):

1. Supabase → Authentication → URL Configuration → **Redirect URLs**: add
   `http://localhost:5000/api/auth/callback` (that is `API_URL` +
   `/api/auth/callback`). If it's missing, Supabase silently sends users to
   the Site URL instead, and login appears to do nothing.
2. Google Cloud Console → your OAuth client → **Authorized redirect URIs**
   must include `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Recommended: turn the **Email** provider off in Supabase so Google is
   really the only way to create an account.

Auth calls use `get_auth_client()`, which makes a fresh client each time.
Never use the cached `get_client()` for them: a supabase-py client that
completes a sign-in switches itself to that user's token, which would make
every later anonymous request act as that user.

## Errors

Every failure has the same shape, so the frontend needs one error path:

```json
{ "error": { "message": "Those dates were just taken.", "code": "conflict" } }
```

## Which Supabase client to use

This is the most important thing to get right. `app/supabase_client.py` has
three, and the choice decides whether RLS protects you:

| Function | Acts as | Use for |
| --- | --- | --- |
| `get_client()` | anonymous | Public data — cars, categories |
| `get_user_client(token)` | the logged-in user | Anything user-owned |
| `get_admin_client()` | **service_role — ignores RLS** | Admin routes only |

In a route decorated with `@require_auth`, use `g.db` — it's already a client
scoped to that user, so `auth.uid()` in your RLS policies resolves correctly.

If you find yourself reaching for `get_admin_client()` to make a query work,
the actual problem is almost always a missing RLS policy.

## Layout

```
api/
  run.py                  dev entry point
  requirements.txt
  .env.example            copy to .env
  app/
    __init__.py           create_app() factory
    config.py             env loading + startup validation
    supabase_client.py    the three clients
    auth.py               JWT verification, @require_auth
    queries.py            every database call lives here
    validation.py         input parsing, 400s
    errors.py             one JSON error shape
    routes/
      health.py
      auth.py             Google login, refresh, me, logout
      admin.py            fleet, all bookings, user roles (@require_admin)
      cars.py
      bookings.py
```

**Routes handle HTTP, `queries.py` handles data.** Keep database calls out of
route functions so they can be reused and read in one place.

To add an endpoint group: create `routes/thing.py` with a `bp` blueprint, then
add it to `BLUEPRINTS` in `routes/__init__.py`. That's the only wiring.
