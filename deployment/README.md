# VPS deployment

The application image is built by GitHub Actions and published to GitHub Container Registry:

```text
ghcr.io/leophoenixt/bus-checker:latest
```

## First-time setup

1. Copy this `deployment` directory to the VPS.
2. Create `deployment/.env` with the runtime environment variables required by the application.
3. Create a GitHub personal access token with `read:packages` permission.
4. Log in to GitHub Container Registry:

```sh
echo "$GHCR_TOKEN" | docker login ghcr.io -u LeoPhoenixT --password-stdin
```

5. Make the deployment script executable:

```sh
chmod +x deploy.sh
```

## Deploy

Run:

```sh
./deploy.sh
```

This pulls the latest pre-built image and recreates the container without building the application on the VPS.

## Rollback

Change the image tag in `docker-compose.yml` from `latest` to a previously published `sha-<commit>` or version tag, then run `./deploy.sh` again.
