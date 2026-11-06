#!/usr/bin/env bash
set -euo pipefail

image="${1:?Usage: docker-smoke.sh IMAGE}"
container=bus-checker-smoke
docker run --detach --name "$container" --publish 127.0.0.1:3000:3000 "$image"
trap 'docker logs "$container"; docker rm --force "$container"' EXIT

curl --fail --retry 15 --retry-all-errors --retry-delay 2 http://127.0.0.1:3000/ --output /tmp/home.html
curl --fail http://127.0.0.1:3000/routes --output /dev/null
curl --fail http://127.0.0.1:3000/favourites --output /dev/null
asset=$(grep -oE '/_next/static/[^" ]+\.js' /tmp/home.html | sed -n '1p')
test -n "$asset"
curl --fail "http://127.0.0.1:3000$asset" --output /dev/null
docker exec "$container" node -e "if (process.getuid() !== 1000) process.exit(1)"
test "$(docker exec "$container" node --version)" = "v$(cat .node-version)"
python3 -c 'import json; print(json.dumps({"padding": "x" * 512000}))' > /tmp/oversized.json
for endpoint in direct-routes favourite-route-stops; do
  status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
    --header 'Content-Type: application/json' --header 'Transfer-Encoding: chunked' \
    --data-binary @/tmp/oversized.json "http://127.0.0.1:3000/api/$endpoint")
  test "$status" = 413
done
for attempt in $(seq 1 45); do
  health=$(docker inspect --format '{{.State.Health.Status}}' "$container")
  if [ "$health" = healthy ] || [ "$health" = unhealthy ]; then
    break
  fi
  sleep 2
done
docker inspect --format '{{json .State.Health}}' "$container"
test "$health" = healthy
