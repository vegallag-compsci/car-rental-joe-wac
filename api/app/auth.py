"""Request authentication helpers.

The React app logs in with Supabase directly, gets a JWT, and sends it on
every call as `Authorization: Bearer <token>`. Flask's job is to verify that
token and then talk to Supabase *as that user*.
"""

from functools import wraps

from flask import g, request

from . import queries
from .errors import ApiError
from .supabase_client import get_user_client, verify_token


def bearer_token() -> str | None:
    """Pull the JWT out of the Authorization header, if present."""
    header = request.headers.get("Authorization", "")
    if not header.lower().startswith("bearer "):
        return None
    token = header[7:].strip()
    return token or None


def require_auth(view):
    """Reject the request unless it carries a valid Supabase JWT.

    On success, sets:
        g.access_token  the raw JWT
        g.user          the Supabase user object
        g.user_id       the user's uuid (string)
        g.db            a Supabase client acting as this user

    Use g.db for anything user-owned so RLS does the enforcing.
    """

    @wraps(view)
    def wrapper(*args, **kwargs):
        token = bearer_token()
        if not token:
            raise ApiError("Missing Authorization header.", 401)

        user = verify_token(token)
        if user is None:
            raise ApiError("Invalid or expired session. Please log in again.", 401)

        g.access_token = token
        g.user = user
        g.user_id = user.id
        g.db = get_user_client(token)
        return view(*args, **kwargs)

    return wrapper


def require_admin(view):
    """require_auth, plus a 403 for anyone whose profile role isn't 'admin'.

    This check exists for a clear error message, NOT as the security
    boundary. Admin queries still run through g.db, i.e. as the caller, so
    if this decorator were missing a non-admin would still be stopped by
    RLS (is_admin() policies): reads come back empty, writes change nothing.
    Never pair this with get_admin_client(); that would make this check the
    only thing standing between a customer and the whole database.
    """

    @wraps(view)
    @require_auth
    def wrapper(*args, **kwargs):
        if queries.get_role(g.db, g.user_id) != "admin":
            raise ApiError("This needs an admin account.", 403)
        return view(*args, **kwargs)

    return wrapper


def optional_auth(view):
    """Like require_auth, but allows anonymous callers.

    Sets the same values when a valid token is present; sets g.user to None
    otherwise. Useful for endpoints that show more to logged-in users.
    """

    @wraps(view)
    def wrapper(*args, **kwargs):
        token = bearer_token()
        user = verify_token(token) if token else None

        g.access_token = token if user else None
        g.user = user
        g.user_id = user.id if user else None
        g.db = get_user_client(token) if user else None
        return view(*args, **kwargs)

    return wrapper
