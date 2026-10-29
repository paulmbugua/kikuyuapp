# Isolated restore test

Run this on the VPS after copying an encrypted dump into `/opt/kikuyuapp/restore-test/`:

```sh
set -eu
mkdir -p /opt/kikuyuapp/restore-test
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE \
  -in /opt/kikuyuapp/restore-test/kikuyuapp.dump.enc \
  -out /opt/kikuyuapp/restore-test/kikuyuapp.dump
docker compose --env-file /opt/kikuyuapp/.env -f /opt/kikuyuapp/compose.yml \
  run --rm -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  pg_restore --clean --if-exists --no-owner --no-privileges \
  --host=postgres --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
  /restore-test/kikuyuapp.dump
```

The test must use a disposable database or disposable Compose project, never the live database.

