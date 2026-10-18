# Architecture

One npm-workspaces repository holds the app and packages that change together.
There is one React/React Native dependency set; no task runner or cloud backend is
needed. A loopback bridge enables the browser development preview. Packages are private to the workspace, not released
on npm. Metro consumes their TypeScript source; adapter tests compile to ignored
`dist/` directories and run with Node's built-in test runner.
Root linting first builds the shared MusicCast package, because the TV's Node
adapter imports that compiled entry point. A clean checkout needs no earlier
test or build run before `npm run check`.

## Boundaries

- `apps/mobile` owns navigation, presentation, native permissions and lifecycle.
  It selects an isolated demo or one explicitly connected device session.
- `apps/frame` owns the imported Tizen UI, remote navigation and Key Manager pairing.
  Its companion adapter translates the shared semantic contract, with no raw Yamaha
  forwarding. Standalone protocol code remains available only in explicit direct mode.
- `apps/mobile/modules/mosaicast-peer` owns the foreground iOS Wi-Fi listener.
  The shared peer layer encrypts requests and fences writes by coordinator ownership.
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
another write. In direct phone mode, routine foreground polling waits 30 seconds after a completed
read or command. Automatic refreshes do not set UI busy state; an enabled control
reserves its command and waits for any in-flight read instead of dropping the tap.
No reads or commands overlap within a connection. Polling pauses outside the live
room, while the app is inactive/backgrounded, and in hidden browser tabs. Resume
respects the same freshness deadline. Failed reads back off to one, then two
minutes; an explicit refresh remains immediate. A requested Bluetooth search
uses three-second reads for at most 30 seconds, then the normal interval.
Shared mode uses the active coordinator's existing two-second receiver updates;
session polling is disabled there. Passive Bluetooth reads never initiate a search.
Automatic polling cannot clear an uncertain command. Pending, confirmed,
accepted and uncertain outcomes are distinct. No raw error is shown as UI copy.

## Local device adapter

The adapter addresses a selected or manually supplied private IPv4 host over Yamaha's local
HTTP API. It currently supports the main zone, capabilities/status, network/USB
track metadata, explicit on/standby, source switching with autoplay disabled,
relative volume steps, mute, network/USB transport, and reported FM/DAB controls. Artwork accepts only
restricted image paths on the same device origin, without credentials or query
parameters. Ordinary requests time out after five seconds; source-menu reads
allow 35 seconds for Yamaha's documented 30-second retrieval window. Redirects
are rejected. Reads, menu operations and commands share one client lock.

The private-address check is deliberately conservative: hostnames, IPv6,
loopback, public addresses, and addresses ending in .0/.255 are unsupported.
There is no authentication flow, event
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

On iOS, discovery and the peer listener use the same native private IPv4 lookup
on the active en0 Wi-Fi interface. VPN default routes and other en* interfaces
cannot override it. Android uses Expo Network's WifiManager address lookup.
Address failures expose only fixed diagnostic codes, never interface dumps or
raw errors. Default-route classification does not gate LAN access. The pure adapter
scans only its `/24` range, skipping the phone, with 12 workers and 1.2-second abortable probes to the fixed
`system/getDeviceInfo` endpoint. Non-success, malformed, redirected or oversized
responses are ignored; only successful Yamaha-shaped responses with a model name
appear. Results are not persisted or automatically connected. Screen blur,
backgrounding, manual entry, selecting a result and demo mode cancel outstanding
probes and discard late results. The browser module never requests a public IP.

This bounded HTTP fallback avoids a multicast entitlement, but does not discover
the actual subnet mask, search other ranges or replace SSDP. Permission denial
and unreachable devices can both produce an empty result, with manual IP as the
fallback. A tester confirmed discovery on an iPhone 15 Pro Max; Android and
denied-permission flows still need validation.

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
accepts only read/known commands/typed browse requests and private IPv4 targets, and caches at most
eight clients so command locks cannot be lost by eviction. Restart it to reset
the device limit. It bounds concurrent requests to eight. No target URLs,
credentials, arbitrary Yamaha routes, or raw errors cross this interface.
Do not run it behind a public server or broaden its bind address/origin list.
The browser transport allows up to 120 seconds for a browse operation, which
can include two slow menu reads and status/capability checks.

## Source browsing

The adapter implements the shared main-zone Net/USB menu for reported Deezer,
server, USB and internet-radio inputs. This is an implementation allowlist,
not a capability claim: the actual menu can be unavailable. No service account
endpoints, credentials, thumbnails or external URLs are used.

`getListInfo` pages contain at most eight rows. Absolute row indexes and
select/play/search attribute bits control available actions. Select enters a
folder, return moves up one layer, and play specifies the main zone. Search is
an explicit JSON POST only on an advertised search node; it is not saved or
included in a URL. Device text uses Yamaha's English fallback because its API
does not advertise Ukrainian; the surrounding interface is localized.

Each displayed page gets a session token. Before any menu action, the adapter
refreshes capabilities/status and rereads that same input/page. Changed menu
contents invalidate the token and require a menu refresh without dispatching
the action. Other remotes can still change the menu between that read and the
write: this is a conservative stale-menu check, not an exclusive lock.

Every action is sent once. A failed write or failed follow-up menu read is
uncertain and disables all session writes until an explicit status refresh;
the user then refreshes the menu. Playback acknowledgement remains an internal
outcome; Listen shows observed metadata without claiming that the requested
track has started. Polling never navigates or replays an action. Generation
checks discard late browsing results after disconnect or connection replacement.
Demo catalogs are separate per-room fixtures and never create a device client.

## FM and DAB radio

Only inputs with Yamaha's `play_info_type: tuner` and reported tuner bands expose
radio controls. FM range/step and preset type/count come from `getFeatures`, not
model names or demo defaults. `getPlayInfo` supplies FM/RDS or DAB station text.
Radio metadata failure preserves usable power/volume status and hides unavailable
tuning actions. Presets preserve device slot indexes and are checked again
before recall; unknown or empty slots cannot dispatch a command.

FM controls send relative frequency steps or seek. DAB controls change services;
an off-air service can still be left. An uninitialized DAB list offers an explicit
scan/cancel only when the receiver advertises `dab_initial_scan`. Band changes
require an observed matching band. Tuning, service, preset and scan requests are
accepted once and then observed; asynchronous tuning is not claimed as a
confirmed station transition. No radio write is retried. Demo radio is fictional
and uses no real client.

## iPhone volume buttons

The app layer owns the native volume module; the adapter stays independent of
React Native. While a real connected Yamaha is on and the app is active, iOS
output-volume changes become relative Yamaha volume commands through the same
session guards as screen buttons. Busy or stale state rejects presses without
queuing; uncertain writes require explicit refresh. Reported device limits apply.

iOS exposes output-volume changes rather than public physical-button events.
The app hides the system overlay, anchors phone output at a midpoint so both
buttons work at phone-volume endpoints, and ignores its own reset callbacks.
It restores the original output volume before another capture can start. Capture
stops on inactivity, standby, disconnection, uncertainty or demo mode. Failure
restores phone volume and offers screen controls. Native behavior, including
audio-route changes, requires physical-device testing.

## Native integration gate

A localhost browser connection to a CD-NT670D verified status, network-track
metadata, reported sources/capabilities, refresh and read-only restoration.
A tester also confirmed connection and discovery in the previous iPhone preview.
The newest artwork, stable pending controls, FM/DAB controls and source-browsing
changes need phone/Yamaha validation; automated checks use fixtures. The supplied
recordings guide regression checks but do not validate the new binary. Build new binaries
with the native configuration and test denied access, LAN
reachability, standby wake with Network Standby enabled/disabled, resume,
response failures and concurrent external remote actions on both platforms.

No analytics, cloud backend, AI provider, or streaming service credentials are
present. Future integrations must be optional and document data flow and licenses.

## Shared iPhone / Frame control

See [app coordination](companion.md) for setup and exact recovery behavior.
Both apps contain the framework-independent `CompanionCoordinator` and Yamaha
adapter. The TV drains local work before authenticated yield to the phone. The
phone has a 12-second renewable authority lease. TV fallback waits 60 seconds;
phone-only takeover requires an explicit assertion that the TV app is closed.
Both require Refresh after ownership changes. The adapter's fetch wrapper fences
all Yamaha mutation routes at dispatch, including writes after awaited preflight.

Semantic DTOs carry generation, revision, sequence, freshness and menu lease;
never arbitrary routes or proxy targets. One operation runs with no queue.
Eight bounded client histories retain 64 outcomes each; duplicate sequences do not
repeat writes. Generation changes and uncertain results require explicit refresh.
Coordinator invalidation during a slow Refresh stays latched after it completes.
Menu ownership lasts 45 seconds; takeover invalidates old selections. External
Yamaha controllers remain outside this lease and the final check/write gap remains.

The native iPhone listener is foreground-only on private Wi-Fi IPv4 port 8095.
TV discovery searches a bounded `/24` and checks descriptors against the probed IP.
Pairing uses committed X25519, HKDF-SHA256 and both-screen short-code confirmation.
XChaCha20-Poly1305 protects application messages with direction, session, boot and
counter checks. Discovery is untrusted. Native storage uses SecureStore / Tizen
Key Manager; browser previews use memory. Demo creates no real client.

No independent arbiter is present. An automatic phone takeover during a partition
would risk competing coordinators, so the user must first close the TV app and
explicitly take control. App resume, reconnect and passive reads never replay a
write or clear uncertainty. Refresh reads actual Yamaha state without restoration.
