"""Car and category endpoints. Public — no login required."""

from flask import Blueprint, jsonify, request

from .. import queries
from ..errors import ApiError
from ..supabase_client import get_client
from ..validation import optional_date, optional_int

bp = Blueprint("cars", __name__, url_prefix="/api")


@bp.get("/categories")
def list_categories():
    return jsonify(queries.list_categories(get_client()))


@bp.get("/cars")
def list_cars():
    """GET /api/cars?category=3&sort=price-asc&pickup=...&return=...

    If both dates are supplied, only cars free for that range come back.
    """
    category_id = optional_int(request.args.get("category"), "category")
    sort = request.args.get("sort") or None
    pickup = optional_date(request.args.get("pickup"), "pickup")
    dropoff = optional_date(request.args.get("return"), "return")

    if sort and sort not in queries.SORT_OPTIONS:
        raise ApiError(
            f"Unknown sort '{sort}'. Valid: "
            + ", ".join(queries.SORT_OPTIONS),
            400,
        )

    db = get_client()

    if pickup and dropoff:
        if dropoff <= pickup:
            raise ApiError("Return date must be after the pickup date.", 400)
        cars = queries.list_available_cars(
            db, pickup=pickup, dropoff=dropoff, category_id=category_id, sort=sort
        )
    else:
        cars = queries.list_cars(db, category_id=category_id, sort=sort)

    return jsonify(cars)


@bp.get("/cars/<int:car_id>")
def get_car(car_id: int):
    return jsonify(queries.get_car(get_client(), car_id))
