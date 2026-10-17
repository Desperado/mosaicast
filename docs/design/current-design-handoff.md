# Current design handoff — 17 October 2026

This is the current brief for the next Claude Design iteration. The original
English/Ukrainian prompts capture early brand exploration; their feature status
is historical. Preserve Mosaicast's four-tile identity, charcoal/indigo palette
and music-first direction, with iPhone as the lead platform and Android retained.

## Owner priorities

The latest iPhone recordings showed flashing during volume/source changes, an
empty-feeling Listen screen and absent FM/DAB controls. The owner also requires
physical iPhone volume buttons to control Yamaha, essential controls to fit at
normal text size, and routine debug messages removed from the main UI.

Refine these paths together with source browsing. Keep layout, opacity and labels
steady while pending. Use actual artwork or station identity to occupy space
meaningfully. Do not add filler cards, fabricated metadata or empty future tabs.
All essential Listen controls should fit at normal text size; collections may
scroll, and accessibility text must reflow and remain reachable through scrolling.

## Current workspace implementation

- Responsive Listen with an expanding media/station panel, compact short-screen
  layout, landscape columns, capability-gated playback/radio controls and volume.
- Pending reads/writes block conflicting actions while retaining visual stability.
  Menu refresh keeps displayed rows until replacement; failures clear invalid actions.
- Foreground iOS volume capture routes eligible relative steps to the receiver.
  Busy events are ignored; no queued writes or uncertain-result retries.
- Device-provided source browsing for supported, reported Net/USB inputs: folders,
  eight-row pages, advertised search, disabled rows and separate open/play.
- FM/DAB bands, reported station/frequency/text, FM step/seek with a reported range,
  DAB service changes, reported stored presets and advertised DAB scan/cancel.
- EN/UK, light/dark/system, manual IP normalization and native keyboard accessory,
  explicit bounded discovery, single-device connection, isolated fictional demo.
- Routine technical guidance lives in Help/About; actionable errors retain recovery.

These are local implementation changes, not a claim that all Yamaha models or
physical phones have passed. Current types in `packages/musiccast/src/types.ts`,
shared design tokens and exact i18n keys are the implementation contracts.

## Design deliverables

Cover Listen, Sources, source browser, radio, Connection, Rooms/capabilities and
Settings. Include missing art/metadata, standby, pending, stale/offline, uncertain
writes, unavailable menus, shared-menu changes, no presets, unready DAB and scan
availability. Deliver editable screens, a fixture-only clickable preview, semantic
tokens, exact EN/UK keys, native component/interaction mapping, accessibility notes,
asset licenses, feature-status matrix and native acceptance checklist.

Current stack is Expo SDK 57 / React Native 0.86.3 / React 19.2.3, minimum iOS
16.4. Existing UI uses React Native primitives and Expo Router. Any `@expo/ui`
migration is a proposal requiring a dependency and native verification. Record
exact OS/SDK documentation consulted. Use available size, safe areas, native
accessibility and platform conventions rather than model-specific offsets.

Absolute volume, seeking, app-owned service catalogs/login/favorites editing,
real multiroom linking, lyrics, scenes, Siri/widgets and lock-screen playback
ownership remain outside current implementation. An accepted device request is
not observed success. Discover real capabilities; demo fixtures never establish
hardware support. Never replay an uncertain write; refresh first.

## Evidence and packaging

The refreshed private design package contains current contracts, translations,
owner-feedback summary, build/check status and fresh browser screenshots.
Browser images use fictional/mocked data and do not validate native safe areas,
keyboard, VoiceOver, Dynamic Type, audio routes or real radio/source menus.
The new preview still needs those physical-device checks, including the owner's
iPhone 15 Pro Max.

The original Claude archive remains a private style reference because its
third-party runtime has no accompanying license evidence. Do not copy that runtime
into the public MIT app. Use original/licensed prototype assets and keep unrelated
private recording content out of the handoff.

## Reviewed design adoption

The returned mobile design was reviewed and applied to the Listen screen: square
media/station art grows to the available height (up to 440 points), compact phones
and landscape use a side-by-side media layout, and Presets sits beside the radio
source. Transport/radio and volume retain a stable control stack. Only the active
command gains a pending ring and accessibility busy state; the volume card reserves
its waiting line. Source and preset sheets remain visible while their command is
pending. Actual device observations still determine the displayed values.

The private prototype now rejects Refresh during every pending operation and its
keyboard buttons are at least 44 pixels tall. A corrected private export excludes
the original input packs, owner screenshots, recordings and nested archives. Its
supplied preview runtime remains private and is not copied into the MIT app.

Validation includes the Refresh/uncertain-write regression, EN/UK phone viewport
and radio/browsing checks, and iOS/Android/web production bundles. These checks do
not replace physical iPhone checks for safe areas, Dynamic Type, VoiceOver, audio
routes, volume buttons, or FM/DAB behavior on the receiver.
