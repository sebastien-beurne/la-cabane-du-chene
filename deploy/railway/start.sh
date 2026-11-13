#!/bin/sh
set -eu
mkdir -p /app/media
chown cabane:cabane /app/media
exec su -s /bin/sh cabane -c 'exec uvicorn railway_web:app --host 0.0.0.0 --port "${PORT:-8080}" --proxy-headers --forwarded-allow-ips "*"'

