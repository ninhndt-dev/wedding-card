#!/usr/bin/env bash
set -euo pipefail

cd /opt/wedding-card
test -f .env.production
compose=(docker compose --env-file .env.production -f infra/compose.yaml -f infra/compose.production.yaml)
"${compose[@]}" config --quiet

install -d -m 0755 caddy
install -m 0644 infra/Caddyfile caddy/Caddyfile
docker exec wedding-caddy caddy validate --config /etc/caddy/Caddyfile >/dev/null
docker exec wedding-caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null

DOCKER_BUILDKIT=0 COMPOSE_PROGRESS=plain "${compose[@]}" build api web
"${compose[@]}" up -d --no-build

for attempt in $(seq 1 30); do
  if curl -fsS --max-time 5 http://127.0.0.1:3100/api/health; then
    printf '\nProduction health check passed.\n'
    "${compose[@]}" ps
    exit 0
  fi
  sleep 2
done

"${compose[@]}" logs --tail=80 api web >&2
echo 'Production health check failed.' >&2
exit 1
