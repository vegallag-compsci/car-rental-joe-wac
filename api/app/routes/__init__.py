"""Route blueprints.

Add a new endpoint group by creating a module here with a `bp` blueprint,
then listing it in BLUEPRINTS below. That is the only wiring needed.
"""

from . import auth, bookings, cars, health

BLUEPRINTS = (health.bp, auth.bp, cars.bp, bookings.bp)
