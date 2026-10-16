# Native preview builds

The first target is a standalone controller installed on a phone. These profiles
bundle the app, so they do not need Metro, Expo Go, or the browser bridge at
runtime. The phone and Yamaha must be on the same reachable home network.

Run `npm ci`, `npm run check`, and `npm run bundle:check` from the repository
root. Bundle checks cover iOS, Android, and web JavaScript and assets. They do
not compile a native app or prove that LAN permissions work on a phone.

## Expo project

This repository is linked to [`@quality-max/mosaicast`](https://expo.dev/accounts/quality-max/projects/mosaicast).
Maintainers with access to that account can use the build commands below.
The project ID and owner in app configuration are public metadata.

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

The initial Android package and iOS bundle identifier are both
`io.github.desperado.mosaicast`. Confirm their availability before provisioning
or store registration. Version `0.1.0` and build number `2` are local; increment
build numbers before uploading another binary to a store.

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
- Search on Wi-Fi with local-network access allowed and denied. Check selection,
  empty results, cancellation, leaving the screen, and backgrounding. The first
  iOS permission prompt must not cancel the search just by making the app inactive.
  Search covers only the displayed `/24` range; use manual IP for other ranges.
- Connect by a private IPv4 address. Accept the local-network prompt on iOS;
  also test denial and enabling access again in system settings.
- Check model, sources, playback metadata, power, mute, and volume. Power-on
  from standby requires Yamaha Network Standby.
- Send each command once. After an uncertain result, explicitly refresh before
  another write. Test an unreachable device and Wi-Fi loss.
- Background and resume the app; check that state refreshes and no command is
  replayed. Relaunch and verify saved device mode, language, and appearance.
- Switch to demo and verify it sends no requests to the Yamaha.

Record phone OS, Yamaha model/firmware, build commit, and pass/fail results.
The browser connection test is not evidence that a native build passed.

See Expo's [monorepo build setup](https://docs.expo.dev/build-reference/build-with-monorepos/),
[APK guide](https://docs.expo.dev/build-reference/apk/),
[internal distribution](https://docs.expo.dev/build/internal-distribution/),
and [simulator guide](https://docs.expo.dev/build-reference/simulators/).
