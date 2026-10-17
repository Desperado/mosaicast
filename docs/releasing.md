# Release checklist

There is no automated store publishing or npm publishing. All workspaces are
private; this repository's first milestone is a working native controller.

Before a mobile release:

- Validate the native connection layer and permissions/transport configuration
  in new iOS/Android binaries, including local-network denial.
- Run clean-install CI, lint, typechecks, tests, and the production bundles for iOS, Android, and web.
- Build and test iOS and Android binaries; a web preview is insufficient.
- Record device model/firmware and verify power, source, volume, mute, transport,
  stale/offline/denied-access behavior and uncertain command outcomes.
- Test VoiceOver/TalkBack, dynamic text, small screens, light/dark contrast,
  English/Ukrainian copy, and OS language/theme changes.
- Audit dependency licenses and bundled fonts/icons/media. Preserve notices.
- Triage the [dependency advisories](dependency-status.md) against the release
  lockfile and verify compatible fixes or documented mitigations.
- Review privacy disclosures against actual data flows. Do not claim zero
  collection if optional integrations send data to external providers.
- Use the `production` EAS profile for the official
  `io.github.desperado.mosaicast` identifiers. Local and preview builds use
  `io.github.desperado.mosaicast.dev` to coexist with the official app. Confirm icons,
  version/build numbers, and store accounts. Preview profiles and instructions
  are in [native builds](native-builds.md). Keep signing credentials in EAS or
  protected local storage; never commit them.
- Publish release notes that separate tested features from planned features.

Preview build profiles are configured and linked to `@quality-max/mosaicast`.
Platform signing must be set up before physical-device builds; no signing
credentials are stored in this repo.
There is no automated store submission, store listing, AI integration, or
compatibility matrix. Add those only with verified details.
