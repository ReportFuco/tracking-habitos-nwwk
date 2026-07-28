#!/bin/sh
set -e

echo "Waiting for postgres at ${DATABASE_HOST}:${DATABASE_PORT}..."
until nc -z "$DATABASE_HOST" "$DATABASE_PORT"; do
  sleep 1
done

echo "Running Alembic migrations..."
alembic -c app/alembic.ini upgrade head

echo "Starting API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
