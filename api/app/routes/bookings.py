"""Booking endpoints. All require a logged-in user."""

from flask import Blueprint, g, jsonify

from .. import queries
from ..auth import require_auth
from ..errors import ApiError
from ..validation import (
    check_booking_window,
    days_between,
    json_body,
    required_date,
    required_int,
)

bp = Blueprint("bookings", __name__, url_prefix="/api/bookings")


@bp.get("")
@require_auth
def list_bookings():
    """GET /api/bookings — the caller's own bookings.

    g.db acts as this user, so the RLS policy returns only their rows.
    """
    return jsonify(queries.list_bookings(g.db))


@bp.post("")
@require_auth
def create_booking():
    """POST /api/bookings  { car_id, pickup_at, return_at }

    Note what is NOT accepted: total_price and status. The price is computed
    from the database, and every new booking starts as 'pending'.
    """
    body = json_body()
    car_id = required_int(body.get("car_id"), "car_id")
    pickup = required_date(body.get("pickup_at"), "pickup_at")
    dropoff = required_date(body.get("return_at"), "return_at")

    days = days_between(pickup, dropoff)
    if days < 1:
        raise ApiError("Return date must be at least one day after pickup.", 400)
    # Same rules as enforce_booking_limits() in 002, checked here only for a
    # clearer message; the database enforces them (and the 3-booking cap).
    check_booking_window(pickup, days)

    booking = queries.create_booking(
        g.db,
        user_id=g.user_id,
        car_id=car_id,
        pickup=pickup,
        dropoff=dropoff,
        days=days,
    )
    return jsonify(booking), 201


@bp.post("/<int:booking_id>/cancel")
@require_auth
def cancel_booking(booking_id: int):
    """POST /api/bookings/<id>/cancel

    A POST rather than a DELETE: the row survives, its status changes. RLS
    restricts this to the booking's owner.
    """
    return jsonify(queries.cancel_booking(g.db, booking_id))
