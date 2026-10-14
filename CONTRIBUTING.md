# Contributing

Start with the README, architecture, and design intake. Open an issue before
large changes; small bug fixes and documentation corrections are welcome.

1. Fork and create a focused branch.
2. Use Node 24 and run `npm ci` at the repository root.
3. Keep shared adapters independent of UI frameworks. Add English and Ukrainian
   copy together; preserve light/dark readability and accessible touch targets.
4. Add meaningful tests for protocol parsing, command outcomes, and failure
   handling. Keep tests offline and use clearly fictional fixtures.
5. Run `npm run check` and `npm run bundle:check`.
6. Open a PR describing the actual behavior, checks performed, and hardware
   limitations. Mention device model/firmware only when actually tested.

Never submit credentials, private images, copyrighted album art or lyrics,
private device identifiers, unredacted logs, or an entire environment dump.
For an asset/dependency, record its source/license and preserve required notices.
Do not import the design archive's runtime until its license is established.

Contributions are accepted under the repository's MIT license. No CLA is
required. Keep dependency changes small; use Expo's install command for native
packages. Do not commit generated native projects or build outputs.
