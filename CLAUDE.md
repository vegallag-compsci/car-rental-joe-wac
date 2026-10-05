# CLAUDE.md — CarRental

Context for Claude sessions working in this repo. Read this first; it covers
what is not obvious from the code. Human-facing setup lives in
[README.md](README.md) and [api/README.md](api/README.md).

## What this is

A car rental website built as a student team project (Syracuse). Customers
browse cars, search by date and category, book, and cancel. Admins manage the
fleet and booking statuses.

```
React + Vite (my-react-app/)  --HTTP/JSON-->  Flask (api/)  --supabase-py-->  Supabase (Postgres + Auth + RLS)
```

The developer works on **Windows 11** (PowerShell primary; Git Bash also
available). PostgreSQL 18 is installed locally at
`C:\Program Files\PostgreSQL\18\bin` and is used for database tests only. The
real data lives in Supabase.

## Current status (update this section as work lands)

| Layer | State |
| --- | --- |
| Database (`supabase/`) | **Done.** 001–003 applied to the live Supabase project. 76/76 local tests pass. |
| Flask API (`api/`) | **Public, customer, auth, and admin routes done.** `verify.py` passes against live Supabase. Admin routes (`routes/admin.py`) are tested for 401/403/validation and the RLS backstop, but not yet with a real admin login. |
| React UI (`my-react-app/`) | **On the API.** Mock data is gone. Every page loads through `src/api/*` + `useAsync`. Admin page (`pages/Admin.jsx` + `pages/admin/*Panel.jsx`) has three tabs: Fleet (add/edit/toggle), Bookings (approve, pick-up, return, decline/cancel, reopen), Users (email search, grant/remove admin). Not yet clicked through with a real admin login. |
| Auth | **Google only, run through Flask** (`api/app/routes/auth.py`, PKCE). React has no Supabase SDK or keys: `src/auth/` holds the session (access token in memory, refresh token in localStorage) and `useAuth()`. Needs the Supabase Redirect URL set (see `api/.env.example`). Not yet tested with a real Google login. |

### Roadmap, in order

1. ~~Public pages on the API~~ (done; `/cars` is the reference pattern).
2. ~~Login~~ (done; Google via Flask). Still to do by hand: sign in once with
   a real Google account, then run the manual steps in section 8 of
   `supabase/003_rls.sql` (make yourself admin, claim the seed bookings).
3. Real bookings: the UI is already wired (create from CarDetails, list and
   cancel on `/bookings`). It needs a manual test as a logged-in user.
4. ~~Admin~~ (endpoints and UI done; all `@require_admin` + `g.db`).
   Keep using `g.db`; `get_admin_client()` (service_role) is still unused and
   `SUPABASE_SERVICE_ROLE_KEY` unset, which is the safer state.
5. Cleanup: fix car #2's `transmission = 'AutoManual'` (then tighten the
   CHECK; instructions are in 001), make `bookings.user_id` NOT NULL once
   every row has an owner, then deploy.

## Repo layout

```
my-react-app/                 React 19, Vite 8, react-router-dom 7, oxlint. No UI libs, no Tailwind.
  src/App.jsx                 routes: / /cars /cars/:id /bookings /login /admin *
  src/pages/                  one file per route
  src/components/             CarCard, CategoryBadge, StatusBadge, SearchBar, Nav, Footer, ScrollToTop,
                              LoadState (shared loading / error + retry placeholder)
  src/utils/format.js         formatMoney, formatDate, daysBetween, dateInDays, getCarLabel
  src/data/reviews.js         /reviews content (sample reviews, static, edited by hand; not in the DB)
  src/api/client.js           fetch wrapper: base URL, Bearer token, ApiError(status, code)
  src/api/cars.js, bookings.js  one function per endpoint
  src/hooks/useAsync.js       { loading, data, error, reload, setData } with AbortController
  src/hooks/useCategories.js  categories fetched once and shared; { categories, getCategoryName }
  src/api/auth.js             googleLoginUrl, refreshSession, getMe, logout
  src/auth/                   session.js (token storage + refresh), AuthProvider.jsx, AuthContext.js (useAuth)
  src/pages/AuthCallback.jsx  /auth/callback: reads the #tokens Flask sends back after Google
  src/index.css               ALL styling; design tokens in :root, dark mode via prefers-color-scheme
  vite.config.js              port 5173, strictPort (see gotchas)

api/                          Flask 3, flask-cors, supabase-py 2, python-dotenv. venv at api/.venv
  run.py                      dev server -> http://localhost:5000
  verify.py                   read-only stack self-check against live Supabase
  app/__init__.py             create_app() factory
  app/config.py               the only place env vars are read; validates at startup
  app/supabase_client.py      get_client() / get_user_client(token) / get_admin_client()
  app/auth.py                 @require_auth -> g.user, g.user_id, g.db (user-scoped client)
  app/queries.py              EVERY database call lives here
  app/validation.py           input parsing -> 400s
  app/errors.py               single JSON error shape; maps Postgres codes to HTTP
  app/routes/                 health.py, auth.py (Google login), cars.py, bookings.py, admin.py; register in routes/__init__.py BLUEPRINTS
  app/auth.py                 @require_auth, @require_admin (403 for UX; RLS is the real check)

supabase/
  001_schema_and_seed.sql     tables, seed rows, no-overlap exclusion constraint. DROPS TABLES - destructive.
  002_functions.sql           available_cars() RPC, set_booking_price() trigger. Re-runnable.
  003_rls.sql                 profiles, is_admin(), RLS policies, column grants. Re-runnable.
  local/                      local PostgreSQL test harness (see "Verifying changes")
```

## Data model

- **car_categories**: `id`, `name`. Values: 1 Economy, 2 Sedan, 3 SUV, 4 Luxury, 5 Van, 6 DaBaby.
- **cars**: `id`, `category_id`, `make`, `model`, `year`, `color`, `seats`,
  `transmission` (`automatic` | `manual`, plus legacy `AutoManual`), `mileage`,
  `daily_rate numeric(10,2)`, `image_url`, `is_active`, `created_at`. 12 seed
  cars; car 3 is inactive.
- **bookings**: `id`, `user_id -> auth.users` (nullable for now), `car_id`,
  `pickup_at date`, `return_at date`, `status` (`pending` | `confirmed` |
  `active` | `returned` | `cancelled`), `total_price`, `created_at`.
  `return_at > pickup_at`. 3 seed bookings with `user_id = NULL`.
- **profiles**: `id -> auth.users`, `email`, `role` (`customer` | `admin`).
  Created automatically by the `on_auth_user_created` trigger.

The API returns rows with these **exact** column names, and components read
them directly. `GET /api/bookings` also embeds `car: {id, make, model, year,
image_url}`. That field is null if RLS hides the car because it was deactivated.

## Invariants: do not break these

1. **RLS is the security boundary, not Flask.** The anon key ships in the React
   bundle, so anyone can call Supabase REST directly and skip Flask. Any rule
   that matters must be enforced in SQL (policy, trigger, constraint, or
   grant). Flask checks are UX only (clearer errors).
2. **Prices are computed by the database.** The `set_booking_price` trigger
   overwrites `total_price = daily_rate × nights` and forces new bookings to
   `pending`. Never accept `total_price` or `status` from a client.
3. **Double booking is prevented by the `bookings_no_overlap` exclusion
   constraint** (`daterange [)`, live statuses only). A booking ending the day
   another starts is allowed. Postgres raises `23P01`, which Flask maps to 409.
   Do not replace this with an app-level check.
4. **Through the API, `status` is the only updatable column on bookings**
   (column grant in 003). Customers may only move their own
   pending/confirmed booking to `cancelled`. Changing dates or car is a SQL
   Editor / service_role operation.
   **Booking limits live in the database too** (`enforce_booking_limits`
   trigger in 002): pickup not in the past (1 day UTC slack), at most 365
   days ahead, at most 30 nights, at most 3 upcoming live bookings per user
   (SQLSTATE `CR001` -> 409). They stop one account hoarding the fleet.
   Flask repeats the date rules in `validation.check_booking_window` for
   clearer messages; keep the numbers in sync.
5. **Inactive cars cannot be booked.** The trigger enforces this (`23514`), and
   RLS hides them from non-admins.
6. **`available_cars()` and `set_booking_price()` must stay
   `SECURITY DEFINER` with `set search_path = public`.** Without that,
   `available_cars` cannot see bookings under RLS and silently reports every
   car as free. `is_admin()` is SECURITY DEFINER to avoid policy recursion.
7. **Pick the Supabase client deliberately.** In `@require_auth` routes use
   `g.db` so `auth.uid()` resolves to the caller. `get_admin_client()` bypasses
   RLS; reaching for it to "make a query work" usually means a policy is
   missing.
   Login, refresh, and logout use `get_auth_client()` (a fresh client each
   time), **never** the cached `get_client()`. A supabase-py client that
   completes a sign-in switches itself to that user's token, so using the
   shared one would make all later anonymous requests act as that user.
8. **Never put the service_role key in the front end.** Only `VITE_*` vars
   reach the browser, and they are inlined into the bundle.
9. Do not commit `api/.env`, `my-react-app/.env.local`, or `.venv/` (all
   gitignored).

## Conventions

- **Python:** routes handle HTTP, `queries.py` handles data. Each query takes
  the client as its first arg. Raise `ApiError(message, status)` for expected
  failures. Every error response is
  `{"error": {"message": ..., "code": ...}}`.
- **New endpoint group:** create `app/routes/<name>.py` with a `bp` blueprint
  and add it to `BLUEPRINTS` in `app/routes/__init__.py`.
- **React:** components never call `fetch`; go through `src/api/*` →
  `request()`. Use `useAsync((signal) => apiFn({ ..., signal }), [deps])` so
  stale requests are aborted. Filters live in the URL query string
  (`/cars?category=3&sort=price-asc`), which maps 1:1 onto the API params.
  Sort keys are `price-asc`, `price-desc`, `newest`.
- **Dates** are `YYYY-MM-DD` strings end to end. Nights =
  `return - pickup` (`daysBetween` in JS, `days_between` in Python; keep them
  in sync).
- **Money:** `daily_rate` / `total_price` are `numeric(10,2)` and display as
  whole dollars via `formatMoney`.
- **CSS:** plain CSS in `index.css`. Black/white/gray palette, frosted
  "liquid glass" panels (`backdrop-filter`), light and dark mode via tokens
  on `:root`. Responsive: one column on phones.
- **SQL changes:** edit the numbered file (keep 002/003 re-runnable with
  `create or replace` / `drop ... if exists`), add or adjust tests in
  `supabase/local/tests.sql`, run them, and tell the user to re-run the file in
  the Supabase SQL Editor. Never tell them to re-run 001 on a live project:
  it drops all tables and data, after which 002 and 003 must be re-applied.
- Match the existing comment style: explain *why*, especially for security
  decisions.

## Running

```powershell
# API (terminal 1)
cd api; .venv\Scripts\activate; python run.py          # http://localhost:5000/api/health

# Front end (terminal 2)
cd my-react-app; npm run dev                           # http://localhost:5173
npm run lint; npm run build                            # oxlint, production build
```

## Verifying changes

| What changed | Run | Notes |
| --- | --- | --- |
| Any `supabase/*.sql` | `./supabase/local/run-tests.ps1` (repo root) | Rebuilds the throwaway `carrental_test` DB, applies shim + 001→003 (002/003 twice for idempotency), runs `tests.sql` as anon / customer / admin / service_role. Password comes from `%APPDATA%\postgresql\pgpass.conf`. Exits non-zero on failure. Never touches Supabase. |
| API or live DB | `cd api; .venv\Scripts\python.exe verify.py` | Read-only checks against live Supabase. Set `PYTHONIOENCODING=utf-8` in PowerShell. Cannot test logged-in behaviour (it has no user token); the local SQL tests cover that. |
| Front end | `npm run build` and `npm run lint` in `my-react-app/` | No test framework yet. |

`supabase/local/00_supabase_shim.sql` fakes the parts of Supabase the
migrations need (`auth.users`, `auth.uid()` reading `request.jwt.claim.sub`,
the `anon` / `authenticated` / `service_role` roles, Supabase-style default
grants). RLS tests must run as those roles via `t.act_as(...)`, never as the
superuser, which bypasses RLS and would make every test pass.

## Gotchas

- Under RLS a disallowed **SELECT/UPDATE/DELETE returns zero rows, not an
  error**. Only INSERT (and UPDATE failing `WITH CHECK`) raises `42501`. Test
  RLS by row counts, not just exceptions.
- Vite uses `strictPort`. If 5173 is busy it fails instead of moving to 5174,
  because 5174 is not in `CORS_ORIGINS` and would surface as a confusing CORS
  error.
- Vite inlines `VITE_*` env vars at build time, so restart `npm run dev` after
  editing `.env.local`.
- `BrowserRouter` needs a host-side catch-all rewrite to `index.html` when
  deployed, or deep links like `/cars/9` 404.
- The seed bookings have no owner, so "My bookings" is empty for every user
  until they are claimed (003 section 8b).
- The developer prefers to run `git commit` / `git push` themselves. Give them
  the commands rather than committing, unless they ask you to.
