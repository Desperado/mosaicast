# Mosaicast design intake

Reviewed 14 October 2026 from `Mosaicast mobile app design.zip`.

The package is sufficient to begin the native controller foundation. It is a
Claude Design HTML prototype with simulated device responses, not a running
MusicCast implementation. Preserve it as a reference and implement the screens
in TypeScript/React Native.

## Imported reference

The original archive and its 14 extracted files are retained locally by the
maintainer, outside this repository. They are not distributed here because
the bundled third-party runtime has no accompanying license notice.
The main canvas is `Mosaicast.dc.html`; the interactive phone component is
`Mosaicast Phone.dc.html`. The package also supplies a prototype runtime,
QualityMax component bundle, manifest, and CSS tokens.

## What the design supplies

| Area | Included |
| --- | --- |
| Identity | MosAIcast wordmark, four-tile icon, charcoal/indigo direction |
| Appearance | Dark and light phone variants |
| Languages | Embedded English and Ukrainian strings; Ukrainian uses system fonts |
| Onboarding | Demo, manual IP entry, permission explanation, invalid/unreachable/denied states, capability overview |
| Listen | Room selector, power, track/artist/album, artwork, transport, mute, volume, source sheet |
| Device outcomes | Standby, failed wake, offline/stale values, requested/confirmed/failed/unknown volume |
| Rooms and Library | Device tiles, source browsing, mock albums/radio, mini-player |
| Expanded concept | Scenes, editable intent plan, per-step results, partial Frame failure |
| Handoff notes | Navigation decisions and proposed acceptance checks tied to user feedback |

Foundation navigation has Listen, Rooms, and Library. Scenes is an expanded
concept. Browsing and switching input remain separate actions.

## Implementation mapping

| Design behavior | Existing scaffold | Required work |
| --- | --- | --- |
| Connect and read capabilities | `Controller.read()` and parsed features/status | Native onboarding, permission handling, persistence and real read results |
| Listen and source sheet | Track/status/source types and commands | Native screens and source rows derived from device-reported capabilities |
| Power, mute, transport | Explicit command values | Pending/outcome UI; confirm the relevant observed state before saying confirmed |
| Volume slider | Only relative up/down commands | Add validated absolute-volume support with device-reported limits; coalesce gestures; read after an uncertain outcome before another write |
| Offline cached view | No cache or reachability lifecycle | Timestamped snapshots, stale labels, reconnect/resume reads |
| Rooms | One controller instance | Remembered device collection and independent state per device |
| Library | No browsing API | Source-specific browsing and explicit playback; use clearly marked demo content until supported |
| Localization/themes | No native implementation | Shared translation keys, persistent preferences, actual OS language/theme integration |
| Frame and Scenes | No mobile implementation | Separate adapters, capabilities, plan validation and per-device outcome tracking |

The prototype's `netradio` ID must map to the Yamaha API's `net_radio` where
reported. Never send presentation IDs directly to the device.

All prototype connection, permission, power, playback and scene responses use
local mock state or timers. They must not become real-device success paths.
The prototype's System theme always resolves to dark, and System language uses
the preview language prop; production must follow OS preferences.

The shown 0–63 range, 11 inputs, enabled Network Standby, and Deezer
region-unavailable state are design fixtures. Discover actual capabilities and
service state instead of treating these examples as facts about a connected TV
or Yamaha. Lack of browsing support alone does not establish regional
unavailability.

## Remaining design deliverables

- The Frame Gallery flow: private photo selection, crop/matte, upload progress,
  failure/retry and confirmed display.
- Tablet, desktop and TV companion layouts.
- Standalone `en.json` / `uk.json`, native token mapping and component handoff.
- A common font choice with Ukrainian glyphs; the design explicitly identifies
  its English fonts and Ukrainian fallback as an open decision.
- Native-speaker review of Ukrainian copy, including plurals and consistent
  terms for browsing, standby and scenes.
- Artist details, lyrics and enrichment states: source/provenance, loading,
  unavailable, offline/cache and long text. Track/artist/album labels and mock
  artwork are included, but these additional flows are not.
- An asset/license inventory for the MIT repository. No license/notice file is
  included in this archive, and fonts currently load remotely. Implement the
  native components and retain applicable font/icon notices when choosing and
  bundling assets.

## Checks performed

Opened the main canvas in Chrome through a loopback-only local server. Clicked
English Try demo and Ukrainian Спробувати демо; both opened their respective
Listen screens. Visually inspected the dark/light variants. Saved the preview
to `.context/mosaicast-design-preview.jpg`.

Inspected the prototype handlers, embedded translations, CSS tokens and design
system documentation; compared the relevant interaction contracts with
the pre-migration `src/musiccast/types.ts` and placeholder `App.tsx`.
The shared types now live in `packages/musiccast/src/types.ts`.

No real Yamaha/Samsung commands were sent. Native builds, VoiceOver/TalkBack,
dynamic type, small-phone layouts, contrast measurements, and performance
targets were not tested. The canvas's acceptance checks are proposed checks,
not evidence that the native app meets them.

At intake time the scaffold had a placeholder app and unwired MusicCast client.
The subsequent monorepo migration adds an isolated native demo shell, shared
packages, themes and bilingual foundation copy. Full designed screens and the
real mobile connection flow remain to be implemented; see the repository README.
