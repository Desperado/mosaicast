# Native preview builds

The first target is a standalone controller installed on a phone. These profiles
bundle the app, so they do not need Metro, Expo Go, or the browser bridge at
runtime. The phone and Yamaha must be on the same reachable home network.

Current direct-install iPhone preview: [Mosaicast Dev 0.1.0 (12)](https://expo.dev/accounts/quality-max/projects/mosaicast/builds/d9daffcf-f2c4-48d8-8ab5-b397b87db96d),
completed on 17 October 2026. Open that page on the registered iPhone to install.
The build completed successfully from commit `bb7372b`. It includes camera-based TV QR pairing and verified secure-store persistence. The physical-device acceptance checks below remain to be run.

Run `npm ci`, `npm run check`, and `npm run bundle:check` from the repository
root. Bundle checks cover iOS, Android, and web JavaScript and assets. They do
not compile a native app or prove that LAN permissions work on a phone.

## Expo project

This repository is linked to [`@quality-max/mosaicast`](https://expo.dev/accounts/quality-max/projects/mosaicast).
Maintainers with access to that account can use the build commands below.
The project ID and owner in app configuration are public metadata.
Expo's GitHub connection must target `Desperado/mosaicast`, with base directory
`/apps/mobile`.

For an open source fork, remove `extra.eas.projectId`, change `owner` to your
Expo account, and link your own project before building. Choose your own app
identifiers if distributing the fork.

Run EAS commands from `apps/mobile`, as required for this monorepo:

```sh
cd apps/mobile
npx eas-cli@latest whoami
npx eas-cli@latest init --account YOUR_EXPO_ACCOUNT
```

Run `init` only when linking a fork or replacing the project. Access tokens and
signing material must never be committed.

Local commands and the `preview`/`simulator` profiles build **Mosaicast Dev**.
Its iOS bundle identifier and Android package are
`io.github.desperado.mosaicast.dev`, with URL scheme `mosaicast-dev`. It can stay
installed alongside the official **Mosaicast** TestFlight/store app, and has its
own saved preferences and local-network permission. The new iOS identifier needs
its own provisioning profile; EAS can reuse the team's distribution certificate.

`app.config.js` selects `APP_VARIANT=development` by default. The `production`
EAS profile explicitly sets `APP_VARIANT=production`, preserving the official
`io.github.desperado.mosaicast` identifiers and `mosaicast` URL scheme.
Version `0.1.0`, iOS build number `16`, and Android version code `5` are local;
increment build numbers before uploading another binary to a store.

When switching variants after a local native build, regenerate the ignored
native directories with `npx expo prebuild --clean` before `npx expo run:ios`
or `npx expo run:android`. Set the same `APP_VARIANT` on both commands. This
replaces generated native files; keep customizations in app config and plugins.

## Android phone or emulator

```sh
npx eas-cli@latest build --platform android --profile preview
```

The `preview` profile produces a release APK that can be installed directly.
Let EAS manage the Android signing key when prompted. Do not download or commit
the keystore. Open the build's install page on your Android phone, download the
APK, and allow installation from that source. No Google Play account is needed
for this preview. Keep the signing key stable for future in-place upgrades.

## Physical iPhone

An internal iOS preview needs an Apple Developer team, registered test device,
and signing credentials. Register the iPhone with the intended team first:

```sh
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
```

Complete Apple authentication locally through EAS when prompted. Never put
passwords, two-factor codes, tokens, or signing files in chat or the repository.
Install from the completed build's page on the registered iPhone. Adding a new
device requires an updated provisioning profile and a new or re-signed build.
This profile does not upload to TestFlight or publish to the App Store.

For TestFlight, use the separate store-signing `production` profile and follow
the [TestFlight preparation notes](testflight.md). A direct-install preview
cannot be reused as a TestFlight upload.

## Local iPhone builds

Mosaicast Dev `0.1.0 (15)` was built locally on 18 October 2026 from commit
`90cf676`. Native compilation, bundle identity/build-number checks and code-
signature verification passed. It fixes post-pairing refresh contention and
distinguishes a shared refresh requirement from a genuinely uncertain command.
Build 15 was installed and launched on the physical iPhone; the installed
bundle version was verified as `15`. The corresponding TV refresh-fix package
from Frame Music commit `37c9ad3` was installed in place and launched on the
Samsung GQ55LS03BGUXZG. Simultaneous post-fix phone/TV acceptance remains to
be run.

Mosaicast Dev `0.1.0 (14)` was built locally on 18 October 2026 from commit
`c821751`. Native compilation and code-signature verification passed. It includes
scanner pinch/button zoom, QR launch routing, and the scan → connecting →
connected → Listen flow. The corresponding signed Frame Music TV package was
installed and launched on a Samsung GQ55LS03BGUXZG. Build 14 was installed and
launched on the physical iPhone. User photos confirm that pairing was saved on
both devices, followed by a failed first refresh. Post-fix simultaneous pairing
acceptance checks remain to be run.

For this development preview, scan inside **Mosaicast Dev → Connect phone + TV**.
The normal iPhone Camera opens the app registered for `mosaicast`; the development
preview registers `mosaicast-dev`, so camera-link validation needs an updated
production-identity binary.

Mosaicast Dev `0.1.0 (13)` was built locally on 17 October 2026 from commit
`91c79d1`. Native compilation and code-signature verification passed. This IPA
contains the same QR pairing and persistence changes as cloud build 12. Physical
iPhone/TV acceptance checks remain to be run.

A local EAS build needs full Xcode, CocoaPods, and Fastlane. It uses the same
`preview` profile and existing EAS-managed signing credentials, without a cloud
build slot:

```sh
# Run from apps/mobile.
npx eas-cli@latest build --platform ios --profile preview --local --output /tmp/Mosaicast-Dev.ipa
```

If Xcode is outside the selected developer directory, set `DEVELOPER_DIR` to
that app's `Contents/Developer` directory for this command. This does not change
the Mac's system-wide Xcode selection. The signed IPA can be installed on a
registered iPhone using a Mac; local builds do not create an Expo install page.
Do not retain or commit temporary signing credentials or raw build job output.

## iOS Simulator

```sh
npx eas-cli@latest build --platform ios --profile simulator
npx eas-cli@latest build:run --platform ios
```

The simulator profile does not need Apple signing or a registered device. Its
binary runs only in an iOS simulator, which requires full Xcode on a Mac. It
cannot be installed on an iPhone. LAN access still needs real-device testing.

## Before calling the preview usable

- Check English/Ukrainian, light/dark mode, keyboards, and safe areas.
- Enter `192,168,1,40` and paste an address with outer spaces. Check that commas
  become dots. Missing separators must show validation, never guessed octets.
  On iOS, use the dot button above the decimal keypad, move the caret into the
  middle of an address, and replace a selection. Connect and Close must remain
  reachable above the keyboard. Repeat with Ukrainian/German keyboard locales.
- Search on Wi-Fi with local-network access allowed and denied. Check selection,
  empty results, cancellation, leaving the screen, and backgrounding. The first
  iOS permission prompt must not cancel the search just by making the app inactive.
  Search covers only the phone's `/24` range; use manual IP for other ranges.
- Connect by a private IPv4 address. Accept the local-network prompt on iOS;
  also test denial and enabling access again in system settings.
- Check model, sources, playback metadata, power, mute, and volume. Power-on
  from standby requires Yamaha Network Standby.
- On a physical iPhone, check both volume buttons while connected and foregrounded.
  Start with the phone at zero and maximum; check repeated presses and Yamaha's
  reported minimum/maximum. Each accepted press sends one relative volume step.
  Busy presses are ignored, and uncertain writes require explicit refresh.
  Check that the iPhone overlay stays hidden and the original phone volume is
  restored on backgrounding, standby, disconnection, and switching to demo.
  Native capture failure must show the on-screen-control fallback. This module
  requires a new native binary; Expo Go and simulators do not verify it.
- Select FM and DAB. Check band switching, FM seek and frequency steps, DAB
  previous/next service, reported station/RDS text and preset recall. On a
  receiver advertising DAB initial scan, test explicit scan and cancellation
  with an empty station list. Check pending commands do not dim or shift controls.
- Send each command once. After an uncertain result, explicitly refresh before
  another write. Test an unreachable device and Wi-Fi loss.
- Leave the live screen idle: routine refreshes must not flash pending or disable
  controls. Tap a control during a slow automatic read; the command should run
  once after that read succeeds. Check 30-second idle polling, offline backoff,
  and no periodic requests in the background, hidden web tabs, or demo rooms.
- On a model reporting Bluetooth output, select a non-Bluetooth source, enable
  output, put headphones in pairing mode, search, connect and verify audio.
  Check empty results, a running search, disconnect, disable, standby and
  Bluetooth input conflicts. Confirm that refresh/relaunch never starts a search
  or reconnects headphones, and that a timed-out connection is not retried.
  Adjust headphone volume on the headphones and confirm the app labels its
  controls as speaker volume. Disconnect an old entry, remove it from the app,
  relaunch, then restore it. Removal must not send an unpair command to Yamaha.
- With the updated Frame Music TV app, scan its QR from Connect phone + TV.
  Check denied camera permission, expired codes, failed secure-store writes,
  explicit retry, and restarting both apps without another scan.
- Background and resume the app; check that state refreshes and no command is
  replayed. Relaunch and verify saved device mode, language, and appearance.
- Switch to demo and verify it sends no requests to the Yamaha.

Record phone OS, Yamaha model/firmware, build commit, and pass/fail results.
The browser connection test is not evidence that a native build passed.
Follow the [mobile layout checks](mobile-layout.md) at standard and enlarged text.

See Expo's [monorepo build setup](https://docs.expo.dev/build-reference/build-with-monorepos/),
[APK guide](https://docs.expo.dev/build-reference/apk/),
[internal distribution](https://docs.expo.dev/build/internal-distribution/),
and [simulator guide](https://docs.expo.dev/build-reference/simulators/).
See [app variants](https://docs.expo.dev/build-reference/variants/) for separate
development and production identities.

## iPhone / Frame peer integration

The local Expo module `apps/mobile/modules/mosaicast-peer` adds a Swift
Network.framework Wi-Fi listener and secure random source. It requires a new
iPhone binary; Expo Go and production build 7 do not contain it. SDK 57 local
module autolinking discovers its podspec under `modules`. The listener stops
when the app backgrounds. Android and web retain standalone/demo modes and show
the unsupported-native-build message for peer setup.

Production JavaScript export is not a native compilation check. Full Xcode, a
signed iPhone build, a signed Tizen package and simultaneous hardware testing are
required before release. Mosaicast Dev build 15 completed locally, and build 12
is available on EAS. Build 15 and the corresponding signed TV refresh-fix package
were installed and launched on the physical iPhone and Samsung GQ55LS03BGUXZG.
Simultaneous post-fix iPhone/TV validation remains to be run. See
[peer validation](companion-validation.md).
