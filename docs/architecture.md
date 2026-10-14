# Architecture

One npm-workspaces repository holds the app and packages that change together.
There is one React/React Native dependency set; no task runner or backend is
needed for this foundation. Packages are private to the workspace, not released
on npm. Metro consumes their TypeScript source; adapter tests compile to ignored
`dist/` directories and run with Node's built-in test runner.

## Boundaries

- `apps/mobile` owns navigation, presentation, native permissions and lifecycle.
  Today its only controller is `demoController()`; no real client is instantiated.
- `packages/musiccast` owns HTTP, parsing, device capabilities and commands.
  It has no Expo or React dependencies. Tests inject a fetch implementation;
  they never scan a network or contact hardware.
- `packages/i18n` owns shared text. Ukrainian keys are checked against English
  at compile time and in tests. New screens must not hardcode user-facing copy.
- `packages/design` owns platform-independent design tokens. System fonts avoid
  remote font loading and support Ukrainian text; final typography remains open.

Native components will be built from the handoff, not embedded prototype HTML.
Unknown-license runtime files from the supplied archive are not included.

## Local device adapter

The adapter addresses a manually supplied private IPv4 host over Yamaha's local
HTTP API. It currently supports the main zone, capabilities/status, network/USB
track metadata, explicit on/standby, source switching with autoplay disabled,
relative volume steps, mute, and network/USB transport. Artwork accepts only
restricted image paths on the same device origin, without credentials or query
parameters. Read requests time out after five seconds; redirects are rejected.

The private-address check is deliberately conservative: hostnames, IPv6,
loopback, public addresses, and addresses ending in .0/.255 are unsupported.
There is no automatic discovery, catalog browser, authentication flow, event
listener, caching, room grouping, absolute-volume slider, or mobile storage yet.
Connectivity labels describe advertised support, not enabled settings.

Commands are serialized per client. A write is sent once; only observation reads
are retried. Power/input/mute/volume require the requested state to be observed.
Play/pause requires matching track playback. Next/previous can only acknowledge
the accepted request and return current metadata; this does not confirm a track
transition. Failure after dispatch is uncertain: refresh before another write.
Other controllers can change the same device, so confirmation is an observation,
not an exclusive lock or a guarantee that a state will remain unchanged.

Do not expose raw adapter error text as localized product copy. The next native
connection layer must map failures to bilingual UI messages and show stale state.

## Native integration gate

Local HTTP can require platform transport exceptions and local-network access.
The current demo needs neither, so production permissions and transport policies
are not claimed as configured. Define the narrowest required native settings,
test denied access, then wire the real adapter. Test LAN reachability, standby
wake with Network Standby enabled/disabled, resume/reconnect, response failures,
and concurrent external remote actions on both mobile platforms.

No analytics, backend, AI provider, or streaming service credentials are present.
Future integrations must be optional and document data flow and media licenses.
