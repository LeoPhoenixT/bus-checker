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
| `react-leaflet` | `^5.0.0` | Hippocratic License 2.1 |

### React Leaflet 5.0.0

React Leaflet 5.0.0 is not licensed under MIT. Its upstream license is the
Hippocratic License 2.1:

- Upstream project: https://github.com/PaulLeCam/react-leaflet
- License for v5.0.0: https://github.com/PaulLeCam/react-leaflet/blob/v5.0.0/LICENSE.md
- Upstream copyright holder identified by that license: Paul Le Cam and contributors

The Hippocratic License 2.1 contains conditions beyond ordinary permissive
licenses. In particular, its notice provision requires recipients of copies of
React Leaflet to receive the applicable license and copyright notice. It also
contains use conditions and an indemnity provision. The upstream license text is
authoritative and must be reviewed before redistribution.

Bus Checker's MIT License applies only to code authored for this repository. It
does not replace, override, or relicense React Leaflet. Do not describe the
complete dependency stack or a bundled distribution as MIT-only.

When distributing an artifact that contains React Leaflet code, including a
bundled client build, container image, or other redistributable package, the
release/distribution process must preserve the React Leaflet copyright notice
and provide the complete upstream Hippocratic License 2.1 text alongside the
artifact as required by that license. A URL in this repository is useful for
reference but should not be treated as a substitute for the license material
required for a distributed copy.

The repository currently references React Leaflet as a package dependency rather
than vendoring its source tree. This notice documents the dependency and does not
change its upstream terms.

## Development dependencies

The direct development dependencies declared in `package.json` are used for
building, styling, type checking, and testing. Their upstream licenses remain
applicable. This file does not attempt to reproduce the full transitive
license graph.

When adding or changing third-party packages, APIs, datasets, map providers,
fonts, or media, review their license or terms and update this notice when
needed.
