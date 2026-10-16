# Security policy

This is a pre-release scaffold. Only the latest main branch is maintained.

Report vulnerabilities privately using GitHub's **Report a vulnerability**
under the repository's Security tab. If that option is unavailable, open a
minimal issue requesting a private reporting channel; do not disclose exploit
details, credentials, or personal network information publicly.

Reports should describe impact, affected commit, and an offline reproduction.
No response-time guarantee is made. The maintainer will triage and coordinate
fixes and disclosure with the reporter.

The controller operates on a trusted local network; Yamaha's local HTTP
API is not an internet-facing service. Never expose device ports through a
router. Live mode sends explicitly requested hardware commands; demo mode
never contacts hardware. The app collects no telemetry. The optional browser
bridge binds to loopback and only accepts allowlisted localhost origins. Never
expose it publicly or change its bind address to an external interface.
