#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

echo "Pulling latest bus-checker image..."
docker compose pull

echo "Starting updated container..."
docker compose up -d --remove-orphans

echo "Container status:"
docker compose ps

echo "Removing unused images..."
docker image prune -f
