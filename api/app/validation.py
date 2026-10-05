"""Small input parsers.

Routes should never pass a raw query string into a query. These helpers turn
user input into the right type or raise a 400 with a readable message.
"""

from datetime import date, datetime

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


def json_body() -> dict:
    """Return the request's JSON object, or raise a readable 400."""
    from flask import request

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError("Request body must be a JSON object.", 400)
    return data
