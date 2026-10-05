"""Environment configuration.

Everything the app reads from the environment is declared here, so there is
exactly one place to look when a setting is missing or wrong.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load api/.env regardless of which directory the server was started from.
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)


class ConfigError(RuntimeError):
    """Raised at startup when required settings are missing."""


class Config:
    SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()

    # Optional. Bypasses RLS — only read by get_admin_client().
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    PORT = int(os.getenv("PORT", "5000"))
    FLASK_ENV = os.getenv("FLASK_ENV", "development").strip()

    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ]

    # Google login round trip (routes/auth.py). API_URL is where the browser
    # reaches this server; Supabase sends users back to
    # {API_URL}/api/auth/callback, which must be in Supabase's Redirect URLs
    # allow-list. FRONTEND_URL is where we send them after that.
    API_URL = os.getenv("API_URL", f"http://localhost:{PORT}").strip().rstrip("/")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").strip().rstrip("/")

    @property
    def auth_callback_url(self) -> str:
        return f"{self.API_URL}/api/auth/callback"

    @property
    def is_production(self) -> bool:
        return self.FLASK_ENV == "production"

    @property
    def has_service_role(self) -> bool:
        return bool(self.SUPABASE_SERVICE_ROLE_KEY)

    def validate(self) -> None:
        """Fail loudly at startup rather than on the first request.

        A missing key otherwise shows up as a confusing 401 from Supabase
        halfway through using the app.
        """
        missing = [
            name
            for name in ("SUPABASE_URL", "SUPABASE_ANON_KEY")
            if not getattr(self, name)
        ]
        if missing:
            raise ConfigError(
                "Missing required environment variable(s): "
                + ", ".join(missing)
                + f"\n\nExpected them in: {ENV_PATH}"
                + "\nCopy api/.env.example to api/.env and fill in the values"
                + " from Supabase -> Project Settings -> API."
            )

        if not self.SUPABASE_URL.startswith("http"):
            raise ConfigError(
                f"SUPABASE_URL should start with https:// — got {self.SUPABASE_URL!r}"
            )


config = Config()
