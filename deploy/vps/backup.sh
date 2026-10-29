#!/bin/sh
set -eu

umask 077
mkdir -p /backups

while :; do
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  dump="/tmp/kikuyuapp-${stamp}.dump"
  out="/backups/kikuyuapp-${stamp}.dump.enc"

  PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
    --format=custom \
    --no-owner \
    --no-privileges \
    --host=postgres \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" > "$dump"

  openssl enc -aes-256-cbc -pbkdf2 -salt \
    -pass env:BACKUP_PASSPHRASE \
    -in "$dump" -out "$out"
  rm -f "$dump"

  find /backups -type f -name '*.dump.enc' -mtime +14 -delete
  sleep 86400
done

