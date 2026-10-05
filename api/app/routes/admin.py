"""Admin endpoints: fleet, bookings, and user roles.

Every route is @require_admin and queries through g.db, the admin's own
user client. The security boundary is RLS (the is_admin() policies in
supabase/003_rls.sql), not this file: a customer's token reaching these
queries would read nothing and change nothing. See require_admin in auth.py.
"""

from flask import Blueprint, g, jsonify, request

from .. import queries
from ..auth import require_admin
from ..errors import ApiError
from ..validation import (
    BOOKING_STATUSES,
    ROLES,
    car_payload,
    json_body,
    one_of,
)

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


# --- cars --------------------------------------------------------------------

@bp.get("/cars")
@require_admin
def list_cars():
    """GET /api/admin/cars: the whole fleet, including inactive cars."""
    return jsonify(queries.list_cars(g.db, include_inactive=True))


@bp.post("/cars")
@require_admin
def create_car():
    """POST /api/admin/cars  { category_id, make, model, year, color, seats,
    transmission, daily_rate, [mileage, image_url, is_active] }"""
    fields = car_payload(json_body(), partial=False)
    return jsonify(queries.create_car(g.db, fields)), 201


@bp.patch("/cars/<int:car_id>")
@require_admin
def update_car(car_id: int):
    """PATCH /api/admin/cars/<id>  any subset of the create fields.

    Deactivate with { "is_active": false }. There is no DELETE: bookings
    reference cars, and their history should survive.
    """
    fields = car_payload(json_body(), partial=True)
    return jsonify(queries.update_car(g.db, car_id, fields))


# --- bookings ----------------------------------------------------------------

@bp.get("/bookings")
@require_admin
def list_bookings():
    """GET /api/admin/bookings?status=pending: everyone's bookings."""
    status = request.args.get("status") or None
    if status:
        one_of(status, "status", BOOKING_STATUSES)
    return jsonify(queries.list_all_bookings(g.db, status=status))


@bp.patch("/bookings/<int:booking_id>")
@require_admin
def set_booking_status(booking_id: int):
    """PATCH /api/admin/bookings/<id>  { status }

    Status only. Prices and dates are never taken from a client.
    """
    body = json_body()
    if set(body) != {"status"}:
        raise ApiError("Send exactly one field: 'status'.", 400)
    status = one_of(body["status"], "status", BOOKING_STATUSES)
    return jsonify(queries.set_booking_status(g.db, booking_id, status))


# --- users -------------------------------------------------------------------

@bp.get("/users")
@require_admin
def list_users():
    """GET /api/admin/users?email=jane: profiles whose email contains the
    text (any case), at most queries.USER_SEARCH_LIMIT of them."""
    email = (request.args.get("email") or "").strip()
    if len(email) > 254:  # the longest valid email address
        raise ApiError("Search text is too long.", 400)
    return jsonify(queries.list_profiles(g.db, email=email or None))


@bp.patch("/users/<uuid:user_id>")
@require_admin
def set_role(user_id):
    """PATCH /api/admin/users/<uuid>  { role: "customer" | "admin" }"""
    body = json_body()
    if set(body) != {"role"}:
        raise ApiError("Send exactly one field: 'role'.", 400)
    role = one_of(body["role"], "role", ROLES)

    # Stops the last admin from demoting themselves and locking everyone
    # out of the admin side (recovery would need the SQL Editor).
    if str(user_id) == str(g.user_id):
        raise ApiError("You can't change your own role. Ask another admin.", 400)

    return jsonify(queries.set_role(g.db, str(user_id), role))
