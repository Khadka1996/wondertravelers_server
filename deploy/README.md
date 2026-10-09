# Deploying wondertravelers.com

Two programs on one VPS, behind nginx and Cloudflare:

| Program | Code | Runs as | Listens on |
|---|---|---|---|
| Website (Next.js) | `Khadka1996/wondertravelers` | `wondertravelers-web.service` | 127.0.0.1:3000 |
| API (Express) | `Khadka1996/wondertravelers_server` | `wondertravelers-api.service` | 127.0.0.1:5000 |

MongoDB and Redis listen on 127.0.0.1 only. nginx sends `www.wondertravelers.com`
to the website and `api.wondertravelers.com` to the API; the bare domain
redirects to `www`. The website calls the API on 127.0.0.1, and the browser
calls `/api/...` on the website's own domain (Next.js passes it on), so the
sign-in cookie is same-site.

## Folders on the server

```
/srv/app/releases/<time>/{server,client}  one folder per deploy (last 3 kept)
/srv/app/current -> releases/<time>       the live one
/srv/app/shared/server.env                API settings (never in git)
/srv/app/shared/client.env                website settings (never in git)
/srv/app/shared/uploads/                  uploaded images (nginx serves them directly)
/srv/app/shared/backups/                  nightly database + uploads, 14 days
/srv/app/shared/migrations.done           migrations already applied
```

## Publish a change

1. Commit and push to `main` in both repositories (or the one you changed).
2. On the server:
   ```
   sudo -u wondertravelers /srv/app/current/server/deploy/deploy.sh
   ```
   It clones both repositories into a new release, links `shared/`, installs
   packages, builds the website, runs new files in `server/migrations/`, then
   switches `current` and restarts both services. If the site does not answer
   within 90 seconds it switches back to the previous release by itself.
3. Go back by hand: `deploy.sh --rollback`.

Other branch: `deploy.sh --branch my-branch`. Build without going live: `--no-restart`.

## Logs and status

```
systemctl status wondertravelers-api wondertravelers-web
journalctl -u wondertravelers-api -f
journalctl -u wondertravelers-web -n 200
cat /srv/app/current/REVISION
```

## Database migrations

A migration is a script in `server/migrations/` that accepts `--apply` and is
safe to run twice. `deploy.sh` runs each one once and records it in
`shared/migrations.done`.

## Cloudflare

- DNS: `@`, `www` and `api` A records to the server, proxied (orange cloud).
- SSL/TLS mode **Full (strict)**; certbot keeps a real certificate on the server.
- `deploy/cloudflare.sh realip` - nginx reads the visitor address from Cloudflare.
- `deploy/cloudflare.sh firewall` - only Cloudflare may reach ports 80/443.
  Run it only after **all three** records are proxied, or the API stops answering.

## First-time setup (already done once)

```
deploy/setup-server.sh prepare main   # folders, settings, services, first build
deploy/setup-server.sh cutover        # pm2 -> systemd, new nginx config
deploy/setup-server.sh undo           # back to pm2 if anything is wrong
```
