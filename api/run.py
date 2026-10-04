"""Development entry point.

    cd api
    .venv/Scripts/python run.py       # Windows
    .venv/bin/python run.py           # macOS / Linux

For production use a real WSGI server instead:
    gunicorn "app:create_app()"
"""

from app import create_app
from app.config import ConfigError, config

if __name__ == "__main__":
    try:
        app = create_app()
    except ConfigError as err:
        # A missing key is the most common setup problem, so print the fix
        # plainly instead of a stack trace.
        print("\n*** Configuration error ***\n")
        print(err)
        print()
        raise SystemExit(1)

    print(f"\n  CarRental API -> http://localhost:{config.PORT}")
    print(f"  Health check  -> http://localhost:{config.PORT}/api/health\n")

    app.run(
        host="127.0.0.1",
        port=config.PORT,
        debug=not config.is_production,
    )
