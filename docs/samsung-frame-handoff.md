# Samsung Frame integration handoff

The computer-free phone + TV integration is already implemented in Mosaicast's
`apps/frame` and shared adapter. PR #12 is merged into `main`. PR #13 adds phone
Bluetooth controls and preserves that integration while resolving its merge.
No changes have been applied to the separate `samsung-frame-tv` workspaces.

## Choose the source of future TV work

Use this repository's `apps/frame` as the integrated TV source. It preserves the
imported themes, remote navigation, artwork, lyrics and notices. Read
[source provenance](frame-provenance.md) before moving code between repositories.
The original workspace may have newer presentation changes; compare those before
porting, and preserve them rather than replacing the entire app blindly.

If TV development must continue in the separate repository, port the integration
as a connected change, including these dependencies:

- `apps/frame/app/companion.js`: semantic adapter, pairing storage, discovery,
  shared menus, tuner state and lifecycle.
- `apps/frame/app/app.js`, `index.html`, `styles.css` and `config.xml`: connection
  UI, explicit mode selection, recovery controls, focus and Tizen permissions.
- `apps/frame/scripts/build.js`: bundles `packages/musiccast/src` into the classic
  TV script using esbuild. Copying only `companion.js` is insufficient.
- `packages/musiccast/src`: peer transport/crypto, controller, coordinator,
  discovery, Yamaha client, browsing, tuner and Bluetooth dependencies. Keep this
  shared implementation aligned with the phone rather than creating a second
  protocol implementation. Preserve the package dependencies and lockfile.
- The relevant `apps/frame/test` and `packages/musiccast/tests` coverage.

Generated `app/bundle.js`, pairing records, signing material and personal device
presets do not belong in source control. Keep third-party asset/font notices.

## Behavior to preserve

Follow [the coordinator guide](companion.md) for the full contract. Both apps
contain coordinator logic, but the phone coordinates while both are available.
The TV discovers the phone on the private `/24`; pairing requires matching digits
and approval on both screens. Pairing is stored in iOS SecureStore and Tizen Key
Manager. The browser TV preview keeps pairing only in memory.

On phone loss the TV waits 60 seconds and requires Refresh before writes. On TV
loss the phone requires explicit confirmation that the TV app is closed, then
Refresh. Keep the 12-second phone lease, four-second observation heartbeats during
TV operations, authority checks immediately before Yamaha writes, and bounded
request timeouts together. Returning apps must reconcile receiver state.

Commands run once without a queue. Lost replies require explicit Refresh; passive
updates cannot clear uncertainty. Menu ownership and Take over menu remain shared,
while focus and themes stay local. Background/hidden apps stop active coordination.
Demo must never construct a real receiver client.

## What PR #13 adds, and what remains TV work

The shared adapter and coordinator accept `bluetoothOutput` (boolean),
`bluetoothScan` (`start`), `bluetoothConnect` (12 hexadecimal address characters),
and `bluetoothDisconnect` (`disconnect`). Snapshots include optional Bluetooth
state only when supported and readable. Device capabilities, cached device lists
and fresh guards determine availability; refresh never starts a Bluetooth scan.

The phone exposes these controls on **Listen → Headphones**. The TV has no
headphone management screen yet. Adding one is a separate presentation task:
use the existing semantic controller, expose only discovered capabilities and
devices, show updating/uncertain states, and label Yamaha volume as speaker volume.
Headphone volume is adjusted on the headphones. Phone-local hidden headphone
preferences are not receiver pairing removal and are not synchronized to the TV.

The 30-second idle cadence and bounded three-second requested-search cadence in
PR #13 apply to direct phone mode. Shared mode retains its two-second coordinator
receiver updates; standalone TV polling retains its existing behavior.

## Build and acceptance

From the Mosaicast repository root with Node 24:

```sh
npm ci
npm run check
npm run bundle:check
npm run build --workspace @mosaicast/frame
npm run test:layout
npm run frame
```

Package/sign the built TV `app/` with Samsung tooling as described in
[the TV README](../apps/frame/README.md). Build a new native iPhone app with the
peer module; Expo Go and existing installed builds cannot gain it through a web
bundle export. See [native builds](native-builds.md).

Before claiming hardware completion, run the
[device validation checklist](companion-validation.md): pairing and changed IPs,
secure storage across restart, long menus with heartbeats, app background/close,
both handoff directions, uncertain-result recovery without replay, and remote
focus/Back behavior. Check headphone connection and speaker-volume labeling in
both phone modes. Automated exports and browser tests do not establish Swift
compilation, Tizen secure-storage support or physical handoff behavior.
