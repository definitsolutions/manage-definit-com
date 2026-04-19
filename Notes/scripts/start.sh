#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until nc -z postgres 5432 2>/dev/null; do
  sleep 2
done
echo "PostgreSQL is accepting connections"

sleep 3

echo "Pushing database schema..."
npx prisma db push --skip-generate 2>&1 || echo "Schema push completed"

echo "Starting Notes..."
exec node dist/server/server/index.js
