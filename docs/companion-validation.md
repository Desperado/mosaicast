# Companion validation — 2026-10-17

The pending mobile patch and new-file inventory were restored against
`2cff67443916069b7cd66fb35926f4b468e85762` using the guarded helper. Mobile
baseline checks and the imported TV baseline/build passed before integration.
The original workspaces, branch name and remote release were not changed.

## Automated scope

The selected runtime is the two apps themselves; no computer-hosted coordinator
is included. Tests exercise two clients sharing one coordinator, bidirectional
volume observation without echo writes, busy bursts, bounded deduplication and
generations, menu lease expiry/takeover, stale selections and explicit recovery.
Peer tests exercise committed key exchange, approval on both screens, failed
secure saves, tampered encrypted messages, direction/session/replay checks,
expired authority and writes delayed behind preflight reads. They cover lost
command replies, delayed TV fallback, phone return, handoff during a slow Refresh
and explicit phone takeover without replaying a write.

Discovery tests cover private `/24` searches, concurrency bounds, invalid or
redirected responses, cancellation and strict peer service descriptors. TV tests
cover semantic translation, secure-store failure and capability-driven FM/DAB.
Existing UI tests exercise the classic bundle without newer DOM helpers, remote
keys, focus, all nine themes, lyrics and direct protocol behavior.

Local results on 2026-10-17:

- `npm run check`: type checking, lint and 188 tests passed (105 TV, 63 shared
  MusicCast, 14 mobile, 1 translation and 5 preview bridge tests).
- `npm run bundle:check`: production iOS, Android and web exports passed.
- `npm run test:layout`: 91 Chromium layout checks passed, including the native-build
  requirement in the web pairing preview, EN/UK, portrait/landscape, small phones
  and preserved mobile controls.
- `npm run build --workspace @mosaicast/frame`: classic TV artifact built.
- `xcrun swiftc -typecheck apps/mobile/modules/mosaicast-peer/ios/PeerHTTP.swift`:
  the Network.framework HTTP listener passes standalone Swift type checking.
- Expo's iOS autolinking resolver detects `mosaicast-peer`, `MosaicastPeerModule`
  and the `MosaicastPeer` pod. This is not a full Expo/iOS native compilation.

These are simulator and desktop-browser results, not physical-device evidence.
The mobile bundler reports a fallback-resolution warning for an internal
`@noble/hashes` module; all three exports succeed. The classic TV bundle is tested
on its older API surface. Compatible noble versions are pinned; native runtime
behavior remains part of the hardware gate. The dependency audit still reports
28 affected entries (18 high, 10 moderate), documented in
[dependency status](dependency-status.md).

## Required before shipping

- Compile and install a new iPhone native build and separately signed Tizen
  package. Full native compilation, signing, installation and physical checks
  have not been performed for this integration. Exports and standalone Swift
  checks do not establish release readiness.
- Run both apps with the same physical Yamaha. Alternate and rapidly press iPhone
  hardware volume and Samsung volume/mute; verify bounded writes and matching
  observed state, including volume near both limits.
- Close/terminate each app in turn. Verify the TV's 60-second recovery and Refresh
  after phone loss, and the phone's explicit **TV app is closed — take control**
  followed by Refresh. Test background/resume, phone return, authority expiry and
  network loss after dispatch with no replay or automatic playback changes.
- Hold a slow browse/search on one app while navigating cached Now Playing,
  dialogs and themes on the other. Test menu takeover, old selections and external
  Yamaha/MusicCast changes to menu, input, sound and playback.
- Validate TV discovery of the phone, changed phone IP, local-network permission
  denial, cancellation, port 8095 and manual fallback. Test native listener start,
  stop and resume; iOS transport policy; matching and mismatching comparison
  codes; SecureStore and Key Manager persistence after app restart; and minimum
  Tizen 6.5 firmware. Key Manager calls follow the
  [Samsung API reference](https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references/keymanager-api.html).
- Test a network partition. Automatic phone takeover is intentionally blocked;
  the explicit phone override is safe only when the TV app is actually closed.
- Validate reported FM/DAB tuning/presets/scan, native large text/safe areas and
  iPhone volume restoration on hardware.

## Preserved release state

As recorded in the handoff, production iOS 0.1.0 (7), EAS build
`19d7e52b-41cb-4fcb-9d3e-bbbb0cb58b1c`, finished. The last TestFlight submission
was **not queued** because interactive submission credential setup remained.
This integration is absent from build 7. No new build, submission, signing or
TestFlight availability is claimed here. Reverify remote status before a release
action; the source handoff did not authorize publishing.
