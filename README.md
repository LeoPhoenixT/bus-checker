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

The application requests KMB estimated-arrival and related transport data from
the Hong Kong Government open-data service published through
[DATA.GOV.HK](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb), and
location-search results from the [Hong Kong Map Service](https://www.map.gov.hk/).

The source code authored for this repository is licensed under MIT. That license
does not relicense third-party transport data, map/search data, APIs, services,
software, names, or marks. Runtime dependencies also remain subject to their own
licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the current
dependency and data-source inventory and redistribution notes.

This project is independently developed and is not affiliated with or endorsed
by KMB, the Transport Department, DATA.GOV.HK, the HKSAR Government, or the Hong
Kong Map Service.

Arrival times, route information, map results, and external-service
availability may be delayed, incomplete, or inaccurate. Confirm time-sensitive
journey information with the relevant transport operator.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change. Please report
security vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

Bus Checker source code authored for this repository is available under the
[MIT License](LICENSE). Third-party software, data, APIs, services, names, and
marks are excluded from that grant and remain subject to their own terms. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
