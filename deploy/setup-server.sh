#!/usr/bin/env bash
# deploy/setup-server.sh - one-time move from the pm2 setup in /home/wondertravelers
# to /srv/app releases + systemd. Run as root from a checkout of this repository.
#
#   setup-server.sh prepare [branch]   folders, settings, services, first build (site stays up)
#   setup-server.sh cutover            stop pm2, start systemd, switch nginx (seconds of downtime)
#   setup-server.sh undo               back to pm2 and the old nginx files
set -euo pipefail

APP=/srv/app
SHARED=$APP/shared
OLD=/home/wondertravelers
HERE=$(cd "$(dirname "$0")" && pwd)
NGINX_OLD=(backend.conf frontend.conf)

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "Run as root." >&2; exit 1; }

# set_env FILE KEY VALUE: replace KEY=... or append it.
set_env() {
  if grep -q "^$2=" "$1"; then
    sed -i "s|^$2=.*|$2=$3|" "$1"
  else
    printf '%s=%s\n' "$2" "$3" >> "$1"
  fi
}

prepare() {
  local branch=${1:-main}
  log "Folders"
  install -d -o wondertravelers -g wondertravelers -m 755 $APP $APP/releases $SHARED
  install -d -o wondertravelers -g wondertravelers -m 755 $SHARED/uploads
  install -d -o wondertravelers -g wondertravelers -m 700 $SHARED/app-backups $SHARED/backups

  log "Settings (shared/server.env, shared/client.env)"
  if [ ! -f $SHARED/server.env ]; then
    install -o wondertravelers -g wondertravelers -m 600 $OLD/server/.env $SHARED/server.env
  fi
  set_env $SHARED/server.env NODE_ENV production
  set_env $SHARED/server.env HOST 127.0.0.1
  set_env $SHARED/server.env PORT 5000
  set_env $SHARED/server.env ENABLE_CLUSTER false
  set_env $SHARED/server.env TRUST_PROXY loopback
  set_env $SHARED/server.env DEBUG ''
  set_env $SHARED/server.env FRONTEND_URL https://www.wondertravelers.com
  set_env $SHARED/server.env CORS_ORIGINS https://www.wondertravelers.com,https://wondertravelers.com,https://api.wondertravelers.com
  set_env $SHARED/server.env UPLOADS_DIR ./uploads

  if [ ! -f $SHARED/client.env ]; then
    install -o wondertravelers -g wondertravelers -m 600 /dev/null $SHARED/client.env
    ga=$(grep -E '^NEXT_PUBLIC_GA_ID=' $OLD/client/.env.production 2>/dev/null | cut -d= -f2- || true)
    {
      echo "# Website settings (build time and run time). Never commit this file."
      echo "NEXT_PUBLIC_BASE_URL=https://www.wondertravelers.com"
      echo "BACKEND_API_URL=http://127.0.0.1:5000"
      echo "NEXT_PUBLIC_API_URL=https://api.wondertravelers.com"
      [ -n "$ga" ] && echo "NEXT_PUBLIC_GA_ID=$ga"
    } > $SHARED/client.env
  fi

  log "Uploads -> shared/uploads (the running pm2 API uses it from now on too)"
  if [ ! -L $OLD/server/uploads ]; then
    rsync -a $OLD/server/uploads/ $SHARED/uploads/
    mv $OLD/server/uploads $OLD/server/uploads.pre-srv
    ln -s $SHARED/uploads $OLD/server/uploads
    rsync -a $OLD/server/uploads.pre-srv/ $SHARED/uploads/   # anything written in between
    chown -R wondertravelers:wondertravelers $SHARED/uploads
  fi

  log "systemd services (installed, not started yet)"
  install -m 644 "$HERE"/systemd/wondertravelers-api.service "$HERE"/systemd/wondertravelers-web.service /etc/systemd/system/
  systemctl daemon-reload
  install -m 440 "$HERE"/sudoers-wondertravelers /etc/sudoers.d/wondertravelers
  visudo -cf /etc/sudoers.d/wondertravelers

  log "Nightly backups (14 days) -> $SHARED/backups"
  install -m 700 "$HERE"/backup.sh /usr/local/bin/wt-backup.sh
  echo "0 3 * * * root /usr/local/bin/wt-backup.sh >> /var/log/wt-backup.log 2>&1" > /etc/cron.d/wt-backup

  log "nginx config staged (enabled at cutover)"
  install -m 644 "$HERE"/nginx/wondertravelers.conf /etc/nginx/sites-available/wondertravelers.conf
  "$HERE"/cloudflare.sh realip

  log "First release (built, not live)"
  install -m 755 "$HERE"/deploy.sh /usr/local/bin/wt-deploy
  sudo -u wondertravelers -H wt-deploy --branch "$branch" --no-restart
  log "Prepared. Next: $0 cutover"
}

cutover() {
  local release
  release=$(ls -1d $APP/releases/*/ | sort | tail -1 | sed 's#/$##')
  [ -n "$release" ] || { echo "No release built; run prepare first." >&2; exit 1; }

  log "Stopping pm2 apps"
  sudo -u wondertravelers -H bash -lc 'pm2 stop backend frontend >/dev/null && pm2 save --force >/dev/null'
  systemctl disable pm2-wondertravelers >/dev/null 2>&1 || true

  log "Starting $(basename "$release") under systemd"
  ln -sfn "$release" $APP/current
  systemctl enable --now wondertravelers-api.service wondertravelers-web.service

  for _ in $(seq 1 30); do
    curl -fsS -o /dev/null http://127.0.0.1:5000/health && curl -fsS -o /dev/null http://127.0.0.1:3000/en && break
    sleep 3
  done
  if ! curl -fsS -o /dev/null http://127.0.0.1:3000/en; then
    echo "New services did not answer; undoing." >&2
    undo
    exit 1
  fi

  log "Switching nginx"
  ln -sfn /etc/nginx/sites-available/wondertravelers.conf /etc/nginx/sites-enabled/wondertravelers.conf
  for f in "${NGINX_OLD[@]}"; do rm -f /etc/nginx/sites-enabled/$f; done
  if ! nginx -t; then
    echo "nginx config invalid; undoing." >&2
    undo
    exit 1
  fi
  systemctl reload nginx
  log "Cutover done. Old files stay in $OLD until you remove them."
}

undo() {
  log "Back to pm2"
  systemctl disable --now wondertravelers-web.service wondertravelers-api.service >/dev/null 2>&1 || true
  rm -f /etc/nginx/sites-enabled/wondertravelers.conf
  for f in "${NGINX_OLD[@]}"; do ln -sfn /etc/nginx/sites-available/$f /etc/nginx/sites-enabled/$f; done
  nginx -t && systemctl reload nginx
  systemctl enable pm2-wondertravelers >/dev/null 2>&1 || true
  sudo -u wondertravelers -H bash -lc 'pm2 start backend frontend >/dev/null && pm2 save --force >/dev/null'
  log "pm2 setup restored"
}

case "${1:-}" in
  prepare) prepare "${2:-main}" ;;
  cutover) cutover ;;
  undo) undo ;;
  *) echo "usage: $0 prepare [branch] | cutover | undo" >&2; exit 1 ;;
esac
