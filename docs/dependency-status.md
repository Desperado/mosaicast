# Dependency status

Checked on 14 October 2026 against the committed npm lockfile. `npm audit`
reports 28 affected package entries: 18 high and 10 moderate, with no critical
entries. Many entries share the same underlying advisory through Expo/Metro
dependency chains; they are not 28 independent defects.

| Package | Advisory | Severity |
| --- | --- | --- |
| braces | [Nested-pattern stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | High |
| node-forge | [RSA signature validation](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | High |
| decode-uri-component | [Malformed URI decoding](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) | Moderate |
| uuid | [Buffer bounds handling](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | Moderate |

The braces and node-forge advisories currently list no patched version. npm's
suggested automatic changes include incompatible Expo downgrades and a Router
upgrade outside this SDK. Do not use `npm audit fix --force` or override major
versions without checking compatibility and rerunning native builds.

This scaffold has not had a complete dependency reachability assessment. Build
tools and runtime packages both require review; a passing demo or web export
does not establish that a vulnerable path is unreachable. Before distributing
a mobile binary, triage these advisories, adopt compatible upstream fixes or
document an evidence-based mitigation, and repeat the audit against the release
lockfile. Dependabot is configured to surface updates.
