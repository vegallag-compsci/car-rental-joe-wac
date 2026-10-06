"""Supabase client factories.

Three different clients, because *which* client you use decides what Row
Level Security lets through. Pick deliberately:

    get_client()            -> anonymous. For public data (cars, categories).
    get_user_client(token)  -> acts as the logged-in user. RLS applies to them.
    get_admin_client()      -> BYPASSES RLS ENTIRELY. Admin routes only.

Rule of thumb: if a request is about one specific user's data, use
get_user_client so the database enforces ownership. Never hand-roll a
`where user_id = ...` filter and call it security — RLS is the guarantee,
the filter is just a convenience.
"""

from functools import lru_cache

from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions

from .config import ConfigError, config

# Don't let Supabase try to persist or refresh sessions: a Flask process is
# stateless and shared between users, so there is no "current session" to hold.
_OPTIONS = SyncClientOptions(auto_refresh_token=False, persist_session=False)


@lru_cache(maxsize=1)
def get_client() -> Client:
    """Anonymous client, reused across requests.

    Safe to cache because it carries no per-user state.
    """
    return create_client(
        config.SUPABASE_URL, config.SUPABASE_ANON_KEY, options=_OPTIONS
    )


def get_user_client(access_token: str, client_ip: str | None = None) -> Client:
    """Client that acts as the user owning `access_token`.

    Queries run with that user's identity, so `auth.uid()` in RLS policies
    resolves to them. Not cached — each call is tied to one user's token.

    `client_ip` is the end user's address, sent as X-Client-IP for the audit
    log (supabase/004_audit_log.sql). Without it, Supabase would only see
    this Flask server's address.
    """
    client = create_client(
        config.SUPABASE_URL, config.SUPABASE_ANON_KEY, options=_OPTIONS
    )
    # Swap the anon key for the user's JWT on data requests.
    client.postgrest.auth(access_token)
    if client_ip:
        client.postgrest.headers["X-Client-IP"] = client_ip
    return client


def get_auth_client() -> Client:
    """Fresh, throwaway client for login / refresh / logout calls.

    NEVER use get_client() for these. A supabase-py client that completes a
    sign-in or refresh switches itself to that user's token, so doing it on
    the cached anonymous client would make every later "anonymous" request
    in this process act as whoever logged in last.
    """
    return create_client(
        config.SUPABASE_URL, config.SUPABASE_ANON_KEY, options=_OPTIONS
    )


@lru_cache(maxsize=1)
def get_admin_client() -> Client:
    """Service-role client. IGNORES ROW LEVEL SECURITY.

    Only call this from a route that has already checked the caller is an
    admin. If you reach for this to "make a query work", the real problem is
    almost always a missing RLS policy.
    """
    if not config.has_service_role:
        raise ConfigError(
            "SUPABASE_SERVICE_ROLE_KEY is not set, so admin operations are "
            "unavailable. Add it to api/.env to enable them."
        )
    return create_client(
        config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, options=_OPTIONS
    )


def verify_token(access_token: str):
    """Return the Supabase user for a JWT, or None if it is invalid/expired."""
    try:
        response = get_client().auth.get_user(access_token)
    except Exception:
        return None
    return getattr(response, "user", None)
