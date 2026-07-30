#!/bin/sh
set -e

echo "Waiting for postgres at ${DATABASE_HOST}:${DATABASE_PORT}..."
until nc -z "$DATABASE_HOST" "$DATABASE_PORT"; do
  sleep 1
done

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Running Alembic migrations..."
  alembic -c app/alembic.ini upgrade head
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

echo "Starting API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
