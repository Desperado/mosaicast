# Architecture

One npm-workspaces repository holds the app and packages that change together.
There is one React/React Native dependency set; no task runner or cloud backend is
needed. A loopback bridge enables the browser development preview. Packages are private to the workspace, not released
on npm. Metro consumes their TypeScript source; adapter tests compile to ignored
`dist/` directories and run with Node's built-in test runner.

## Boundaries

- `apps/mobile` owns navigation, presentation, native permissions and lifecycle.
  It selects an isolated demo or one explicitly connected device session.
- `packages/musiccast` owns HTTP, parsing, device capabilities and commands.
  It has no Expo or React dependencies. Tests inject a fetch implementation;
  they never scan a network or contact hardware.
- `packages/i18n` owns shared text. Ukrainian keys are checked against English
  at compile time and in tests. New screens must not hardcode user-facing copy.
- `packages/design` owns platform-independent design tokens. System fonts avoid
  remote font loading and support Ukrainian text; final typography remains open.

Native components are built from the handoff, rather than embedded prototype HTML.
Unknown-license runtime files from the supplied archive are not included.

## App state

An app provider owns two independent demo controllers, their snapshots, and the
active room. Commands are locked per room, including before React renders the
busy state. Rooms and playback are session-only fixtures; they are never saved
as discovered hardware. CD and radio examples hide unsupported track controls.

AsyncStorage holds one versioned preferences record: appearance, language,
onboarding completion, selected demo/device mode, a private IPv4 address, and up to
512 hidden Bluetooth entries keyed by receiver host and headphone address. System preferences
follow React Native's color-scheme hook and Expo Localization's locale hook;
unsupported system languages fall back to English. Writes are queued in order,
including after an earlier failure, and failure is shown with a retry action.
Malformed records produce a visible load error and session defaults.

The Connection screen normalizes locale commas and outer whitespace, validates
an address, reads model/capabilities/status,
then saves the mode/address only after connecting. A saved device reconnects on
launch with reads only. A saved address without an explicit device mode remains
in demo mode. Switching to demo invalidates the session and sends no commands.

`DeviceSession` serializes reads and commands and drops late responses after a
connection changes. Failed reads mark displayed state stale and disable commands.
Any failed command conservatively requires an explicit successful refresh before
another write. Routine foreground polling waits 30 seconds after a completed
read or command. Automatic refreshes do not set UI busy state; an enabled control
reserves its command and waits for any in-flight read instead of dropping the tap.
No reads or commands overlap within a connection. Polling pauses outside the live
room, while the app is inactive/backgrounded, and in hidden browser tabs. Resume
respects the same freshness deadline. Failed reads back off to one, then two
minutes; an explicit refresh remains immediate. A requested Bluetooth search
uses three-second reads for at most 30 seconds, then the normal interval.
Automatic polling cannot clear an uncertain command. Pending, confirmed,
accepted and uncertain outcomes are distinct. No raw error is shown as UI copy.

## Local device adapter

The adapter addresses a selected or manually supplied private IPv4 host over Yamaha's local
HTTP API. It currently supports the main zone, capabilities/status, network/USB
track metadata, explicit on/standby, source switching with autoplay disabled,
relative volume steps, mute, and network/USB transport. Artwork accepts only
restricted image paths on the same device origin, without credentials or query
parameters. Read requests time out after five seconds; redirects are rejected.

The private-address check is deliberately conservative: hostnames, IPv6,
loopback, public addresses, and addresses ending in .0/.255 are unsupported.
There is no catalog browser, authentication flow, event
listener, persistent capability caching, room grouping, absolute-volume slider, or persisted device registry yet.
Connectivity labels describe advertised support, not enabled settings.

Bluetooth output is exposed only for devices advertising `bluetooth_tx_setting`
in `system/getFeatures`. Powered-on snapshots read `getBluetoothInfo` and, when
output is enabled, the cached `getBluetoothDeviceList`. Bluetooth read failures
leave the main player usable and Bluetooth controls unavailable. A user request
alone triggers `updateBluetoothDeviceList`; polling never starts a search.
Commands refresh capabilities, power/input and Bluetooth state before dispatch.
Connections require an address in Yamaha's current list and a finished search.
Bluetooth input blocks enabling, searching and connecting; disconnecting and
disabling remain available. Enable/connect/disconnect require observed state;
search only reports acceptance. Connect requests allow 20 seconds for Yamaha's
response. No Bluetooth write is retried. Demo has no Bluetooth capabilities.
The commands follow Yamaha Extended Control API Basic Rev. 2.0, sections 4.14–4.20;
a user has confirmed a headphone connection on hardware. The receiver volume/mute
controls do not adjust Bluetooth headphone volume. The UI labels speaker volume
and directs the listener to headphone controls while Bluetooth output is enabled.
Removing an old entry only filters Mosaicast's list and persists locally; it sends
no device command. Connected headphones stay visible, even if previously hidden.
Restore clears the filter for the current receiver only. Pairing deletion is not
exposed by the documented Yamaha API and is not presented as an available control.

On-demand native discovery uses Expo Network to obtain the phone's local IPv4
on Wi-Fi or Ethernet. The pure adapter scans only its `/24` range, skipping the
phone, with 12 workers and 1.2-second abortable probes to the fixed
`system/getDeviceInfo` endpoint. Non-success, malformed, redirected or oversized
responses are ignored; only successful Yamaha-shaped responses with a model name
appear. Results are not persisted or automatically connected. Screen blur,
backgrounding, manual entry, selecting a result and demo mode cancel outstanding
probes and discard late results. The browser module never requests a public IP.

This bounded HTTP fallback avoids a multicast entitlement, but does not discover
the actual subnet mask, search other ranges or replace SSDP. Permission denial
and unreachable devices can both produce an empty result, with manual IP as the
fallback. Physical-phone discovery and denied-permission flows need validation.

Commands are serialized per client. A write is sent once; only observation reads
are retried. Power/input/mute/volume require the requested state to be observed.
Play/pause requires matching track playback. Next/previous can only acknowledge
the accepted request and return current metadata; this does not confirm a track
transition. Failure after dispatch is uncertain: refresh before another write.
Other controllers can change the same device, so confirmation is an observation,
not an exclusive lock or a guarantee that a state will remain unchanged.

## Native and browser transport

Native code instantiates `MusicCastClient` directly. The Expo config adds
`NSLocalNetworkUsageDescription` and `NSAllowsLocalNetworking` for iOS, and an
Android manifest config plugin enables cleartext HTTP because arbitrary manually
entered IP addresses cannot be expressed as fixed network-security domains.
The adapter still rejects non-private hosts and redirects. This transport policy
is needed for Yamaha's HTTP API, not a general external-service exception.
See [Apple's local-network transport setting](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking)
and [Expo config plugins](https://docs.expo.dev/config-plugins/plugins/).

The `.web.ts` controller talks to the development-only Node bridge on
`127.0.0.1:8092`. The bridge validates Host and Origin, limits JSON to 4 KiB,
accepts only read/known commands and private IPv4 targets, and caches at most
eight clients so command locks cannot be lost by eviction. Restart it to reset
the device limit. It bounds concurrent requests to eight. No target URLs,
credentials, arbitrary Yamaha routes, or raw errors cross this interface.
Do not run it behind a public server or broaden its bind address/origin list.

## Native integration gate

A localhost browser connection to a CD-NT670D verified status, network-track
metadata, reported sources/capabilities, refresh and read-only restoration.
UI writes and iOS/Android binaries have not been validated by these checks.
Build new binaries with the native configuration and test denied access, LAN
reachability, standby wake with Network Standby enabled/disabled, resume,
response failures and concurrent external remote actions on both platforms.

No analytics, cloud backend, AI provider, or streaming service credentials are
present. Future integrations must be optional and document data flow and licenses.
