# TestFlight preparation

The `production` EAS profile builds with store signing and increments the iOS
build number. The `preview` profile remains an internal, direct-install build;
its binary cannot be uploaded to TestFlight.

## Current beta

Join Mosaicast through the [public TestFlight link](https://testflight.apple.com/join/R2UfdCSH).

As of 2026-10-18, **0.1.0 (23)** is uploaded and submitted for external beta
review, with status **Waiting for Review**. The `Mosaicast Public Beta` external
group has a public link open to anyone. Testers cannot join until Apple approves
a build in that group. The `Mosaicast Team` internal group also has build 23
assigned. This beta is separate from a public App Store release.

- Source revision: `a4ac7deef4fe22936e008d7a80e66ab17a45a04f`
- Beta description and testing instructions are saved in English and Ukrainian.
- Export compliance declares app-supplied standard cryptography. Availability
  in France was set to **No**, as requested by the owner. Reassess the declaration
  when cryptography or distribution changes.
- Review contact details are maintained only in App Store Connect.
- [English and Ukrainian demo screenshots](screenshots/README.md)

App record details:

- Platform: iOS
- Name: Mosaicast
- Primary language: English (U.S.); bilingual beta copy is recorded below
- Bundle ID: `io.github.desperado.mosaicast`
- SKU: `mosaicast-ios`
- Apple ID: `6823949587` (configured as `submit.production.ios.ascAppId`)
- [App Store Connect](https://appstoreconnect.apple.com/apps/6823949587/distribution)

An original four-tile icon is configured at `apps/mobile/assets/icon.png`, with
editable vector source alongside it. It follows the existing app mark and dark
design tokens. The PNG is an opaque 1024 × 1024 square; iOS applies its own mask.

## Subsequent builds

Build 23 was built locally with EAS and uploaded through EAS Submit after the
cloud build quota was reached. Store signing and submission are configured.
Use a new iOS build number for every upload. Run `npm run check` and
`npm run bundle:check` from the repository root before building.

Complete the physical-device checks in [native builds](native-builds.md),
including receiver controls, volume buttons, phone/TV coordination and denied
local-network permissions. Browser fixtures and demo screenshots are not
evidence that these paths passed on a real iPhone.

Review export declarations against the app and its native dependencies for each
release. The peer integration adds app-supplied cryptography; do not declare it
absent. See [Apple’s encryption declaration guidance](https://developer.apple.com/documentation/BundleResources/Information-Property-List/ITSAppUsesNonExemptEncryption).

Build from `apps/mobile` after running the repository checks:

```sh
npx eas-cli@latest build --platform ios --profile production
```

Complete any Apple sign-in and signing setup in the secure EAS flow. Do not
paste passwords or verification codes into chat. If that flow proposes creating
submission keys, review the account and requested access before granting it.

After the app record and credentials are configured, submit the exact production
build ID with `eas submit --platform ios --profile production --id BUILD_ID`.
Do not use `--latest`, which could select a direct-install preview. Submission
uploads the binary to App Store Connect; Apple processing and tester-group
assignment are separate steps. A public App Store release is also separate.
Never store passwords, API keys, private keys, signing files, or tokens in the
repository or chat.

## Submitted beta description

English: Mosaicast is an independent controller for compatible Yamaha MusicCast
devices on your local network. Discover a device or connect by IP address, view
playback information, browse available sources, and control playback, volume,
mute and power. Features depend on the connected device. Demo mode lets you
explore the app without hardware. No Mosaicast account is required. The interface
is available in English and Ukrainian.

Ukrainian: Mosaicast — незалежний застосунок для керування сумісними пристроями
Yamaha MusicCast у локальній мережі. Знайдіть пристрій або підключіться за
IP-адресою, переглядайте інформацію про відтворення й доступні джерела, керуйте
відтворенням, гучністю, вимкненням звуку та живленням. Доступні функції залежать
від пристрою. Деморежим дозволяє ознайомитися із застосунком без обладнання.
Обліковий запис Mosaicast не потрібен. Інтерфейс доступний українською та
англійською.

## Draft review notes

No account or sign-in is required. Choose demo mode from the connection screen
to explore the app without hardware. Demo mode uses fictional data and sends no
commands to a receiver. To test real controls, connect the iPhone and a supported
Yamaha MusicCast receiver to the same reachable local network, allow local-network
access, then discover the receiver or enter its private IPv4 address. The app
discovers supported controls and limits from the receiver. Hardware volume
capture is active only while eligible real-device control is foregrounded.

## Submitted testing instructions

English: Please test phone–TV pairing and reconnection on the same Wi-Fi network,
shared Deezer browsing, playback, volume and mute controls, and switching between
demo and real devices. Report connection errors or unexpected playback behavior.

Ukrainian: Перевірте з’єднання телефона з телевізором і повторне підключення в
одній Wi-Fi мережі, спільний перегляд Deezer, відтворення, регулювання гучності й
вимкнення звуку, а також перемикання між деморежимом і реальними пристроями.
Повідомляйте про помилки з’єднання чи неочікувану поведінку відтворення.

References: [Expo TestFlight distribution](https://docs.expo.dev/submit/testflight/),
[Expo iOS submission](https://docs.expo.dev/submit/ios/),
[Apple TestFlight](https://developer.apple.com/testflight/),
[Apple beta test information](https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information/).
