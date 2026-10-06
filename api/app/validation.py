"""Small input parsers.

Routes should never pass a raw query string into a query. These helpers turn
user input into the right type or raise a 400 with a readable message.
"""

import math
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlparse

from .errors import ApiError


def optional_int(raw, field: str):
    """Parse an optional integer query param."""
    if raw is None or raw == "" or raw == "all":
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        raise ApiError(f"'{field}' must be a whole number, got {raw!r}.", 400)


def optional_date(raw, field: str):
    """Parse an optional YYYY-MM-DD date, returned as a string.

    Kept as a string because that is what Postgres and the frontend's
    <input type="date"> both use. Parsing is purely for validation.
    """
    if not raw:
        return None
    try:
        datetime.strptime(raw, "%Y-%m-%d")
    except (TypeError, ValueError):
        raise ApiError(f"'{field}' must be a date like 2026-10-04, got {raw!r}.", 400)
    return raw


def required_date(raw, field: str) -> str:
    value = optional_date(raw, field)
    if value is None:
        raise ApiError(f"'{field}' is required.", 400)
    return value


def required_int(raw, field: str) -> int:
    value = optional_int(raw, field)
    if value is None:
        raise ApiError(f"'{field}' is required.", 400)
    return value


def days_between(pickup: str, dropoff: str) -> int:
    """Whole nights between two YYYY-MM-DD strings.

    Mirrors daysBetween() in the frontend's src/utils/format.js so the price the user
    was shown matches the price we charge.
    """
    start = date.fromisoformat(pickup)
    end = date.fromisoformat(dropoff)
    return (end - start).days


# --- admin payloads ----------------------------------------------------------
#
# The database has CHECK constraints for most of these, and they stay the real
# guarantee. Checking here as well turns a generic "violates a constraint" 400
# into one that names the field, and catches things SQL can't, such as a
# non-http image URL.

BOOKING_STATUSES = ("pending", "confirmed", "active", "returned", "cancelled")
ROLES = ("customer", "admin")
# Matches the target_type CHECK on audit_log (supabase/004_audit_log.sql).
AUDIT_TARGET_TYPES = ("car", "category", "booking", "user")
# Deliberately excludes the legacy 'AutoManual' the CHECK still allows.
TRANSMISSIONS = ("automatic", "manual")


def _text(value, field, max_length=60):
    if not isinstance(value, str) or not value.strip():
        raise ApiError(f"'{field}' must be non-empty text.", 400)
    value = value.strip()
    if len(value) > max_length:
        raise ApiError(f"'{field}' must be at most {max_length} characters.", 400)
    return value


def _whole_number(value, field, low, high):
    # bool is a subclass of int in Python, so True would otherwise pass as 1.
    if isinstance(value, bool) or not isinstance(value, int):
        raise ApiError(f"'{field}' must be a whole number.", 400)
    if not low <= value <= high:
        raise ApiError(f"'{field}' must be between {low} and {high}.", 400)
    return value


def _money(value, field):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ApiError(f"'{field}' must be a number.", 400)
    # Python's JSON parser accepts NaN and Infinity; numeric(10,2) doesn't.
    if not math.isfinite(value) or not 0 < value <= 99_999:
        raise ApiError(f"'{field}' must be more than 0 and at most 99999.", 400)
    return round(value, 2)


def _image_url(value, field):
    if value is None or value == "":
        return None
    value = _text(value, field, max_length=2000)
    parsed = urlparse(value)
    # Only plain web URLs: this ends up in <img src>, so no javascript:,
    # data:, or relative paths.
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ApiError(f"'{field}' must be an http(s) URL.", 400)
    return value


def _boolean(value, field):
    if not isinstance(value, bool):
        raise ApiError(f"'{field}' must be true or false.", 400)
    return value


def one_of(value, field, choices):
    if value not in choices:
        raise ApiError(f"'{field}' must be one of: {', '.join(choices)}.", 400)
    return value


# Every column an admin may set on a car, and how to check it. Anything not
# listed (id, created_at, ...) is rejected rather than silently ignored.
_CAR_FIELDS = {
    "category_id": lambda v: _whole_number(v, "category_id", 1, 2_147_483_647),
    "make": lambda v: _text(v, "make"),
    "model": lambda v: _text(v, "model"),
    "year": lambda v: _whole_number(v, "year", 1980, 2100),
    "color": lambda v: _text(v, "color", max_length=30),
    "seats": lambda v: _whole_number(v, "seats", 1, 50),
    "transmission": lambda v: one_of(v, "transmission", TRANSMISSIONS),
    "mileage": lambda v: _whole_number(v, "mileage", 0, 2_000_000),
    "daily_rate": lambda v: _money(v, "daily_rate"),
    "image_url": lambda v: _image_url(v, "image_url"),
    "is_active": lambda v: _boolean(v, "is_active"),
}
_CAR_REQUIRED = (
    "category_id", "make", "model", "year", "color", "seats", "transmission", "daily_rate",
)


def car_payload(body: dict, *, partial: bool) -> dict:
    """Validate a car create (partial=False) or update (partial=True) body."""
    unknown = sorted(set(body) - set(_CAR_FIELDS))
    if unknown:
        raise ApiError(f"Unknown or read-only field(s): {', '.join(unknown)}.", 400)

    if partial:
        if not body:
            raise ApiError("Send at least one field to change.", 400)
    else:
        missing = [field for field in _CAR_REQUIRED if field not in body]
        if missing:
            raise ApiError(f"Missing field(s): {', '.join(missing)}.", 400)

    return {field: _CAR_FIELDS[field](value) for field, value in body.items()}


# Keep in sync with enforce_booking_limits() in supabase/002_functions.sql.
MAX_NIGHTS = 30
MAX_DAYS_AHEAD = 365


def check_booking_window(pickup: str, nights: int) -> None:
    """Reject past, too-distant, or too-long bookings with a clear 400."""
    # UTC, like the database's current_date, with the same one day of slack
    # so a US customer's "today" in the evening is still accepted.
    today = datetime.now(timezone.utc).date()
    start = date.fromisoformat(pickup)
    if start < today - timedelta(days=1):
        raise ApiError("Pickup date is in the past.", 400)
    if start > today + timedelta(days=MAX_DAYS_AHEAD):
        raise ApiError(f"Bookings can be made at most {MAX_DAYS_AHEAD} days ahead.", 400)
    if nights > MAX_NIGHTS:
        raise ApiError(f"A booking can be at most {MAX_NIGHTS} nights.", 400)


def json_body() -> dict:
    """Return the request's JSON object, or raise a readable 400."""
    from flask import request

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError("Request body must be a JSON object.", 400)
    return data
