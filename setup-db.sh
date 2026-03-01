#!/bin/bash
# Run this once to set up the local PostgreSQL database.
# Usage: bash setup-db.sh

echo "Setting up clinic_db PostgreSQL database..."

sudo -u postgres psql <<EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'clinic_user') THEN
    CREATE USER clinic_user WITH PASSWORD 'clinic_pass';
    RAISE NOTICE 'Created user clinic_user';
  ELSE
    RAISE NOTICE 'User clinic_user already exists';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE clinic_db OWNER clinic_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'clinic_db') \gexec

GRANT ALL PRIVILEGES ON DATABASE clinic_db TO clinic_user;
EOF

echo ""
echo "Running schema migrations..."
cd "$(dirname "$0")/backend"
~/.local/bin/node src/db/migrate.js

echo ""
echo "Done! You can now start the backend with:"
echo "  cd backend && ~/.local/bin/npm install && ~/.local/bin/npm run dev"
