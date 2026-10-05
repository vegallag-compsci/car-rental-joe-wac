# CarRental

Car rental website. React + Vite front end, Flask API, Supabase database.

```
React (my-react-app/)  ──HTTP──>  Flask (api/)  ──>  Supabase (Postgres + Auth)
```

**Current state:** the Flask API and database are live and working. The React
pages still render from `mockCars.js` — connecting them to the API is the next
piece of work.

## Running it

You need **two terminals**.

**Terminal 1 — the API:**

```bash
cd api
python -m venv .venv                     # first time only
.venv\Scripts\activate                   # Windows
source .venv/bin/activate                # macOS / Linux
pip install -r requirements.txt          # first time only
cp .env.example .env                     # first time only, then paste your keys
python run.py
```

**Terminal 2 — the front end:**

```bash
cd my-react-app
npm install
npm run dev
```

Then open http://localhost:5173.

To check everything is wired up correctly:

```bash
cd api && python verify.py
```

## Database

Run these in the Supabase SQL Editor (dashboard → SQL Editor → New query →
paste → Run), in order:

| File | What it does |
| --- | --- |
| `supabase/001_schema_and_seed.sql` | Tables + the 12 seed cars |
| `supabase/002_functions.sql` | Availability search, server-side pricing |
| `supabase/003_rls.sql` | Row Level Security — **required before deploying** |

After 003, do the two manual steps in its Section 8: make yourself an admin,
and claim the seed bookings so they appear under your account.

Other commands, all run from `my-react-app/`:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run oxlint |

## Pages

| Route | Page |
| --- | --- |
| `/` | Home — hero, search bar, category tiles, how it works |
| `/cars` | Browse — filter bar and car grid |
| `/cars/:id` | Car details with a booking summary box |
| `/bookings` | My bookings |
| `/login` | Log in (UI only) |
| `/admin` | Fleet admin dashboard (UI only) |

## API endpoints

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/health` | — | Diagnostics |
| GET | `/api/categories` | — | All categories |
| GET | `/api/cars` | — | `?category=3&sort=price-asc&pickup=&return=` |
| GET | `/api/cars/:id` | — | One car |
| GET | `/api/auth/google` | — | Browser link that starts Google sign-in |
| POST | `/api/auth/refresh` | — | `{ refresh_token }` → new session |
| GET | `/api/auth/me` | ✅ | Current user and role |
| POST | `/api/auth/logout` | ✅ | End the session |
| GET | `/api/bookings` | ✅ | The caller's own bookings |
| POST | `/api/bookings` | ✅ | `{ car_id, pickup_at, return_at }` |
| POST | `/api/bookings/:id/cancel` | ✅ | Sets status to `cancelled` |

See [api/README.md](api/README.md) for the full backend guide.

## Project layout

```
my-react-app/src/
  data/mockCars.js     mock data — still what the pages render from
  api/                 client.js, cars.js, bookings.js — calls to the Flask API
  hooks/useAsync.js    loading / error / data, with request cancellation
  components/          CarCard, CategoryBadge, StatusBadge, SearchBar, Nav, Footer
  pages/               one file per route
  index.css            all styling; design tokens live at the top in :root

api/
  run.py               dev entry point
  verify.py            stack self-check
  app/
    config.py          env loading + startup validation
    supabase_client.py anonymous / user / admin clients
    auth.py            JWT verification, @require_auth
    queries.py         every database call
    validation.py      input parsing
    errors.py          one JSON error shape
    routes/            health, cars, bookings

supabase/
  001_schema_and_seed.sql
  002_functions.sql
  003_rls.sql
```

## Design notes

- Black and white palette with soft grays, frosted "liquid glass" panels
  (`backdrop-filter`), rounded corners, subtle hover lift.
- Light and dark mode both supported via `prefers-color-scheme` — colors are
  CSS custom properties defined once in `:root` and overridden for dark.
- Responsive: single column on phones, grid on desktop.
- No Tailwind or UI libraries, so anyone on the team can edit the CSS directly.

## What's left to do

1. ~~Connect the React pages to the API.~~ Done.
2. ~~Authentication.~~ Google sign-in through Flask is done. See "Google
   login" in [api/README.md](api/README.md) for the one-time dashboard setup.
3. ~~Admin.~~ Done: `/admin` has Fleet, Bookings, and Users tabs (see
   [api/README.md](api/README.md) for the endpoints).
4. **Deployment.** `BrowserRouter` needs a host-side catch-all rewrite to
   `index.html`, or `/cars/9` will 404. Flask needs hosting separately from
   the static front end.

## Notes for whoever picks this up

- **Filters live in the URL** (`/cars?category=3&sort=price-asc`), not in
  component state, so filtered views are shareable and the params map straight
  onto the API's query string.
- **Never trust a price from the client.** `POST /api/bookings` deliberately
  ignores `total_price`; a database trigger recomputes it from the car's rate.
- **RLS is the security boundary, not the Flask code.** The React app will
  hold the anon key, so it can call Supabase directly and bypass Flask
  entirely. Any rule that matters belongs in a policy in `003_rls.sql`.
- **Money is whole dollars.** If the schema moves to cents, `formatMoney` in
  `mockCars.js` is the one place to change on the front end.

## Database columns

The mock data in `mockCars.js` uses our real column names, so swapping the
source out shouldn't require touching the components.

- **cars** — `id`, `category_id`, `make`, `model`, `year`, `color`, `seats`,
  `transmission` (`'automatic' | 'manual'`), `mileage`, `daily_rate`,
  `image_url`, `is_active`
- **car_categories** — `id`, `name` (1 Economy, 2 Sedan, 3 SUV, 4 Luxury, 5 Van)
- **bookings** — `id`, `car_id`, `pickup_at`, `return_at`, `status`,
  `total_price`
