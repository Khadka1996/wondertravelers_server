#!/usr/bin/env bash
# deploy/deploy.sh - publish the latest code from GitHub.
#
#   deploy.sh                      deploy branch main of both repositories
#   deploy.sh --branch some-branch deploy another branch
#   deploy.sh --no-restart         build a release but leave the live one running
#   deploy.sh --rollback           go back to the previous release
#
# Run on the server as the app user (wondertravelers). Layout:
#   /srv/app/releases/<time>/{server,client}   one folder per deploy
#   /srv/app/current -> releases/<time>        the live release
#   /srv/app/shared/                           server.env, client.env, uploads,
#                                              app-backups, migrations.done (never in git)
set -euo pipefail

APP_ROOT=${APP_ROOT:-/srv/app}
RELEASES="$APP_ROOT/releases"
SHARED="$APP_ROOT/shared"
CURRENT="$APP_ROOT/current"
SERVER_REPO=${SERVER_REPO:-https://github.com/Khadka1996/wondertravelers_server.git}
CLIENT_REPO=${CLIENT_REPO:-https://github.com/Khadka1996/wondertravelers.git}
BRANCH=main
KEEP_RELEASES=3
RESTART=1
API_HEALTH=http://127.0.0.1:5000/health
WEB_HEALTH=http://127.0.0.1:3000/en

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

restart_services() {
  sudo /usr/bin/systemctl restart wondertravelers-api.service
  sudo /usr/bin/systemctl restart wondertravelers-web.service
}

healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null --max-time 5 "$API_HEALTH" && curl -fsS -o /dev/null --max-time 10 "$WEB_HEALTH"; then
      return 0
    fi
    sleep 3
  done
  return 1
}

switch_to() {
  ln -sfn "$1" "$CURRENT.next"
  mv -T "$CURRENT.next" "$CURRENT"
}

previous_release() {
  local live
  live=$(readlink -f "$CURRENT")
  ls -1d "$RELEASES"/*/ 2>/dev/null | sed 's#/$##' | sort | awk -v live="$live" '$0 == live { print prev; exit } { prev = $0 }'
}

rollback() {
  local target
  target=$(previous_release)
  [ -n "$target" ] || fail "No earlier release to roll back to."
  log "Rolling back to $(basename "$target")"
  switch_to "$target"
  restart_services
  healthy || fail "Rolled back, but the site still does not answer. Check: journalctl -u wondertravelers-api -u wondertravelers-web"
  log "Rollback complete: $(cat "$target/REVISION" 2>/dev/null || basename "$target")"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --rollback) rollback; exit 0 ;;
    --branch) BRANCH=$2; shift ;;
    --no-restart) RESTART=0 ;;
    *) fail "Unknown option: $1" ;;
  esac
  shift
done

[ "$(id -un)" = "wondertravelers" ] || fail "Run as the app user: sudo -u wondertravelers $0"
for f in server.env client.env; do [ -f "$SHARED/$f" ] || fail "Missing $SHARED/$f"; done

RELEASE="$RELEASES/$(date +%Y%m%d%H%M%S)"
log "New release $(basename "$RELEASE") from branch $BRANCH"
mkdir -p "$RELEASE"
trap 'rm -rf "$RELEASE"; fail "Deploy failed before going live; the live site was not touched."' ERR

git clone --quiet --depth 1 --branch "$BRANCH" "$SERVER_REPO" "$RELEASE/server"
git clone --quiet --depth 1 --branch "$BRANCH" "$CLIENT_REPO" "$RELEASE/client"
{
  echo "server $(git -C "$RELEASE/server" rev-parse --short HEAD)"
  echo "client $(git -C "$RELEASE/client" rev-parse --short HEAD)"
} > "$RELEASE/REVISION"

log "Linking shared settings and files"
# Settings that are committed to the repositories must not win over shared/.
rm -f "$RELEASE"/server/.env "$RELEASE"/server/.env.* "$RELEASE"/client/.env.local "$RELEASE"/client/.env.production
ln -s "$SHARED/server.env" "$RELEASE/server/.env"
ln -s "$SHARED/client.env" "$RELEASE/client/.env.production.local"
rm -rf "$RELEASE/server/uploads" "$RELEASE/server/backups"
ln -s "$SHARED/uploads" "$RELEASE/server/uploads"
ln -s "$SHARED/app-backups" "$RELEASE/server/backups"

log "Installing API packages"
(cd "$RELEASE/server" && npm ci --omit=dev --no-audit --no-fund --loglevel=error)

log "Building website"
(cd "$RELEASE/client" && npm ci --no-audit --no-fund --loglevel=error && NEXT_TELEMETRY_DISABLED=1 npm run build)
# Resized images survive deploys instead of being re-made after each one
# (linked after the build, which clears .next).
mkdir -p "$SHARED/next-image-cache" "$RELEASE/client/.next/cache"
rm -rf "$RELEASE/client/.next/cache/images"
ln -s "$SHARED/next-image-cache" "$RELEASE/client/.next/cache/images"

log "Running database migrations"
touch "$SHARED/migrations.done"
for migration in "$RELEASE"/server/migrations/*.js; do
  [ -e "$migration" ] || continue
  name=$(basename "$migration")
  grep -qxF "$name" "$SHARED/migrations.done" && continue
  log "  $name"
  (cd "$RELEASE/server" && node "migrations/$name" --apply)
  echo "$name" >> "$SHARED/migrations.done"
done

trap - ERR

if [ "$RESTART" = 0 ]; then
  log "Built $(basename "$RELEASE"); not switched live (--no-restart)."
  exit 0
fi

PREVIOUS=$(readlink -f "$CURRENT" 2>/dev/null || true)
log "Switching live release"
switch_to "$RELEASE"
restart_services

if healthy; then
  log "Live: $(tr '\n' ' ' < "$RELEASE/REVISION")"
else
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    printf '\033[1;31mxx\033[0m New release did not answer; switching back to %s\n' "$(basename "$PREVIOUS")" >&2
    switch_to "$PREVIOUS"
    restart_services
    healthy || true
  fi
  fail "Deploy of $(basename "$RELEASE") failed health checks. Logs: journalctl -u wondertravelers-api -u wondertravelers-web -n 100"
fi

log "Removing old releases (keeping $KEEP_RELEASES)"
LIVE=$(readlink -f "$CURRENT")
ls -1d "$RELEASES"/*/ | sed 's#/$##' | sort | head -n "-$KEEP_RELEASES" | while read -r old; do
  [ "$old" = "$LIVE" ] || rm -rf "$old"
done
