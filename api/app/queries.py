"""All Supabase data access lives here.

Routes handle HTTP (parsing, status codes); this module handles data. Keeping
them apart means a query can be reused by several endpoints, and you can read
every database call the app makes by scanning one file.

Each function takes the client to use as its first argument, so the caller
decides whether a query runs as anonymous, as a user, or as admin.
"""

from .errors import ApiError

# Columns we expose. Listing them explicitly means adding an internal column
# to the table later doesn't accidentally leak it through the API.
CAR_FIELDS = (
    "id, category_id, make, model, year, color, seats, transmission, "
    "mileage, daily_rate, image_url, is_active"
)
BOOKING_FIELDS = "id, car_id, pickup_at, return_at, status, total_price, created_at"

SORT_OPTIONS = {
    "price-asc": ("daily_rate", False),
    "price-desc": ("daily_rate", True),
    "newest": ("year", True),
}

LIVE_BOOKING_STATUSES = ("pending", "confirmed", "active")
CANCELLABLE_STATUSES = ("pending", "confirmed")


# --- categories ------------------------------------------------------------

def list_categories(db):
    return db.table("car_categories").select("id, name").order("id").execute().data


# --- cars ------------------------------------------------------------------

def list_cars(db, *, category_id=None, sort=None, include_inactive=False):
    """Cars, optionally filtered by category and sorted.

    Does NOT consider availability — see list_available_cars for that.
    """
    query = db.table("cars").select(CAR_FIELDS)

    if not include_inactive:
        query = query.eq("is_active", True)
    if category_id is not None:
        query = query.eq("category_id", category_id)

    if sort in SORT_OPTIONS:
        column, descending = SORT_OPTIONS[sort]
        query = query.order(column, desc=descending)
    else:
        query = query.order("id")

    return query.execute().data


def list_available_cars(db, *, pickup, dropoff, category_id=None, sort=None):
    """Cars with no overlapping booking in the given date range.

    Calls the `available_cars` Postgres function, because "no overlapping
    booking" is a NOT EXISTS subquery that the REST API can't express.
    Requires supabase/002_functions.sql to have been run.
    """
    rows = db.rpc(
        "available_cars",
        {"p_pickup": pickup, "p_return": dropoff, "p_category": category_id},
    ).execute().data or []

    # The RPC returns whole rows, so sort here rather than in SQL.
    if sort in SORT_OPTIONS:
        column, descending = SORT_OPTIONS[sort]
        rows.sort(key=lambda row: row.get(column) or 0, reverse=descending)
    else:
        rows.sort(key=lambda row: row["id"])

    return rows


def get_car(db, car_id, *, include_inactive=False):
    """One car by id, or 404.

    Inactive cars are hidden by default. Once RLS is on, the database already
    hides them from non-admins — this is a second layer so the behaviour is
    the same in development and obvious when reading the code.

    Pass include_inactive=True when the caller needs the row regardless, e.g.
    create_booking, which wants to say "that car isn't available" rather than
    "no such car".
    """
    rows = db.table("cars").select(CAR_FIELDS).eq("id", car_id).limit(1).execute().data
    if not rows:
        raise ApiError(f"No car with id {car_id}.", 404)

    car = rows[0]
    if not car["is_active"] and not include_inactive:
        raise ApiError(f"No car with id {car_id}.", 404)
    return car


# --- bookings --------------------------------------------------------------

def list_bookings(db):
    """Bookings visible to this client.

    There is no user filter here on purpose: the `own bookings` RLS policy
    already restricts rows to auth.uid(). Pass a user client, and you get
    that user's bookings and nothing else.
    """
    return (
        db.table("bookings")
        .select(BOOKING_FIELDS)
        .order("pickup_at", desc=True)
        .execute()
        .data
    )


def get_booking(db, booking_id):
    rows = (
        db.table("bookings")
        .select(BOOKING_FIELDS)
        .eq("id", booking_id)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise ApiError(f"No booking with id {booking_id}.", 404)
    return rows[0]


def create_booking(db, *, user_id, car_id, pickup, dropoff, days):
    """Insert a booking, pricing it from the car's rate in the database.

    The price is never taken from the request. A client could claim any total,
    so we read daily_rate from the cars table and multiply it ourselves.

    Overlapping dates are rejected by the bookings_no_overlap constraint,
    which surfaces as a 409 via the APIError handler.
    """
    # include_inactive so we can give a clearer error than a bare 404.
    car = get_car(db, car_id, include_inactive=True)
    if not car["is_active"]:
        raise ApiError("That car is not available for booking.", 409)

    total_price = round(float(car["daily_rate"]) * days, 2)

    rows = (
        db.table("bookings")
        .insert(
            {
                "user_id": user_id,
                "car_id": car_id,
                "pickup_at": pickup,
                "return_at": dropoff,
                "status": "pending",
                "total_price": total_price,
            }
        )
        .execute()
        .data
    )
    if not rows:
        raise ApiError("Could not create that booking.", 500)
    return rows[0]


def cancel_booking(db, booking_id):
    """Mark a booking cancelled.

    RLS restricts this to the owner; we check status here only to return a
    clearer message than a silent no-op.
    """
    booking = get_booking(db, booking_id)
    if booking["status"] not in CANCELLABLE_STATUSES:
        raise ApiError(
            f"A {booking['status']} booking can't be cancelled.", 409
        )

    rows = (
        db.table("bookings")
        .update({"status": "cancelled"})
        .eq("id", booking_id)
        .execute()
        .data
    )
    if not rows:
        raise ApiError("Could not cancel that booking.", 500)
    return rows[0]


# --- admin -----------------------------------------------------------------

def set_car_active(db, car_id, is_active: bool):
    """Toggle a car's availability. Expects an admin client."""
    rows = (
        db.table("cars")
        .update({"is_active": is_active})
        .eq("id", car_id)
        .execute()
        .data
    )
    if not rows:
        raise ApiError(f"No car with id {car_id}.", 404)
    return rows[0]
