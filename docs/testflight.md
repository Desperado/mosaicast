# TestFlight preparation

The `production` EAS profile builds with store signing and increments the iOS
build number. The `preview` profile remains an internal, direct-install build;
its binary cannot be uploaded to TestFlight.

## First release scope

The first TestFlight release is for existing App Store Connect team members
only. The app record and `Mosaicast Team` internal group were created on
2026-10-17. External testing and a public App Store release are outside this
first release. The group uses manual build assignment and currently has no
testers or builds.

App record details:

- Platform: iOS
- Name: Mosaicast
- Primary language: English (U.S.); Ukrainian beta copy is drafted below
- Bundle ID: `io.github.desperado.mosaicast`
- SKU: `mosaicast-ios`
- Apple ID: `6823949587` (configured as `submit.production.ios.ascAppId`)
- [App Store Connect](https://appstoreconnect.apple.com/apps/6823949587/distribution)

An original four-tile icon is configured at `apps/mobile/assets/icon.png`, with
editable vector source alongside it. It follows the existing app mark and dark
design tokens. The PNG is an opaque 1024 × 1024 square; iOS applies its own mask.

## Remaining setup

On 2026-10-17, the non-interactive production-build attempt stopped because store
signing needs interactive Apple setup. No store build was queued. The configured
icon passed the opaque 1024 × 1024 RGB check, `npm run check`, and
`npm run bundle:check`. The owner subsequently signed in and the app record
and internal group were created. Apple displays an updated Developer Program
License Agreement notice requiring the Account Holder to review and accept it
before updating or submitting apps. No agreement was accepted by the agent.

- The Account Holder must review and accept the updated agreement in their
  [Apple Developer account](https://developer.apple.com/account).
- Configure store provisioning and submission credentials through EAS/Apple's
  secure credential flow. Existing ad hoc signing does not establish that
  store provisioning or submission access is configured.
- Assign the processed build to the existing `Mosaicast Team` internal group.
  Select existing team members who should test it; do not invite external testers.
- Enter the beta description, feedback email, review contact, and testing notes
  in App Store Connect. The contact details must come from the owner.
- Verify privacy/export declarations against the app and its native dependencies.
  The peer integration adds app-supplied cryptography. Its export classification
  is not set in the app configuration; complete the App Store Connect encryption
  questionnaire for the new build before upload. See [Apple’s encryption
  declaration guidance](https://developer.apple.com/documentation/BundleResources/Information-Property-List/ITSAppUsesNonExemptEncryption).
- Complete the physical-device checks in [native builds](native-builds.md),
  including the receiver controls and volume buttons. Browser fixtures are not
  evidence that these paths passed on a real iPhone.

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

## Draft beta description

English: Mosaicast controls a compatible Yamaha MusicCast receiver on your home
network. Test playback, reported sources, source browsing, volume, power, mute,
and supported FM/DAB controls. A separate demo mode lets you explore the app
without a receiver. Available controls depend on the connected device.

Ukrainian: Mosaicast керує сумісним ресивером Yamaha MusicCast у домашній мережі.
Перевірте відтворення, доступні джерела та їх перегляд, гучність, живлення,
вимкнення звуку й підтримувані функції FM/DAB. Окремий деморежим дає змогу
ознайомитися із застосунком без ресивера. Доступні елементи керування залежать
від підключеного пристрою.

## Draft review notes

No account or sign-in is required. Choose demo mode from the connection screen
to explore the app without hardware. Demo mode uses fictional data and sends no
commands to a receiver. To test real controls, connect the iPhone and a supported
Yamaha MusicCast receiver to the same reachable local network, allow local-network
access, then discover the receiver or enter its private IPv4 address. The app
discovers supported controls and limits from the receiver. Hardware volume
capture is active only while eligible real-device control is foregrounded.

## What to test

English: Check that essential Listen controls fit at normal text size and remain
steady during volume and source changes. Test physical iPhone volume buttons,
FM/DAB bands and station changes, reported presets, and supported source folders.
Check English/Ukrainian and light/dark appearance. After a failed or uncertain
command, refresh before trying another write.

Ukrainian: Перевірте, чи всі основні елементи екрана прослуховування вміщуються
за стандартного розміру тексту та залишаються на місці під час зміни гучності й
джерела. Перевірте фізичні кнопки гучності iPhone, діапазони FM/DAB і перемикання
станцій, доступні збережені станції та підтримувані папки джерел. Перевірте
українську й англійську мови, світле й темне оформлення. Після невдалої команди
або невизначеного результату оновіть стан перед наступною командою керування.

References: [Expo TestFlight distribution](https://docs.expo.dev/submit/testflight/),
[Expo iOS submission](https://docs.expo.dev/submit/ios/),
[Apple TestFlight](https://developer.apple.com/testflight/),
[Apple beta test information](https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information/).
