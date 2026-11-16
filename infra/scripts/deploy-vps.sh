#!/usr/bin/env bash
set -euo pipefail

server="root@103.151.52.69"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

for command_name in docker git tar ssh scp curl; do
  command -v "$command_name" >/dev/null || { echo "Missing local command: $command_name" >&2; exit 1; }
done
test -f .env.local || { echo "Missing .env.local for the current database" >&2; exit 1; }

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
chmod 700 "$work_dir"

echo "Exporting the local wedding_card database..."
docker compose --env-file .env.local -f infra/compose.yaml exec -T mysql \
  sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump -h127.0.0.1 -u"$MYSQL_USER" --single-transaction --hex-blob --set-gtid-purged=OFF "$MYSQL_DATABASE"' \
  > "$work_dir/wedding-card.sql"
test -s "$work_dir/wedding-card.sql" || { echo "Database dump is empty" >&2; exit 1; }

echo "Packaging Git-tracked source files..."
git ls-files -z | tar --null -czf "$work_dir/wedding-card-source.tar.gz" -T -
test -s "$work_dir/wedding-card-source.tar.gz"

echo "Uploading source and database backup to $server..."
ssh "$server" 'install -d -m 0700 /root/wedding-card-deploy'
scp "$work_dir/wedding-card.sql" "$work_dir/wedding-card-source.tar.gz" "$server:/root/wedding-card-deploy/"

echo "Installing prerequisites and starting the app on the VPS..."
ssh "$server" 'bash -s' < "$repo_root/infra/scripts/deploy-vps-remote.sh"

echo "Checking the public HTTP endpoint..."
curl -fsS --max-time 15 http://103.151.52.69/api/health
printf '\nPublic endpoint is responding at http://103.151.52.69/\n'
