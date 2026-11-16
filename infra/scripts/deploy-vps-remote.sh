#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" != 0 ]]; then
  echo 'Run as root on the VPS' >&2
  exit 1
fi
if [[ "$(. /etc/os-release; echo "$VERSION_ID")" != '18.04' ]]; then
  echo 'This bootstrap is intended for the existing Ubuntu 18.04 VPS' >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y docker.io curl ca-certificates openssl
systemctl enable --now docker

install -d -m 0755 /usr/local/lib/docker/cli-plugins
if ! docker compose version >/dev/null 2>&1; then
  curl -fL --retry 3 \
    https://github.com/docker/compose/releases/download/v2.35.1/docker-compose-linux-x86_64 \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod 755 /usr/local/lib/docker/cli-plugins/docker-compose
fi
docker version --format '{{.Server.Version}}'
docker compose version

install -d -m 0755 /opt/wedding-card
tar -xzf /root/wedding-card-deploy/wedding-card-source.tar.gz -C /opt/wedding-card
cd /opt/wedding-card

if [[ ! -f .env.production ]]; then
  umask 077
  db_password="$(openssl rand -hex 24)"
  mysql_root_password="$(openssl rand -hex 24)"
  session_secret="$(openssl rand -hex 32)"
  admin_password="$(openssl rand -hex 16)"
  cat > .env.production <<EOF
APP_ORIGIN=http://103.151.52.69
COOKIE_SECURE=false
WEB_BIND_ADDRESS=0.0.0.0
WEB_PORT=80
DB_NAME=wedding_card
DB_USER=wedding
DB_PASSWORD=$db_password
MYSQL_ROOT_PASSWORD=$mysql_root_password
ADMIN_PASSWORD=$admin_password
SESSION_SECRET=$session_secret
EOF
  chmod 600 .env.production
  printf 'Save the admin password now: %s\n' "$admin_password"
fi

compose=(docker compose --env-file .env.production -f infra/compose.yaml -f infra/compose.production.yaml)
"${compose[@]}" config --quiet
"${compose[@]}" up -d --wait mysql

if [[ ! -f /root/wedding-card-deploy/import-complete ]]; then
  existing_tables="$("${compose[@]}" exec -T mysql sh -c \
    'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -N -u"$MYSQL_USER" "$MYSQL_DATABASE" -e "SHOW TABLES"')"
  if [[ -n "$existing_tables" ]]; then
    echo 'Database already contains tables; refusing to import a second time' >&2
    exit 1
  fi

  "${compose[@]}" exec -T mysql sh -c \
    'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -u"$MYSQL_USER" "$MYSQL_DATABASE"' \
    < /root/wedding-card-deploy/wedding-card.sql
  "${compose[@]}" exec -T mysql sh -c \
    'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -e "DELETE FROM admin_sessions"'
  touch /root/wedding-card-deploy/import-complete
fi

DOCKER_BUILDKIT=0 "${compose[@]}" up -d --build
"${compose[@]}" ps
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1/api/health; then
    printf '\nDeployment is responding at http://103.151.52.69/\n'
    exit 0
  fi
  sleep 2
done
echo 'API health check did not pass; inspect docker compose logs' >&2
exit 1
