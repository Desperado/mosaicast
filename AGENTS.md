# Mosaicast contributor instructions

This is an npm-workspaces TypeScript monorepo. Run commands from the root.
Read `README.md`, `docs/architecture.md`, and app-specific AGENTS.md before edits.
Keep device adapters free of React Native dependencies. Discover controls and
limits from the device; never turn demo fixtures into real-device capabilities.
No automatic retry of a device write after an uncertain result. Refresh first.
Keep demo mode isolated: it must never create a real device client.
Add English and Ukrainian strings together. Use shared design tokens.
Run `npm run check` and `npm run bundle:check` before committing.
Review connected callers and meaningful failure cases before committing or PRs.

Never dump environment variables, configuration, credentials, or provider logs.
Inspect only explicitly allowlisted non-sensitive fields. Never print or commit
API keys, tokens, passwords, private keys, database URLs, signing keys, or other
secrets. If exposure happens, stop exposing it, report credential names only,
and recommend rotation; do not rotate without authorization.
