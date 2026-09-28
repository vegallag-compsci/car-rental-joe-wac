# CarRental

Front end for a car rental website. React + Vite, plain CSS.

This is the **visual layer only** — there is no authentication, no real booking
logic, and no backend. Every page renders from hard-coded mock data. Supabase
and auth get wired up later.

## Running it

The app lives in the `my-react-app/` folder, not the repo root:

```bash
cd my-react-app
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

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

## Project layout

```
my-react-app/src/
  data/mockCars.js     all mock data + small helpers — the file to swap for Supabase
  components/          CarCard, CategoryBadge, StatusBadge, SearchBar, Nav, Footer, ScrollToTop
  pages/               one file per route
  index.css            all styling; design tokens live at the top in :root
```

## Design notes

- Black and white palette with soft grays, frosted "liquid glass" panels
  (`backdrop-filter`), rounded corners, subtle hover lift.
- Light and dark mode both supported via `prefers-color-scheme` — colors are
  CSS custom properties defined once in `:root` and overridden for dark.
- Responsive: single column on phones, grid on desktop.
- No Tailwind or UI libraries, so anyone on the team can edit the CSS directly.

## Before we connect Supabase

1. **Filters live in the URL** (`/cars?category=3&sort=price-asc`), not in
   component state. Read those params and push them into the query rather than
   filtering the array client-side.
2. **Dates are collected but don't filter anything yet.** There's no
   availability data in the mock. Real availability means querying `bookings`
   for overlapping date ranges — the main missing piece of logic.
3. **`is_active` is only respected on `/cars`.** Hitting `/cars/:id` directly
   still renders an inactive car. Needs a guard.
4. **`Bookings` and `Admin` keep local copies of the mock data** so their
   buttons visibly respond. Both reset on refresh — replace with fetched data
   plus a real mutation.
5. **Money is whole dollars.** If the real schema uses cents, `formatMoney` in
   `mockCars.js` is the one place to change.
6. **`BrowserRouter` needs an SPA rewrite on the host.** Fine in dev, but static
   hosting needs a catch-all to `index.html` or `/cars/9` will 404.

## Database columns

The mock data in `mockCars.js` uses our real column names, so swapping the
source out shouldn't require touching the components.

- **cars** — `id`, `category_id`, `make`, `model`, `year`, `color`, `seats`,
  `transmission` (`'automatic' | 'manual'`), `mileage`, `daily_rate`,
  `image_url`, `is_active`
- **car_categories** — `id`, `name` (1 Economy, 2 Sedan, 3 SUV, 4 Luxury, 5 Van)
- **bookings** — `id`, `car_id`, `pickup_at`, `return_at`, `status`,
  `total_price`
