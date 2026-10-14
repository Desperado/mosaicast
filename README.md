# Mosaicast · MosAIcast

An independent, open-source MusicCast controller for iOS and Android, built in
TypeScript. The aim is a fast, clear listening experience with English and
Ukrainian, discovered device capabilities, and visible command outcomes.

**Status: mobile design demo, not a replacement app ready for daily use.**
The mobile app currently runs an isolated demo. It sends no network requests
or device commands. It has onboarding, Listen, Rooms, Connection, and Settings
screens with bilingual copy, source selection, power, volume, mute, and transport.
Two fictional rooms have separate playback state. Appearance and language follow
the device by default; explicit choices, onboarding completion, and a draft
private IPv4 address persist locally. The Connection screen saves an address
without contacting it. Demo playback resets when restarted.
The shared local MusicCast adapter is implemented and tested with simulated
responses, but it is not connected to the mobile UI yet. The earlier desktop
controller's hardware checks do not establish mobile compatibility.

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
npm run ios       # requires a configured iOS simulator on macOS
npm run android   # requires a configured Android emulator
npm run web       # browser preview of the mobile design
```

Dependencies are pinned by the root `package-lock.json`. Run installs from the
root. Expo SDK 57 is intentional; avoid mixing SDK versions in this workspace.
For native Expo dependencies, use `npx expo install <package>` in `apps/mobile`.
Router and Metro follow [Expo's monorepo setup](https://docs.expo.dev/guides/monorepos/).

```bash
npm run check          # lint, all workspace typechecks, adapter/i18n/preferences tests
npm run bundle:check   # Expo web production export, including shared packages
```

CI runs both checks on pull requests and pushes to main. A web export checks
bundling; it does not validate an iOS or Android binary.

The dependency audit currently reports upstream advisories. See
[dependency status](docs/dependency-status.md) for the findings and release follow-up.

## Implementation order

1. Validate the implemented onboarding, Listen, Rooms, Connection, and Settings
   screens on iOS and Android, including safe areas, keyboards, and accessibility.
2. Connect the adapter using native local-network permissions, device storage,
   fresh capability reads, and explicit pending/confirmed/uncertain outcomes.
3. Add Library, device-aware browsing, artwork, discovery, and multiroom functions.
4. Add optional companion and AI features behind separate adapters. Any AI
   action plan must show its actions and require user approval before writes.

See [architecture](docs/architecture.md), [design intake](docs/design/design-intake.md),
and [release checklist](docs/releasing.md). Real-device testing is required
before claiming model support. Music services vary by model, firmware, region,
and account; listing an input does not prove its catalog can be browsed.

## Open source

MIT licensed; see [LICENSE](LICENSE), [third-party notices](THIRD_PARTY_NOTICES.md),
[contributing](CONTRIBUTING.md), [code of conduct](CODE_OF_CONDUCT.md), and
[security policy](SECURITY.md). Yamaha/MusicCast and service trademarks remain
with their owners. This project is not affiliated with Yamaha.
