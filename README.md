# Bus Checker

Bus Checker is a bilingual, mobile-friendly web application for finding nearby
KMB bus stops, viewing estimated arrival times, filtering routes, saving
favourites, and finding direct routes toward a destination.

The deployed application is available at [bus.leotctam.com](https://bus.leotctam.com/).

## Features

- Nearby-stop discovery using browser geolocation
- Live KMB estimated arrival times
- Direct-route matching to a selected stop or map location
- English and Traditional Chinese interfaces
- Light and dark themes
- Browser-local favourite routes

## Requirements

- Node.js 26
- pnpm 10.27.0

## Local development

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://localhost:3000>. Location features require browser permission and
a secure context when the application is not running on localhost.

## Verification

```sh
pnpm test
pnpm build
```

## Container image

Build locally with:

```sh
docker build -t bus-checker .
docker run --rm -p 3000:3000 bus-checker
```

The GitHub workflow publishes images to
`ghcr.io/leophoenixt/bus-checker`. See [deployment/README.md](deployment/README.md)
for the Docker Compose deployment workflow.

## External services and data

The application requests transport data from the
[Hong Kong Government KMB ETA API](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb)
and location-search results from the
[Hong Kong Map Service](https://www.map.gov.hk/). Availability and accuracy
depend on those services. Their data and services remain subject to their own
terms and licences. This project is not affiliated with or endorsed by KMB or
the Hong Kong Government.

The application is an informational aid only. Confirm critical journey details
with the relevant transport operator.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change. Please report
security vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

The source code is available under the [MIT License](LICENSE). This licence does
not grant rights to third-party transport or map data.

<!-- Temporary CI verification change. -->
