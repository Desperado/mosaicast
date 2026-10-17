# Source browsing

Select Deezer, PC/NAS, USB or internet radio on Listen, then tap **Browse**.
The button appears only for implemented inputs reported as Net/USB by the
connected device. A reported input can still have an unavailable menu, for
example when USB is empty or a service needs setup in Yamaha's app.

The browser follows Yamaha's menu instead of supplying a service catalog.
Folders, disabled rows, search nodes and play actions come from returned row
attributes. Pages contain up to eight rows. Opening a folder and starting
playback are separate when a row supports both. No service login, favorites
editing, artwork downloads, tuner, CD browsing or lyrics are implemented here.

**Refresh menu** rereads the current source at the first page of its current
folder; it does not reset Yamaha's menu to its root. **Back one level** asks
Yamaha for the parent; the top **Back** leaves the browser. Another remote may
have moved the shared menu. Actions reread it first and reject changed pages.
There remains a race if another remote changes it after this check.

An uncertain action is never retried. First use **Refresh status**, then
**Refresh menu** before choosing again. A playback acknowledgement means Yamaha
accepted the request; check Listen for the observed playing state. Menu retrieval
can take 30 seconds, so other controls wait for it to finish.

Implementation references are Yamaha's *Extended Control API Specification
(Basic), Rev. 1.00*, sections 7.6–7.8, available as a
[Yamaha-authored PDF mirror](https://forum.iobroker.net/assets/uploads/files/1540_yxc_api_spec_basic.pdf).
The supplied legacy TV archive is reference-only; no runtime code from it was
copied. The fictional demo catalog is not evidence of device capabilities.

## Validation

Adapter tests inject every device response. They exercise absolute paging,
attribute checks, JSON search, stale menus, unavailable and malformed responses,
the long menu timeout, serialization and uncertain results without write retry.
Session tests verify refresh gating and discarded late replies. Bridge tests
cover input/action validation and typed error propagation.

Playwright covers English/Ukrainian at 320 and 430 pixels, demo paging, search,
empty results, playback, absence of hardware requests, and fixture-based live
error recovery. These are browser viewport tests, not native phone validation.

Run `npm run check`, `npm run bundle:check`, and `npm run test:layout` from the root.
Before claiming hardware support, validate on an installed iPhone/Android build:

- Deezer account already configured in Yamaha's app, server permission granted,
  USB present/absent, and internet-radio menu availability.
- Folder navigation, eight-row boundaries, advertised search and separate Play.
- Other remotes changing the shared menu, unavailable services and offline reads.
- A failed action followed by explicit status and menu refresh, without replay.
- Keyboard dismissal, safe areas, VoiceOver/TalkBack and large text.

No real device commands or native builds were performed for these automated checks.
