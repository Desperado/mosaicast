# Mosaicast · MosAIcast

An independent, open-source MusicCast controller for iOS and Android, built in
TypeScript. The aim is a fast, clear listening experience with English and
Ukrainian, discovered device capabilities, and clear error recovery.

**Status: early live controller with a separate demo. Not yet a store release.**
Find a Yamaha on the phone's local network, or connect by private IPv4 to read its main-zone status,
capabilities and track metadata, and control power, volume, mute, input and
network/USB playback. Available controls and volume limits come from the device.
Source browsing offers folders, paging, menu-provided search and playback for
reported Deezer, PC/NAS, USB and internet-radio inputs. Menu availability and
actions are read from Yamaha; service login stays in Yamaha's app.
The selected mode and address persist locally; reconnecting only reads state.
English/Ukrainian and system/light/dark appearance are supported.

Demo mode uses two fictional rooms and never contacts hardware. Switching to
it disconnects the app session without changing Yamaha playback. Old saved demo
addresses are not automatically promoted into live connections.

The laptop web preview has been connected to a CD-NT670D to verify status,
metadata, sources and restoration. A tester has confirmed native iPhone connection
and local discovery with a CD-NT670D. Android and denied-permission flows remain
unverified; this is not a model-wide compatibility claim.

## Repository layout

```text
apps/mobile/          Expo Router app for iOS, Android, and web preview
apps/frame/           Samsung Frame / Tizen TV app
packages/musiccast/   Framework-independent local Yamaha adapter and demo
packages/i18n/        Typed English/Ukrainian copy
packages/design/      Theme, spacing, and radius tokens
docs/design/         Design prompts, user feedback, and prototype intake
```

The iPhone and Samsung Frame share one Yamaha through [direct app coordination](docs/companion.md).
No computer is needed while listening. With both apps open, the phone coordinates;
after the phone closes, the TV can take over after a recovery interval and Refresh.
The TV automatically discovers the phone, and pairing compares digits on both screens.
A paired phone can take control when the TV is closed through an explicit action.
Navigation, focus and themes stay local. Standalone and demo modes remain available.
A new native iPhone build is required; Expo Go and build 7 lack this integration.

The pending mobile work from the 2026-10-17 handoff has been restored. The TV source
was imported with the owner's authorization; see [provenance](docs/frame-provenance.md).
Automated integration checks do not establish physical iPhone/Frame compatibility.
The simultaneous hardware checks and signed packages remain required before release.

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
npx playwright install chromium
npm run test:layout    # phone viewport checks against the exported web bundle
```

CI also builds the classic TV bundle and runs all three checks on pull requests and pushes to main. The export checks
iOS, Android, and web bundles; it does not compile or install native binaries.
See [native builds](docs/native-builds.md) to produce an Android APK or iOS preview.
See [mobile layout validation](docs/mobile-layout.md) for the viewport matrix
and the remaining checks that require a physical phone.

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
the Yamaha. Selecting an input does not sign into a music service. With a
browsable input selected and the device on, tap **Browse** next to the source
selector. **Back one level** navigates folders; **Back** returns to
Listen. Play buttons request playback; opening folders does not start it.
If another remote changes the menu, refresh it before selecting an item.
See [source browsing](docs/source-browsing.md) for scope and validation limits.

Writes are sent once. If a result is uncertain, explicitly refresh status before
another command. Foreground polling every eight seconds never replays commands.
Next/previous acknowledgement means accepted, not a confirmed track transition.
On iPhone, foreground physical volume buttons control the connected Yamaha.
The app restores the phone's original output volume when capture ends. This
integration still needs physical-device verification in the new preview.

## Implementation order

1. Validate the implemented onboarding, Listen, Rooms, Connection, and Settings
   screens on iOS and Android, including safe areas, keyboards, and accessibility.
2. Validate the native connection and permission flows, hardware commands,
   offline/resume behavior and concurrent external remote changes.
3. Validate source browsing on hardware, then add Library, artwork, broader discovery, and multiroom functions.
4. Validate the optional companion on both physical devices. Future AI
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
IPv4 numbers (a `/24` range), with at most 12 requests at
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
