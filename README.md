# Mosaicast · MosAIcast

An independent, open-source MusicCast controller for iOS and Android, built in
TypeScript. The aim is a fast, clear listening experience with English and
Ukrainian, discovered device capabilities, and visible command outcomes.

**Status: early live controller with a separate demo. Not yet a store release.**
Find a Yamaha on the phone's local network, or connect by private IPv4 to read its main-zone status,
capabilities and track metadata, and control power, volume, mute, input and
network/USB playback. Available controls and volume limits come from the device.
The selected mode and address persist locally; reconnecting only reads state.
English/Ukrainian and system/light/dark appearance are supported.

Demo mode uses two fictional rooms and never contacts hardware. Switching to
it disconnects the app session without changing Yamaha playback. Old saved demo
addresses are not automatically promoted into live connections.

The laptop web preview has been connected to a CD-NT670D to verify status,
metadata, sources and restoration. Native iOS/Android builds and their permission
flows remain unverified. A working web preview does not establish native support.

## Repository layout

```text
apps/mobile/          Expo Router app for iOS, Android, and web preview
packages/musiccast/   Framework-independent local Yamaha adapter and demo
packages/i18n/        Typed English/Ukrainian copy
packages/design/      Theme, spacing, and radius tokens
docs/design/         Design prompts, user feedback, and prototype intake
```

Desktop, TV, Frame, and AI packages will be added when implemented. The existing
[home-entertainment controller](https://github.com/Desperado/home-entertainment)
keeps its own repository and release history.

## Start

Use Node 24 LTS (`nvm use`) and npm 10 or newer. No account or API key is needed.

```bash
npm ci
npm run dev
npm run ios       # build/run locally; requires full Xcode and an iOS simulator
npm run android   # build/run locally; requires Android Studio/SDK and a device
npm run web       # browser preview; live connection also needs the bridge below
```

Dependencies are pinned by the root `package-lock.json`. Run installs from the
root. Expo SDK 57 is intentional; avoid mixing SDK versions in this workspace.
For native Expo dependencies, use `npx expo install <package>` in `apps/mobile`.
Router and Metro follow [Expo's monorepo setup](https://docs.expo.dev/guides/monorepos/).

```bash
npm run check          # lint, all workspace typechecks, adapter/i18n/preferences tests
npm run bundle:check   # Expo iOS, Android, and web production bundles
```

CI runs both checks on pull requests and pushes to main. The export checks
iOS, Android, and web bundles; it does not compile or install native binaries.
See [native builds](docs/native-builds.md) to produce an Android APK or iOS preview.
Local and preview builds install as **Mosaicast Dev**, alongside the official
TestFlight/store app. The `production` EAS profile keeps the official app identity.

The dependency audit currently reports upstream advisories. See
[dependency status](docs/dependency-status.md) for the findings and release follow-up.

## Connect from the laptop

Yamaha's API does not provide browser CORS headers. Keep both commands running
in separate terminals from this repository root:

```bash
npm run bridge
npm run web --workspace @mosaicast/mobile -- --port 8091
```

Open `http://localhost:8091`, choose **Connect by IP**, and enter your Yamaha's
private IPv4 address. The device and laptop must share a reachable local network.
If the bridge stops, the app shows an actionable error and disables stale controls.
The bridge listens only on `127.0.0.1:8092`, accepts fixed localhost origins on
ports 8081, 8091 and 19006, and restricts targets to private IPv4 addresses.
It is a local development tool; never deploy or expose it on your LAN or internet.

Native builds use the Yamaha API directly and do not need the bridge. Native
local-network/HTTP settings are included in Expo configuration; they require a
new native build, and are not applied to an existing Expo Go binary. Before
claiming mobile compatibility, test local-network access and denied permissions
on actual iOS/Android builds. Remote power-on needs Network Standby enabled on
the Yamaha. Selecting an input does not sign into or browse a music service.

Writes are sent once. If a result is uncertain, explicitly refresh status before
another command. Routine foreground refreshes wait 30 seconds after the last
read or command, stay silent, and never replay commands. Polling pauses in the
background, hidden browser tabs, and demo rooms. Failed reads back off to one,
then two minutes. Only a requested Bluetooth search polls every three seconds,
for at most 30 seconds, before returning to the normal interval.
Next/previous acknowledgement means accepted, not a confirmed track transition.

On Yamaha devices that advertise Bluetooth transmission, **Listen → Bluetooth
headphones** lets you enable output, search, connect and disconnect. Select a
source other than Bluetooth, enable output, put the headphones in pairing mode,
then search and select them. Audio goes directly from Yamaha to the headphones.
The list comes from Yamaha's last search; ordinary refresh never starts a search.
Search acknowledgement is distinct from a confirmed connection. These controls
have automated coverage; a user has confirmed a headphone connection on hardware.
Headphone volume must be adjusted on the headphones; the Yamaha volume/mute
controls affect its speakers. **Remove from this app** hides disconnected old
headphones locally for the selected Yamaha, including after restarting the app.
**Restore removed headphones** shows them again. Yamaha's documented API does
not expose pairing deletion, so removal does not erase its pairing records.

## Implementation order

1. Validate the implemented onboarding, Listen, Rooms, Connection, and Settings
   screens on iOS and Android, including safe areas, keyboards, and accessibility.
2. Validate the native connection and permission flows, hardware commands,
   offline/resume behavior and concurrent external remote changes.
3. Add Library, device-aware browsing, artwork, broader discovery, and multiroom functions.
4. Add optional companion and AI features behind separate adapters. Any AI
   action plan must show its actions and require user approval before writes.

See [architecture](docs/architecture.md), [design intake](docs/design/design-intake.md),
and [release checklist](docs/releasing.md). Real-device testing is required
before claiming model support. Music services vary by model, firmware, region,
and account; listing an input does not prove its catalog can be browsed.

## Find a Yamaha on your phone

On the Connection screen, tap **Search local network**, allow local-network
access, then select a result and tap **Connect by IP**. Search runs only when
requested and reads device information; it does not power on or change devices.
Cancel, leaving the screen, or moving the app to the background stops it.

This first search checks addresses `.1`–`.254` sharing the phone's first three
IPv4 numbers (a `/24` range, displayed on screen), with at most 12 requests at
once and a 1.2-second timeout per address. It normally finishes within 30 seconds.
This is not subnet-mask detection or SSDP: larger subnets, separate VLANs, VPNs,
guest-network isolation and Yamaha devices without Network Standby can prevent
discovery. Enter the IP manually when needed. Manual entry accepts commas as
dots and trims outer whitespace; missing separators are never guessed.

Search is native iOS/Android only. The browser preview still uses manual IP and
the local bridge. Search results are not a saved device registry or a claim of
model support; the app reads capabilities when you explicitly connect.

## Open source

MIT licensed; see [LICENSE](LICENSE), [third-party notices](THIRD_PARTY_NOTICES.md),
[contributing](CONTRIBUTING.md), [code of conduct](CODE_OF_CONDUCT.md), and
[security policy](SECURITY.md). Yamaha/MusicCast and service trademarks remain
with their owners. This project is not affiliated with Yamaha.
