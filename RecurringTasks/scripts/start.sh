#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until nc -z postgres 5432 2>/dev/null; do
  sleep 2
done
echo "PostgreSQL is accepting connections"

sleep 3

echo "Starting RecurringTasks..."
exec node dist/server/server/index.js
