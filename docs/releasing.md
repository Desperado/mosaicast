# Release checklist

There is no automated store publishing or npm publishing. All workspaces are
private; this repository's first milestone is a working native controller.

Before a mobile release:

- Validate the native connection layer and permissions/transport configuration
  in new iOS/Android binaries, including local-network denial.
- Run clean-install CI, lint, typechecks, tests, and the production export.
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
- Choose final bundle identifiers, icons, versioning, build profiles and store
  accounts. Use protected CI secrets for signing; never commit credentials.
- Publish release notes that separate tested features from planned features.

The current scaffold has no signing configuration, EAS project, store listing,
AI integration, or compatibility matrix. Add those only with verified details.
