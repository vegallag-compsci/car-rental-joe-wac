"""All Supabase data access lives here.

Routes handle HTTP (parsing, status codes); this module handles data. Keeping
them apart means a query can be reused by several endpoints, and you can read
every database call the app makes by scanning one file.

Each function takes the client to use as its first argument, so the caller
decides whether a query runs as anonymous, as a user, or as admin.
"""

from postgrest.exceptions import APIError

from .errors import ApiError

# Columns we expose. Listing them explicitly means adding an internal column
# to the table later doesn't accidentally leak it through the API.
CAR_FIELDS = (
    "id, category_id, make, model, year, color, seats, transmission, "
    "mileage, daily_rate, image_url, is_active"
)
BOOKING_FIELDS = "id, car_id, pickup_at, return_at, status, total_price, created_at"

# Bookings plus the car they're for, embedded via the car_id foreign key, so
# the "My bookings" page needs one request instead of one per booking. `car`
# is null if RLS hides the car (it was deactivated after being booked).
BOOKING_WITH_CAR_FIELDS = (
    f"{BOOKING_FIELDS}, car:cars(id, make, model, year, image_url)"
)

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
        .select(BOOKING_WITH_CAR_FIELDS)
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


# --- profiles --------------------------------------------------------------

def get_role(db, user_id):
    """The user's role ('customer' or 'admin'). Expects that user's client.

    profiles_read_own lets a user read only their own row. The row is created
    by the on_auth_user_created trigger, so it should always exist; default to
    'customer' rather than fail if it somehow doesn't.
    """
    rows = (
        db.table("profiles")
        .select("role")
        .eq("id", user_id)
        .limit(1)
        .execute()
        .data
    )
    return rows[0]["role"] if rows else "customer"


# --- admin -----------------------------------------------------------------
#
# Every function here expects the ADMIN USER'S OWN client (g.db from
# @require_admin), never get_admin_client(). The cars_admin_write,
# bookings_admin_update and profiles_admin_write policies let an admin do all
# of this, so the service_role key isn't needed, and if a non-admin's client
# ever got here RLS would refuse it.
#
# Under RLS a refused UPDATE changes zero rows instead of raising, which is
# why "no rows came back" is reported as a 404.

ADMIN_BOOKING_FIELDS = f"{BOOKING_WITH_CAR_FIELDS}, user_id"


def _emails_for(db, user_ids):
    """{user id: email} for the given ids, in one query.

    bookings.user_id and audit_log.actor_id don't have a foreign key the REST
    API can embed through, so emails are looked up separately rather than
    one request per row. Ids with no profile (e.g. a deleted user) are absent.
    """
    ids = sorted({user_id for user_id in user_ids if user_id})
    if not ids:
        return {}
    profiles = db.table("profiles").select("id, email").in_("id", ids).execute().data
    return {p["id"]: p["email"] for p in profiles}


def create_car(db, fields):
    rows = db.table("cars").insert(fields).execute().data
    if not rows:
        raise ApiError("Could not create that car.", 500)
    return rows[0]


def update_car(db, car_id, fields):
    """Change some of a car's columns, e.g. {"is_active": False}.

    There is deliberately no delete: bookings reference cars, and history
    should survive. Deactivate a car to take it out of service.
    """
    rows = db.table("cars").update(fields).eq("id", car_id).execute().data
    if not rows:
        raise ApiError(f"No car with id {car_id}.", 404)
    return rows[0]


def list_all_bookings(db, *, status=None):
    """Every booking, newest pickup first, with its car and customer email."""
    query = db.table("bookings").select(ADMIN_BOOKING_FIELDS)
    if status:
        query = query.eq("status", status)
    bookings = query.order("pickup_at", desc=True).execute().data

    emails = _emails_for(db, (b["user_id"] for b in bookings))
    for booking in bookings:
        # None for the unowned seed bookings.
        booking["customer_email"] = emails.get(booking["user_id"])
    return bookings


def set_booking_status(db, booking_id, status):
    """Admins may move a booking to any status (bookings_admin_update).

    Only `status` is sent. The column grant in 003 means it's the only
    booking column anyone can update through the API anyway; changing dates
    or the car is a SQL Editor job.
    """
    try:
        rows = (
            db.table("bookings")
            .update({"status": status})
            .eq("id", booking_id)
            .execute()
            .data
        )
    except APIError as err:
        # Reviving a cancelled booking can collide with one made since. The
        # default 23P01 message is written for customers, so say it plainly.
        if err.code == "23P01":
            raise ApiError(
                "Another live booking already holds those dates for this car.", 409
            )
        raise
    if not rows:
        raise ApiError(f"No booking with id {booking_id}.", 404)
    return rows[0]


USER_SEARCH_LIMIT = 25


def _escape_like(text):
    """Make LIKE's wildcards (% and _) match literally.

    Without this, searching "a_b" would also match "axb", and "%" alone
    would list everyone. (PostgREST also treats * as a wildcard and has no
    escape for it; emails essentially never contain one.)
    """
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def list_profiles(db, *, email=None):
    """Profiles, optionally those whose email contains `email` (any case)."""
    query = db.table("profiles").select("id, email, role, created_at")
    if email:
        query = query.ilike("email", f"%{_escape_like(email)}%")
    return query.order("email").limit(USER_SEARCH_LIMIT).execute().data


def set_role(db, user_id, role):
    rows = (
        db.table("profiles")
        .update({"role": role})
        .eq("id", user_id)
        .execute()
        .data
    )
    if not rows:
        raise ApiError("No user with that id.", 404)
    return rows[0]


AUDIT_FIELDS = "id, actor_id, action, target_type, target_id, metadata, ip_address, created_at"
AUDIT_PAGE_SIZE = 50


def list_audit_log(db, *, target_type=None, before_id=None):
    """One page of the audit log, newest first.

    Rows are written by database triggers (supabase/004_audit_log.sql), never
    by Flask, and audit_log_admin_read lets only admins read them.

    Pages by id (`before_id` = the last id already shown) rather than offset,
    so entries logged while someone is paging don't shift or repeat rows.
    Adds `actor_email`, and `target_email` for entries about a user.
    """
    query = db.table("audit_log").select(AUDIT_FIELDS)
    if target_type:
        query = query.eq("target_type", target_type)
    if before_id is not None:
        query = query.lt("id", before_id)
    # One extra row says whether another page exists, without a count query.
    rows = query.order("id", desc=True).limit(AUDIT_PAGE_SIZE + 1).execute().data
    entries = rows[:AUDIT_PAGE_SIZE]

    user_targets = [e["target_id"] for e in entries if e["target_type"] == "user"]
    emails = _emails_for(db, [e["actor_id"] for e in entries] + user_targets)
    for entry in entries:
        entry["actor_email"] = emails.get(entry["actor_id"])
        if entry["target_type"] == "user":
            entry["target_email"] = emails.get(entry["target_id"])

    return {"entries": entries, "has_more": len(rows) > AUDIT_PAGE_SIZE}
