"""Production entry point (Vercel).

Vercel's Python runtime looks for a WSGI `app` in index.py at the project
root (this folder, `api/`). Locally, keep using `python run.py`.

Settings come from the host's environment variables, not api/.env, which is
gitignored and never deployed. See .env.example for the full list.
"""

from app import create_app

app = create_app()
