"""Health check.

Hit GET /api/health first whenever something seems broken — it tells you
whether Flask is up, whether the keys are loaded, and whether Supabase is
actually reachable, which narrows the problem down fast.
"""

from flask import Blueprint, jsonify

from ..config import config
from ..supabase_client import get_client

bp = Blueprint("health", __name__, url_prefix="/api")


@bp.get("/health")
def health():
    checks = {
        "flask": "ok",
        "env": config.FLASK_ENV,
        "supabase_url_set": bool(config.SUPABASE_URL),
        "anon_key_set": bool(config.SUPABASE_ANON_KEY),
        "service_role_set": config.has_service_role,
    }

    # Cheapest possible real query, to prove the credentials work.
    try:
        get_client().table("car_categories").select("id").limit(1).execute()
        checks["supabase"] = "ok"
        status = 200
    except Exception as err:
        checks["supabase"] = "unreachable"
        checks["supabase_error"] = str(err)[:200]
        status = 503

    return jsonify(checks), status
