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
| GET | `/api/bookings` | ✅ | The caller's own bookings |
| POST | `/api/bookings` | ✅ | `{ car_id, pickup_at, return_at }` |
| POST | `/api/bookings/:id/cancel` | ✅ | Sets status to `cancelled` |

Passing **both** `pickup` and `return` to `/api/cars` returns only cars with
no overlapping booking. That path calls the `available_cars` function from
`supabase/002_functions.sql`, so run that file first.

Authenticated endpoints need the user's Supabase JWT:

```
Authorization: Bearer <token>
```

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
      cars.py
      bookings.py
```

**Routes handle HTTP, `queries.py` handles data.** Keep database calls out of
route functions so they can be reused and read in one place.

To add an endpoint group: create `routes/thing.py` with a `bp` blueprint, then
add it to `BLUEPRINTS` in `routes/__init__.py`. That's the only wiring.
