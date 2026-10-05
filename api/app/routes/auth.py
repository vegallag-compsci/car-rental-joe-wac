"""Google login, run entirely through Flask.

The React app never talks to Supabase. Logging in is a chain of full-page
redirects (not fetch calls), using Supabase's PKCE flow:

  1. React sends the browser to   GET /api/auth/google?next=/bookings
  2. We redirect to Supabase, which redirects to Google, where the user signs in.
  3. Google -> Supabase -> back to GET /api/auth/callback?code=...
  4. We swap the code for a session, then redirect to the React app at
     {FRONTEND_URL}/auth/callback#access_token=...&refresh_token=...

From then on React sends the access token as `Authorization: Bearer ...`
(see auth.require_auth), and calls POST /api/auth/refresh before it expires.

PKCE is what makes step 3 safe. In step 1 we make a random secret (the
verifier), give Supabase only its hash, and keep the secret in a short-lived
HttpOnly cookie. Supabase hands out the session only when it gets back that
same secret, so a stolen or forged ?code= is useless in anyone else's browser.
"""

import logging
from urllib.parse import urlencode

from flask import Blueprint, g, jsonify, redirect, request
from supabase_auth.errors import AuthError
from supabase_auth.helpers import generate_pkce_challenge, generate_pkce_verifier

from .. import queries
from ..auth import require_auth
from ..config import config
from ..errors import ApiError
from ..supabase_client import get_auth_client
from ..validation import json_body

log = logging.getLogger(__name__)

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# Both cookies only live for the few seconds the user spends on Google's
# screen, and are only sent back to /api/auth/*.
VERIFIER_COOKIE = "pkce_verifier"
NEXT_COOKIE = "login_next"
COOKIE_OPTIONS = {
    "max_age": 10 * 60,
    "path": "/api/auth",
    "httponly": True,
    # Lax still sends the cookie on the top-level redirect back from Supabase.
    "samesite": "Lax",
    "secure": config.is_production,
}


def _safe_next(raw: str | None) -> str:
    """Where to land after login. Only relative paths on our own site.

    Without this check, /api/auth/google?next=https://evil.example would send
    users to another site straight after a real Google login (an open redirect).
    "//evil.example" and "/\\evil.example" are treated as other sites by
    browsers, so those are refused too.
    """
    if raw and raw.startswith("/") and not raw.startswith("//") and "\\" not in raw:
        return raw
    return "/"


def _to_frontend(path: str, fragment: dict | None = None, query: dict | None = None):
    url = f"{config.FRONTEND_URL}{path}"
    if query:
        url += "?" + urlencode(query)
    if fragment:
        # The fragment (#...) is never sent to any server or written to access
        # logs, which is why the tokens travel there and not in ?query.
        url += "#" + urlencode(fragment)
    return redirect(url)


def _login_failed(message: str):
    response = _to_frontend("/login", query={"error": message})
    response.delete_cookie(VERIFIER_COOKIE, path=COOKIE_OPTIONS["path"])
    response.delete_cookie(NEXT_COOKIE, path=COOKIE_OPTIONS["path"])
    return response


def _session_payload(session) -> dict:
    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "expires_at": session.expires_at,
    }


@bp.get("/google")
def google_login():
    """GET /api/auth/google?next=/bookings  (a link, not a fetch)"""
    verifier = generate_pkce_verifier()
    authorize_url = f"{config.SUPABASE_URL}/auth/v1/authorize?" + urlencode(
        {
            "provider": "google",
            "redirect_to": config.auth_callback_url,
            "code_challenge": generate_pkce_challenge(verifier),
            "code_challenge_method": "s256",
        }
    )

    response = redirect(authorize_url)
    response.set_cookie(VERIFIER_COOKIE, verifier, **COOKIE_OPTIONS)
    response.set_cookie(NEXT_COOKIE, _safe_next(request.args.get("next")), **COOKIE_OPTIONS)
    return response


@bp.get("/callback")
def callback():
    """Where Supabase sends the browser after Google. Never called by React."""
    # The user pressed Cancel on Google, or Supabase rejected the request.
    if request.args.get("error"):
        log.info("oauth error: %s", request.args.get("error_description"))
        return _login_failed("Google sign-in was cancelled or failed. Please try again.")

    code = request.args.get("code")
    verifier = request.cookies.get(VERIFIER_COOKIE)
    if not code or not verifier:
        # Usually the cookie expired, or the callback URL was opened directly.
        return _login_failed("Your sign-in link expired. Please try again.")

    try:
        result = get_auth_client().auth.exchange_code_for_session(
            {
                "auth_code": code,
                "code_verifier": verifier,
                "redirect_to": config.auth_callback_url,
            }
        )
    except AuthError as err:
        log.warning("code exchange failed: %s", err)
        return _login_failed("We couldn't finish signing you in. Please try again.")

    response = _to_frontend(
        "/auth/callback",
        fragment={
            **_session_payload(result.session),
            "next": _safe_next(request.cookies.get(NEXT_COOKIE)),
        },
    )
    response.delete_cookie(VERIFIER_COOKIE, path=COOKIE_OPTIONS["path"])
    response.delete_cookie(NEXT_COOKIE, path=COOKIE_OPTIONS["path"])
    return response


@bp.post("/refresh")
def refresh():
    """POST /api/auth/refresh  { refresh_token } -> a new session.

    Supabase access tokens last an hour. Refresh tokens are single-use, so
    the client must store the new refresh_token this returns.
    """
    refresh_token = json_body().get("refresh_token")
    if not isinstance(refresh_token, str) or not refresh_token:
        raise ApiError("'refresh_token' is required.", 400)

    try:
        result = get_auth_client().auth.refresh_session(refresh_token)
    except AuthError:
        raise ApiError("Your session has expired. Please log in again.", 401)

    return jsonify(_session_payload(result.session))


@bp.get("/me")
@require_auth
def me():
    """GET /api/auth/me -> who is logged in, and whether they are an admin.

    `role` is for showing or hiding UI only. Admin powers are enforced by
    RLS (is_admin()), not by anything the client does with this value.
    """
    metadata = g.user.user_metadata or {}
    return jsonify(
        {
            "id": g.user_id,
            "email": g.user.email,
            # Google fills these in on the Supabase user.
            "name": metadata.get("full_name") or metadata.get("name"),
            "avatar_url": metadata.get("avatar_url") or metadata.get("picture"),
            "role": queries.get_role(g.db, g.user_id),
        }
    )


@bp.post("/logout")
@require_auth
def logout():
    """POST /api/auth/logout -> revokes this session's refresh token.

    Best effort: the client forgets its tokens either way. The access token
    itself stays valid until it expires (at most an hour), which is how
    Supabase JWTs work.
    """
    try:
        get_auth_client().auth.admin.sign_out(g.access_token, "local")
    except AuthError as err:
        log.info("logout: session already gone (%s)", err)
    return "", 204
