#!/bin/sh
set -e

echo "Starting SellMeAPen Ext..."

# Check if database exists
if [ ! -f /app/data/app.db ]; then
    echo "Database not found. Initializing..."

    # Use db push instead of migrations (no migrations folder)
    npx prisma db push --skip-generate

    # Seed the database
    npx prisma db seed

    echo "Database initialized!"
else
    echo "Database found. Skipping initialization."
fi

# Execute the main command
exec "$@"
