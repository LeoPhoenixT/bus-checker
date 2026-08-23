# Third-Party Notices

Bus Checker includes and depends on third-party software and external data
services. Each third-party component or service remains subject to its own
license or terms.

## External data and services

### Transport Department / DATA.GOV.HK

Bus Checker uses KMB estimated-arrival and related transport information from
the Hong Kong Government open-data service published through DATA.GOV.HK.

- Dataset/API: https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb
- Terms: https://data.gov.hk/en/terms-and-conditions

The repository MIT License applies to Bus Checker source code and does not
relicense third-party transport data.

### Hong Kong Map Service

Bus Checker uses the Hong Kong Map Service for location-search results.

- Service: https://www.map.gov.hk/

The repository MIT License does not relicense data or services supplied by the
map provider.

## Direct runtime dependencies

| Package | Declared version | Upstream license |
| --- | --- | --- |
| `clsx` | `^2.1.1` | MIT |
| `geolib` | `^3.3.4` | MIT |
| `leaflet` | `^1.9.4` | BSD-2-Clause |
| `lucide-react` | `^1.7.0` | ISC |
| `next` | `16.2.1` | MIT |
| `proj4` | `^2.21.0` | MIT |
| `react` | `19.2.4` | MIT |
| `react-dom` | `19.2.4` | MIT |

## Development dependencies

The direct development dependencies declared in `package.json` are used for
building, styling, type checking, and testing. Their upstream licenses remain
applicable. This file does not attempt to reproduce the full transitive
license graph.

When adding or changing third-party packages, APIs, datasets, map providers,
fonts, or media, review their license or terms and update this notice when
needed.
