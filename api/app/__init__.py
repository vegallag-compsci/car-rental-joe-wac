"""Flask application factory.

A factory (rather than a module-level `app`) means tests can build an app with
different settings, and there is no import-time side effect.
"""

import logging

from flask import Flask
from flask_cors import CORS

from .config import config
from .errors import register_error_handlers
from .routes import BLUEPRINTS


def create_app(*, validate_config: bool = True) -> Flask:
    app = Flask(__name__)

    # Every legitimate request body here is a few hundred bytes of JSON. Cap
    # it so nobody can tie up the server by uploading megabytes (413).
    app.config["MAX_CONTENT_LENGTH"] = 64 * 1024

    logging.basicConfig(
        level=logging.INFO if config.is_production else logging.DEBUG,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )

    if validate_config:
        # Raises ConfigError with instructions if keys are missing.
        config.validate()

    # Only the React dev server (and whatever you add to CORS_ORIGINS) may
    # call this API from a browser. Authorization must be allowed through or
    # the JWT never arrives.
    CORS(
        app,
        resources={r"/api/*": {"origins": config.CORS_ORIGINS}},
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        max_age=3600,
    )

    for blueprint in BLUEPRINTS:
        app.register_blueprint(blueprint)

    register_error_handlers(app)

    return app
