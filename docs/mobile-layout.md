# Mobile layout validation

Screens use available width and safe-area insets, rather than model-name checks.
The shared screen fills the available height. Headers and page actions stay
outside collection scrolling, so navigation never disappears with a list.
Standard-size controls fit without scrolling; source lists and browse results
scroll within the remaining space. Larger native accessibility text enables
body scrolling to keep controls reachable. Tabs own the bottom safe area;
standalone screens add that inset. Content is centered and capped at 600 logical
pixels in portrait and 960 in landscape.

Listen expands artwork or station details into the available space, switches
to a compact row on short screens, and uses two columns in landscape. Playback,
radio and volume controls stay reachable at standard text sizes. Pending reads
and commands keep the same opacity and positions while blocking overlapping
writes. Menu refresh retains displayed rows until replacement; failure clears
invalid actions. Successful commands do not insert status text or move buttons. Technical guidance lives in Help/About dialogs; actionable
errors open a dismissible dialog. Connection puts manual entry before discovery.
iOS has a
decimal keypad plus dot, Connect, and Close controls above the keyboard. Commas
are normalized to dots; missing separators are never inferred.

## Automated coverage

Run `npm run check`, `npm run bundle:check`, then `npm run test:layout`.
Install Chromium first with `npx playwright install chromium` (CI also installs
its OS dependencies). Tests serve only the exported web app on loopback and
mock device responses. They never scan the LAN or send device commands.

The viewport matrix covers widths 320, 360, 375, 390, 393, 402, 414, 420, 428,
430, and 440, with portrait heights 568–956 and landscape 932×430. Every size
runs English/Ukrainian and light/dark through Listen, Sources, Rooms, Settings,
and Connection, including comma entry and invalid-address recovery.

Additional cases cover Welcome in portrait/landscape, stable control positions
after delayed commands and menu refreshes, pinned browser navigation, FM seek
and frequency steps, DAB station changes and scan/cancel, preset recall, long
metadata, double-size browser
text, and device-mode on/standby layouts. These are logical viewport checks, not native simulator tests
or proof of compatibility with every iPhone model. Browser text enlargement does
not reproduce iOS Dynamic Type or a real keyboard.

## Native checks before release

The current Expo SDK requires iOS 16.4 or newer. Use a small supported iPhone
(SE-sized), a standard notched/Dynamic Island iPhone, and a large model such as
15 Pro Max. Repeat in portrait and landscape, light/dark, English/Ukrainian,
standard and large accessibility text. On each:

- Check status bar, notch/Dynamic Island, home indicator, and tab labels.
- Confirm playback and volume are visible at standard text, and all controls
  remain reachable by scrolling at larger text sizes.
- Enter, paste, select, and edit an IP with the on-screen keyboard. Check dot,
  Connect, Close, invalid input, and recovery without losing the draft.
- Check Sources dismissal and long source names, Rooms, and Settings.
- Check standby, an unreachable device, and a resumed connection.

A tester confirmed connection and discovery on an iPhone 15 Pro Max using the
previous preview. This layout/keyboard revision still needs native validation
on its new preview build. Android needs its own keyboard and system-bar checks.
