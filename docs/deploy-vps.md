# Deploy to a VPS with Docker Compose

Target: the existing Ubuntu 18.04 VPS with 8 GB RAM and 40 GB disk. The current project is built into three containers: MySQL, Spring Boot API, and nginx frontend. The commands below use `103.151.52.69` and plain HTTP until a domain and TLS are configured. Do not sign in to the admin page over public HTTP.

From the local repository root, the one-command deployment is:

```sh
bash infra/scripts/deploy-vps.sh
```

It exports the local MySQL database, packages tracked source, uploads both files via SSH, installs Docker on the VPS, imports the data, builds the containers, and checks the public health endpoint. SSH will prompt for the VPS password. The script keeps a private copy of the SQL dump under `/root/wedding-card-deploy/` on the VPS. The sections below show the steps individually.

## 1. Prepare the server

Ubuntu 18.04 is no longer among the releases supported by the current [Docker Engine Ubuntu packages](https://docs.docker.com/engine/install/ubuntu/). This VPS offers `docker.io` 20.10.21 from its Ubuntu repositories. Install that package and Compose v2.35.1 using the [manual plugin method](https://docs.docker.com/compose/install/linux/). This path must be verified on the VPS before importing data:

```sh
apt-get update
apt-get install -y docker.io curl ca-certificates
systemctl enable --now docker
install -d -m 0755 /usr/local/lib/docker/cli-plugins
curl -fL --retry 3 https://github.com/docker/compose/releases/download/v2.35.1/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod 755 /usr/local/lib/docker/cli-plugins/docker-compose
docker version --format '{{.Server.Version}}'
docker compose version
```

Only SSH (22) and HTTP (80) need to be open to the public. MySQL stays bound to loopback at port 3308.

## 2. Export the current database and package the source (local machine)

Run from the repository root. The database dump contains guest details and invitation links; keep it private.

```sh
docker compose --env-file .env.local -f infra/compose.yaml exec -T mysql \
  sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump -h127.0.0.1 -u"$MYSQL_USER" --single-transaction --hex-blob --set-gtid-purged=OFF "$MYSQL_DATABASE"' \
  > /tmp/wedding-card.sql
test -s /tmp/wedding-card.sql
git ls-files -z | tar --null -czf /tmp/wedding-card-source.tar.gz -T -
scp /tmp/wedding-card.sql /tmp/wedding-card-source.tar.gz root@103.151.52.69:/root/
```

The archive includes tracked source files as they exist locally, including uncommitted tracked changes. It excludes `.env.local` and local guest data.

## 3. Initialize the server (SSH as root)

```sh
mkdir -p /opt/wedding-card
tar -xzf /root/wedding-card-source.tar.gz -C /opt/wedding-card
cd /opt/wedding-card
umask 077
DB_PASSWORD=$(openssl rand -hex 24)
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 24)
SESSION_SECRET=$(openssl rand -hex 32)
ADMIN_PASSWORD=$(openssl rand -hex 16)
cat > .env.production <<EOF
APP_ORIGIN=http://103.151.52.69
COOKIE_SECURE=false
WEB_BIND_ADDRESS=0.0.0.0
WEB_PORT=80
DB_NAME=wedding_card
DB_USER=wedding
DB_PASSWORD=$DB_PASSWORD
MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD
ADMIN_PASSWORD=$ADMIN_PASSWORD
SESSION_SECRET=$SESSION_SECRET
EOF
chmod 600 .env.production
printf 'Save the admin password now: %s\n' "$ADMIN_PASSWORD"
```

Do not run the initialization block again after data is imported: it generates new database credentials.

## 4. Import data and start the app (server)

```sh
cd /opt/wedding-card
docker compose --env-file .env.production -f infra/compose.yaml -f infra/compose.production.yaml up -d --wait mysql
docker compose --env-file .env.production -f infra/compose.yaml -f infra/compose.production.yaml \
  exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -u"$MYSQL_USER" "$MYSQL_DATABASE"' \
  < /root/wedding-card.sql
docker compose --env-file .env.production -f infra/compose.yaml -f infra/compose.production.yaml up -d --build
docker compose --env-file .env.production -f infra/compose.yaml -f infra/compose.production.yaml ps
curl -fsS http://127.0.0.1/api/health
```

Then check `http://103.151.52.69/thiep-01/index.html` from a browser. Verify public invitation links and media. Keep `/root/wedding-card.sql` as a private backup until the migration has been verified; remove the source tar afterward. Configure a domain and HTTPS before using the admin login over the internet, then set `APP_ORIGIN` to the exact HTTPS URL and `COOKIE_SECURE=true`.

## Automatic deployment

The workflow at `.github/workflows/deploy-production.yml` runs on pushes to `main` and can also be started manually. It checks the frontend, then uses a dedicated SSH key to sync tracked source files to `/opt/wedding-card` and runs `infra/scripts/deploy-production.sh` on the VPS. It preserves `.env.production`, the Caddy directory and Docker volumes, so deployment does not replace the database or uploaded media.

Add the complete contents of `/home/ninhndt/.ssh/wedding_ci_deploy_ed25519` as the GitHub repository Actions secret `VPS_SSH_PRIVATE_KEY`. Do not commit or send the private key in chat. The public key is installed in the VPS root account. `.github/known_hosts` pins the VPS SSH host key. After the secret is in place, push to `main` and check the **Deploy production** workflow in GitHub Actions. To rotate the deploy key, replace the GitHub secret and VPS authorized key together.
