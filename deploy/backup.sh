#!/usr/bin/env bash
# deploy/backup.sh - nightly copy of the database and uploads, kept 14 days.
# Installed as /usr/local/bin/wt-backup.sh, run by /etc/cron.d/wt-backup (root).
set -euo pipefail
umask 077
DIR=/srv/app/shared/backups
TS=$(date +%Y%m%d-%H%M)
mkdir -p "$DIR"
mongodump --quiet --config /root/.mongo-admin.yaml --db wondertravelers_db --gzip --archive="$DIR/db-$TS.archive.gz"
tar czf "$DIR/files-$TS.tgz" -C /srv/app/shared uploads server.env client.env
find "$DIR" -type f -mtime +14 -delete
