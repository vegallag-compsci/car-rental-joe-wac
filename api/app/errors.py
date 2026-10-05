"""Error handling.

Every failure leaves this API in the same JSON shape:

    { "error": { "message": "...", "code": "bad_request" } }

so the React side only needs one error path instead of guessing per endpoint.
"""

import logging

from flask import jsonify
from postgrest.exceptions import APIError

from .config import ConfigError

log = logging.getLogger(__name__)

# Postgres error codes we translate into friendly HTTP responses.
# 23P01 is the one our bookings_no_overlap exclusion constraint raises.
_PG_STATUS = {
    "23P01": (409, "Those dates were just taken for this car. Please pick others."),
    "23505": (409, "That record already exists."),
    "23503": (400, "That referenced record does not exist."),
    "23514": (400, "That value is not allowed by a database constraint."),
    "42501": (403, "You do not have permission to do that."),
    # Raised by enforce_booking_limits() in 002 (3 upcoming bookings max).
    "CR001": (
        409,
        "You already have 3 upcoming bookings. Cancel one, or wait until one "
        "is over, before booking another.",
    ),
    # PostgREST couldn't find a function we called — almost always means a
    # migration in supabase/ hasn't been run yet. Say so instead of a generic
    # 500, because the fix is obvious once you know.
    "PGRST202": (
        501,
        "A required database function is missing. Run the SQL files in "
        "supabase/ (001, 002, 003) in the Supabase SQL Editor.",
    ),
    # Row Level Security rejected the query.
    "PGRST301": (401, "Not authorised. Please log in again."),
}


class ApiError(Exception):
    """Raise this anywhere to return a specific status and message."""

    def __init__(self, message: str, status: int = 400, code: str | None = None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code or _default_code(status)


def _default_code(status: int) -> str:
    return {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        500: "server_error",
    }.get(status, "error")


def _payload(message: str, code: str):
    return jsonify({"error": {"message": message, "code": code}})


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def _handle_api_error(err: ApiError):
        return _payload(err.message, err.code), err.status

    @app.errorhandler(APIError)
    def _handle_postgrest_error(err: APIError):
        """Translate a Supabase/PostgREST failure into our own shape."""
        status, message = _PG_STATUS.get(
            getattr(err, "code", None), (500, "Database request failed.")
        )
        # Log the real error server-side; don't leak schema details to clients.
        log.warning(
            "postgrest error code=%s message=%s details=%s",
            getattr(err, "code", None),
            getattr(err, "message", None),
            getattr(err, "details", None),
        )
        return _payload(message, _default_code(status)), status

    @app.errorhandler(ConfigError)
    def _handle_config_error(err: ConfigError):
        log.error("configuration error: %s", err)
        return _payload("Server is not configured correctly.", "server_error"), 500

    @app.errorhandler(404)
    def _handle_404(_err):
        return _payload("No such endpoint.", "not_found"), 404

    @app.errorhandler(405)
    def _handle_405(_err):
        return _payload("Method not allowed for this endpoint.", "bad_request"), 405

    @app.errorhandler(413)
    def _handle_413(_err):
        return _payload("Request body is too large.", "bad_request"), 413

    @app.errorhandler(Exception)
    def _handle_unexpected(err: Exception):
        # Last resort. Log the stack trace, return something generic.
        log.exception("unhandled error: %s", err)
        return _payload("Something went wrong.", "server_error"), 500
