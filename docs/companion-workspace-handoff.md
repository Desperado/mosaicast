> Historical handoff, superseded for implementation status by [companion setup](companion.md).
> Pending mobile work is restored and the software integration is implemented; physical validation is pending.

# Mosaicast + Samsung Frame: implementation handoff

Prepared 2026-10-17. This describes the next implementation workspace; the two
apps are **not integrated yet**. Preserve the current iPhone fixes while building
the companion connection.

## Owner's goal

Make Mosaicast on iPhone and the existing `samsung-frame-tv` app feel like one
product. They should control the same Yamaha, show consistent playback state,
and work together without freezing or undoing each other's actions. Either app
must remain usable when the other app is closed. Keep native phone interaction
and the TV's remote-friendly presentation.

This is synchronized control of one receiver, not audio streaming from the
iPhone, screen mirroring, Samsung Art Mode, automatic TV launch, or new multiroom
grouping. Ask before expanding into those features.

## Restore the actual starting point

| Repository | Source workspace | Base commit |
| --- | --- | --- |
| Mosaicast | `/Users/ruslan/conductor/workspaces/mosaicast/kyiv` | `2cff67443916069b7cd66fb35926f4b468e85762` |
| Samsung Frame / Frame Music (`Desperado/home-entertainment`) | `/Users/ruslan/conductor/workspaces/samsung-frame-tv/barcelona` | `b0cb105b2a8eed527813f7f749809dffccb43a01` |

Mosaicast has substantial **uncommitted** changes. A fresh checkout of main alone
does not contain the working app. The companion ZIP contains a binary-safe patch,
new-file inventory, and complete source snapshots of both repositories. Read its
`START-HERE.md` before restoring. Do not reset, overwrite newer changes, rename
the current branch, or change the original TV workspace. The TV snapshot also
contains pending source changes beyond its base, preserved in a separate patch.
That workspace continued changing during packaging: the ZIP is a fixed reference,
not a claim to include every later edit. Check the original TV workspace for newer
work before migrating or merging it. The snapshots omit dependencies, generated
outputs, credentials, signing material, attachments, and `.context`.

The new workspace should belong to Mosaicast. Use the TV snapshot as a reference
and migration source, preserving its history/provenance. The TV snapshot has no
top-level LICENSE; confirm redistribution rights before importing its code into
the MIT repository. Its local font files have individual OFL notices that must
travel with any reused fonts. Do not replace the mobile app with prototype HTML.

Read the root instructions, `README.md`, `docs/architecture.md`, and applicable
app instructions before editing. Keep adapter code free of React Native imports.
Add English and Ukrainian strings together and use shared design tokens.

## Existing mobile work to retain

- Native Expo / React Native app with independent demo and real-device sessions.
  Native requests go directly to Yamaha; browser preview uses a loopback bridge.
- Revised Listen, Rooms, Connection, and Settings; compact layouts and artwork;
  stable updates intended to avoid flashing during volume/input changes; no raw
  debug text in the UI. Collections can scroll; ordinary Listen controls fit the
  supported phone viewports at normal text size. Accessibility text may scroll.
- Foreground iPhone physical volume buttons target the connected, eligible Yamaha
  and restore the phone's original output volume when capture ends. Busy key
  presses must not accumulate into delayed volume changes.
- Capability-driven source menus, paging, search, and playback for reported
  Deezer, PC/NAS, USB, and internet-radio menus. FM/DAB bands, tuning, presets,
  and scan controls depend on reported capabilities. Demo examples prove nothing
  about a real receiver's features.
- Explicit recovery after an uncertain command; passive refresh cannot silently
  clear that condition. Reconnect/resume only reads, never restores playback by
  sending commands.

Relevant files: `packages/musiccast/src/{client,session,browsing,tuner,types}.ts`,
`apps/mobile/src/state/{app,hardware-volume,volume-buttons}.ts*`,
`apps/mobile/src/app/{browse,(tabs)/listen}.tsx`, and `packages/i18n/src/index.ts`.
See `docs/source-browsing.md`, `docs/mobile-layout.md`,
`docs/design/current-design-handoff.md`, and the layout tests in `tests/layout/`.

Prior local checks passed during the mobile work. Source snapshots and automated
fixtures do not establish that the latest native build passed on hardware. Still
retest the owner's reported failures: physical volume, flashing during selection,
screen fit, empty states/content, and FM/DAB operation.

For this handoff, Mosaicast's `npm run check` and `npm run bundle:check` passed
again. Current layout results and packaging checks are in the ZIP's
`VALIDATION.md`.

## Existing TV app to retain

Frame Music is a small vanilla JavaScript Tizen app, with a Node development
server and no package dependencies. Reported target hardware is Samsung Frame
GQ55LS03BGUXZG with Yamaha CD-NT670D. Layout starts at 1920 × 1080 and scales for
4K. Preserve D-pad/OK/Back operation, focus restoration, held-key suppression,
foreground Yamaha volume/mute shortcuts, and exit confirmation that leaves music
playing. Keep Sources, Browse, Now Playing, artwork, lyrics, and the nine themes.

Important files in the TV snapshot:

| File | Responsibility |
| --- | --- |
| `app/protocol.js` | Yamaha validation, command routes, HTTP, per-client serialization |
| `app/app.js` | View state, global busy guard, remote handling, rendering, polling |
| `app/metadata.js` | Artwork and lyric loading/caching |
| `app/{index.html,styles.css,themes.css}` | Screen structure, focus, themes |
| `scripts/{build,server}.js` | Classic-script Tizen build and loopback development proxy |
| `test/` | Protocol, navigation, server, metadata, build, and visual-state contracts |
| `CLAUDE-DESIGN-HANDOFF.md` | Current TV interaction/design contract |

The latest TV handoff reports a signed build installed and launched; physical
remote and visual checks remain pending. Older README installation notes conflict
with that report. No TV installation was independently verified for this handoff.
The build emits a classic script for Tizen: do not assume modern browser APIs or
ship an untested Expo web bundle as the TV app.

Baseline check on 2026-10-17: the first TV `npm test` run passed 97/98; the artist
shortcut test at `test/app.test.js:1002` expected `Artist 1` but saw `Artists`
after returning to the artist list and holding Down. The isolated rerun passed;
a second full run passed 98/98. Treat this as a **flake candidate**, not a proven
hardware defect or a clean initial baseline. Its harness settles a fixed number
of microtasks; investigate completion/focus timing with a deterministic signal
before changing production navigation. `npm run build` passed. No TV source was
changed as part of this handoff.

TV lyrics currently use LRCLIB and send track/artist/album/duration to that public
service. Preserve the existing disclosure and failure behavior. Sharing playback
state does not authorize adding new external services or sending mobile data to
them automatically. Artwork and lyrics must never block receiver controls.

## Why the apps currently interfere

Mosaicast's `DeviceSession` and `MusicCastClient` share a local busy lock across
reads, writes, and browsing. Ordinary requests time out after five seconds; menu
requests can take 35 seconds. Mobile foreground polling runs every eight seconds.
Frame Music has its own request promise chain and global UI busy guard, a 36-second
request timeout, and foreground polling every ten seconds. None of these locks
coordinates separate applications.

Both use Yamaha's `list_id: main`. The receiver's menu is shared mutable state,
not a private navigation cursor for each app. Mobile's stale-menu checks reduce
accidental selection but cannot make a check followed by a write atomic against
another controller. Polling both apps faster will not solve menu contention.

The development proxies at `127.0.0.1:8092` (mobile web) and
`127.0.0.1:4173` (TV preview) are deliberately loopback-only. Neither is an
authenticated companion service. **Do not expose them on the LAN.**

## Proposed shared architecture — decide before committing to a runtime

Use one framework-independent contract for observed receiver state, discovered
capabilities, semantic commands, command outcomes, and browse-session ownership.
Keep each frontend's navigation/focus local. Share device/media state, not React
state or TV DOM state. Extract reusable behavior gradually with parity tests;
do not replace either working adapter wholesale before the first shared slice.

A small local coordinator is the leading option for reliable ordering: both
frontends connect to it; it owns participating clients' Yamaha writes and menu
transactions, publishes observed state, and gives each frontend an initial
snapshot plus revisioned updates. It must run independently of either foreground
app, for example on an owner-selected always-on home computer. **No such host
has been selected or authorized for installation.** Establish the runtime with
the owner early; do useful contract/simulator work while that is unresolved.

Do not make the iPhone or Tizen app the indispensable server. Their lifecycle
cannot provide an always-running service. If an additional home service is
unacceptable, evaluate direct/peer coordination and state its limitations:
uncoordinated direct clients cannot guarantee exclusive shared-menu transactions.
Do not promise independent simultaneous Yamaha menu cursors without evidence.

Record the decision in an architecture note. Possible package/app names such as
`packages/companion` and `apps/frame` are suggestions, not existing components.
Migrate TV source into this monorepo only after provenance and the build boundary
are understood; keep a runnable TV release path throughout.

## Synchronization contract

1. **Receiver observations are authoritative.** Share power, input, volume, mute,
   playback, track/artwork identity, tuner state, capabilities, freshness, and
   command outcome. Broadcast changes from either frontend or an external Yamaha
   remote. An event received from the other app must never echo as another write.
2. **Local interaction stays local.** Focus, open screen, scroll, search draft,
   language, and theme stay per frontend. A future “Show on TV” or follow-view
   action must be explicit; ordinary polling must not navigate either screen.
3. **Identify operations.** Use a request ID, client identity, receiver/connection
   generation, and state revision. Bound deduplication storage. Distinguish
   accepted, observed, rejected-before-dispatch, and uncertain-after-dispatch.
   A request ID is not an exactly-once guarantee across a coordinator restart.
4. **Do not replay uncertain writes.** A dropped connection after dispatch is
   uncertain, including input changes, next/previous, volume, and menu actions.
   Require explicit successful reconciliation before new writes. Never resend a
   pending write automatically on reconnect, timeout, restart, or transport retry.
5. **Order writes per receiver.** Relative volume must use fresh reported bounds
   and steps. Do not queue held buttons into later bursts. Keep source switching
   explicit with autoplay disabled; connection, appearance changes, TV exit, and
   browsing must not power on or start playback.
6. **Coordinate only shared menu operations.** Use bounded browse ownership or a
   shared browse session with tokens/revisions and explicit takeover behavior.
   Reject a stale item before dispatch and ask the user to refresh/choose again.
   Release abandoned ownership without replaying a former search/navigation path.
   External non-participating controllers can still invalidate a menu; retain
   guards and document the residual race.
7. **Handle reconnect as reads.** Get a fresh snapshot, reject old generations,
   resynchronize revisions, and show stale/offline status without losing the last
   useful view. Closing one app must not issue receiver commands or disable the
   remaining app. An unavailable coordinator must not silently create two direct
   writers; any standalone fallback needs an explicit, tested ownership policy.

## What “do not block each other” means

Remove global UI freezes by separating view activity, metadata/artwork/lyrics,
menu work, receiver control, and snapshot updates. Keep rendered elements and
focus stable; change only values that changed. Scope busy indicators and disabled
actions to the affected operation. Bound queues and shed redundant background
reads before they delay useful work.

Do not simply remove every adapter lock or dispatch simultaneous Yamaha writes.
A menu request may occupy firmware for about 30 seconds. Test whether this model
can safely service control on a separate request while that happens. Aborting an
HTTP request does not prove the device cancelled its operation. If firmware
serializes everything, keep both UIs responsive and show an honest operation
status; do not claim an instant-volume guarantee the receiver cannot meet.

Suggested measurable targets on a healthy LAN: visible local feedback within
100 ms, and the other frontend reflects a new observed state within one second
of the coordinator receiving it. These are implementation targets, not measured
hardware results or a one-second Yamaha command deadline.

## Transport and privacy requirements

Keep the service private to the intended home network, with explicit pairing,
authenticated clients, receiver allowlisting, bounded payloads/requests, and
appropriate origin checks. Investigate iOS local-network/transport policy and
Tizen secure-transport compatibility before choosing HTTP/WebSocket details.
Never ship an unauthenticated LAN command proxy or relax target validation to
arbitrary URLs. Keep credentials in platform storage, outside source/artifacts.
Redact diagnostics and show translated, actionable UI messages instead of raw
debug output. Demo mode on either frontend must create no real device client or
network command, even when the other frontend is live.

## Implement in reviewable slices

1. Restore this mobile tree; run both baselines. Map TV behavior to the mobile
   adapter and document capability/validation differences. Select the independent
   runtime without assuming the owner wants a permanently running Mac service.
2. Define versioned DTOs and a deterministic two-client simulator. Deliver the
   first complete slice: one app changes Yamaha volume, the other updates from
   observed state without polling flashes or an echoed write; reverse direction.
3. Add pairing/transport and lifecycle handling, then power/input/playback/tuner
   parity using reported capabilities. Keep both UIs usable during slow metadata.
4. Implement shared-menu ownership, stale selection handling, disconnect/uncertain
   outcomes, and external-controller reconciliation. Preserve TV remote behavior.
5. Run simultaneous phone/TV hardware checks, record evidence and limitations,
   then produce a new signed mobile build and a separately validated TV package.
   Do not mark this complete based only on a simulator or browser preview.

Use the mandatory ponytail review before any commit/PR; fix confirmed findings
and recheck connected callers. Do not commit or publish merely to make a handoff.

## Required validation

From Mosaicast root: `npm ci`, `npm run check`, `npm run bundle:check`, and
`npm run test:layout` (Chromium must be installed). From the TV root:
`npm test` and `npm run build`. Do not mix package managers or copy node_modules.

Add meaningful synchronization tests for these cases:

- Phone physical volume and TV remote volume/mute update both views once; rapid
  and simultaneous keys obey receiver bounds without duplicate/delayed writes.
- Browse/search is slow on one screen while the other UI stays responsive.
  A stale menu item cannot select something different after ownership changes.
- Disconnect after a write, coordinator restart, and reconnect never replay it;
  explicit refresh recovers. Old connection responses cannot overwrite new state.
- External Yamaha remote changes input, volume, track, or menu; the apps reconcile
  without feedback loops, focus resets, flashing, or automatic playback changes.
- Background/terminate phone, exit TV, or lose either client: the remaining app
  works; music continues. Service outage/fallback never produces hidden dual writers.
- Unsupported FM/DAB/menu features stay unavailable; demo never contacts hardware.
- Phone viewports, safe areas, normal/large text, EN/UK and light/dark remain usable;
  TV D-pad, held keys, Back, dialogs, all themes, and focus restoration still work.

## Release state to carry forward

As last recorded on 2026-10-17, production iOS **0.1.0 (7)** finished building:
[`19d7e52b-41cb-4fcb-9d3e-bbbb0cb58b1c`](https://expo.dev/accounts/quality-max/projects/mosaicast/builds/19d7e52b-41cb-4fcb-9d3e-bbbb0cb58b1c).
App Store Connect app ID is **6823949587**, bundle ID
`io.github.desperado.mosaicast`. The initial audience is the existing internal
**Mosaicast Team**, with manual build assignment; no external testers/public
release were requested.

The last submission attempt did **not** queue an upload: App Store Connect API
submission credentials still needed interactive setup. Do not report build 7 as
available in TestFlight without checking. The owner must finish the secure EAS
submission flow, Apple processing, internal tester selection/build assignment,
and outstanding beta metadata/privacy checks. Never request credentials in chat.
Preview build 6 is ad hoc and cannot be uploaded as a store build. Integration
changes are absent from build 7 and require a later build after validation.

`docs/testflight.md` records the earlier failed build attempt and must be read
with this later status; do not rebuild or submit a different binary just because
that older paragraph says no store build was queued. Reverify remote release
status before the next release action. No signing assets are included here.
