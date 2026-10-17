# Frame Music design handoff for Claude Design

Implementation update (2026-10-17): the four supplied Frame Music Directions are implemented, alongside Gallery Night, Record Store After Hours, Midnight Precision, and Classic Light/Dark: nine selectable themes with bundled fonts and a remote-accessible chooser. Gallery Night is the default; the brighter palettes are dimmed for TV viewing. Noir and Record Store use horizontal top navigation; the other styles retain the sidebar. Artist browsing immediately changes the main background, with an original orbital scene for Muse. The latest signed build has been installed and launched on the TV. Physical remote and visual validation remain pending. The brief below preserves the design exploration requirements; the implementation notes reflect the current source.

Prepared 17 October 2026. Design several distinct visual styles for a Samsung Frame TV music app, then let the owner choose a direction. This handoff covers the TV app in `Desperado/home-entertainment`. Mosaicast is a separate mobile app.

## Paste this into Claude Design

> Design Frame Music, a living room music controller for a Samsung Frame TV and a Yamaha MusicCast player. Use this brief and the supplied demo/source snapshot as the functional reference.
>
> First explore four clearly different visual directions: Warm Gallery, Listening Room Noir, Record Store, and Quiet Precision. Vary composition, typography, density, shapes, artwork treatment, focus treatment, and motion, as well as color. Keep music and artwork central, with controls readable from a sofa. Do not choose a winning direction yet.
>
> Present a Browse screen and a Now Playing screen for each direction at 1920 × 1080. Use the same example content and include a clearly focused control in every screen. Provide a comparison explaining the experience, readability, remote navigation, and implementation tradeoffs of each direction. A light/dark pair alone does not satisfy this exploration.
>
> Build a keyboard-operable prototype with a theme chooser so the owner can compare directions. Include Browse, nested results, Sources, Now Playing with lyrics, Connection, Search, and an exit confirmation. Preserve the behavior and device boundaries below. Use simulated data only. No real device connection, installation, deployment, or external account setup.
>
> Return named screens, state variants, a reusable component set, semantic theme tokens, navigation/focus annotations, motion specifications, exportable assets with licensing notes, and implementation guidance for this small HTML/CSS/JavaScript Tizen app. Distinguish a visual proposal from an implemented or hardware-verified capability.

## Product and audience

Frame Music lets someone choose music from the sofa using a Samsung remote. The Yamaha streams the audio through its existing services and accounts. The TV shows browsing menus, current track information, artwork, lyrics, playback controls, and Yamaha volume/mute. A guest should understand where focus is and what OK or Back will do without learning the interface.

Target hardware is the Samsung Frame GQ55LS03BGUXZG and Yamaha CD-NT670D. The packaged app declares Tizen 6.5 as its minimum. Use a 16:9, 1920 × 1080 design canvas and show how it scales to a 4K display. Treat the TV as the primary surface; a narrow desktop preview is secondary. Design for viewing from roughly 2–3 metres away.

The current implementation uses plain HTML, CSS, and JavaScript with no runtime dependencies. Its build produces one classic script for Tizen. Avoid requiring React, a server-rendered framework, remote web fonts, expensive shaders, or continuous background animation. Provide local assets and a practical system-font fallback. Check any proposed browser features against the declared runtime during implementation.

## Four directions to explore

These are starting briefs, not approved final palettes or layouts. All four must retain the same functions and remote contract.

| Direction | Visual character | Composition and typography | Artwork and focus |
| --- | --- | --- | --- |
| Warm Gallery | An art book in a bright living room: warm paper, deep olive, restrained terracotta | Generous whitespace; editorial serif headings with clear sans-serif controls; compact, orderly navigation | Artwork as a framed print; crisp contrasting focus ring and a steady selected surface |
| Listening Room Noir | A dim listening room: near-black charcoal, warm ivory, a small amber accent | Large artwork and quiet chrome; generous song titles; restrained sans-serif with an optional editorial title face | Cinematic artwork field with bounded gradients; a sharp focus outline that stays visible over every cover |
| Record Store | A lively collection: cobalt, vermilion, butter yellow, strong black/white contrast | Bold graphic typography, numbered sections, confident rectangular tiles and denser browsing | Sleeve-like artwork blocks; clear inset or offset focus frame; energy through composition rather than constant animation |
| Quiet Precision | A modern hi-fi component: cool neutral surfaces, fine dividers, one restrained accent | Precise grid; straightforward sans-serif hierarchy; tabular numerals for device state and volume | Artwork with minimal decoration; unmistakable focus bracket or outline; compact controls with generous spacing |

Show each direction with the same long-title, missing-art, and busy-state examples. Compare daytime readability and dim-room comfort. Explore a suitable appearance variant for each family only after establishing its distinct identity. All four families should ultimately be switchable themes of the same app, rather than separate feature sets.

## Screen inventory and functional boundaries

| Screen | Required content and actions | States to show |
| --- | --- | --- |
| Browse | Source name, menu title, menu cards, item count, Refresh, previous/next page, access to Sources and Now Playing | Root, nested collection, page 2, long title, unavailable item, empty menu, request pending, failure |
| Now Playing | Cover, title, artist, album, playback state/time, lyrics and lyric scroll buttons, persistent playback/sound access | Playing, paused, missing metadata, loading/missing/failed cover, lyrics loading/found/missing/instrumental/unavailable |
| Sources | Inputs reported by the Yamaha; separate Browse and Switch input actions; current input; supported-capability overview | Current input disabled, non-browsable source, source removed, standby, menu unavailable |
| Connection | Local IPv4 input, Connect, Explore the demo, Close, readable validation/error | Demo, connecting, connected, failed reconnect with address preserved, invalid address |
| Search | Text input, Search, Close, clear results title | Empty query, submitting, results, no results, error; TV keyboard open |
| Exit confirmation | “Leave Frame Music?”, Keep listening, Exit Frame Music | Keep listening focused initially; Back cancels; Yamaha playback continues after app exit |
| Shared shell | Navigation, appearance control, connection status, Yamaha power state/actions, content toolbar, persistent player | Selected navigation, focused control, disabled control, mute, volume limit, standby, unsupported playback |

The current Deezer root has Flow, Charts, Recommendations, Mixes, Genres, My library, and Search. Real menu contents come from Yamaha. A page contains up to eight items with capability flags: open collection, play, search, or unavailable. Do not assume every item has an image or that every collection can play.

The demo advertises 16 inputs: Napster, Spotify Connect, Juke, Qobuz, TIDAL, Deezer, AirPlay, MusicCast Link, PC / NAS, Internet radio, Bluetooth, USB, FM / DAB radio, CD, Optical input, and AUX. Actual inputs depend on device capabilities. Browse and Switch input must remain distinct: browsing reads a menu; switching explicitly changes the input with network/USB autoplay disabled. Service availability is not guaranteed merely because a device advertises it.

Playback controls apply to supported network/USB inputs. CD, radio, external inputs, and standby can disable them. Volume is the Yamaha's native scale (the demo uses 0–63), not a percentage. Power on and Standby are explicit actions; appearance changes, browsing, connecting, and exiting must never trigger them. Capability labels describe device support; they are not extra implemented settings.

Account setup, Bluetooth pairing, network configuration, queue editing, station tuning, and multiroom setup remain in MusicCast or the Yamaha remote. Do not invent working controls for these. Lyrics are plain text with manual remote scrolling; synchronized karaoke and word highlighting are outside this scope. The TV is a music controller; Samsung Art Mode and automatic app launch are outside this redesign.

## Remote navigation contract

The primary controls are a directional pad, OK, and Back. Every core task must work with these alone. Media and volume keys are useful shortcuts; color keys, pointer interaction, long presses, and hidden gestures must never be required.

| Area or action | Expected behavior |
| --- | --- |
| Sidebar | Up/Down follows navigation order. Right enters the current content at its remembered item. Down past the final navigation item reaches the player. Up past the first reaches appearance. |
| Content grid | Left/Right moves within the same row. Right at the row edge stays put. Left at the first enabled control enters the sidebar. Up/Down follows nearby rows, preserving the column where possible. |
| Above content | Up past the top row reaches the toolbar. Further Up traverses available power, Back, and appearance controls. Hidden or disabled areas are skipped. |
| Player | Down past the last content row reaches the player, initially Play/Pause. Left/Right follows visible enabled playback and sound controls. Up returns to the originating area and remembered item. |
| Button bars | Left/Right follows control order. Vertical movement changes areas. Avoid tiny islands that take many presses to reach. |
| Returning to a view | Restore the enabled item and main scroll position after Now Playing, Sources, and nested Back navigation. Restore the prior page too. If content changed, select a sensible visible fallback. |
| Opening Now Playing | Focus Play/Pause when available. Up reaches lyric controls when present, otherwise the toolbar. Back returns to the screen that opened it. |
| OK | Activates once per press. A held OK must not open a collection and accidentally play its first item. Collections with both open and play capabilities open on OK; the media Play key can play them. |
| Back | Close a dialog first; leave Now Playing or Sources next; then move up the Yamaha menu. At the TV root, ask before exiting with Keep listening selected. Repeated held Back does not cascade through screens. Browser Escape acts as Back, with a home-menu status instead of exiting the browser. |
| Dialog | Focus stays inside. Back closes and restores the previous visible control. Tab/Shift+Tab cycles inside for desktop testing. Left/Right in a text field keeps native cursor behavior. |
| Held arrows | Move predictably without queuing delayed navigation; repeat events are paced to at most one move per 110 ms. Separate presses remain immediate. |
| Media keys | Play/Pause, Play, Pause, Stop, Previous, Next use the existing player commands. Shortcuts do not act through an open dialog. |
| Volume/mute | Control Yamaha while the app is in the foreground, including dialogs. Mute repeats are suppressed; volume requests do not accumulate while an action is pending. Onscreen controls are always available when supported. |

The current code implements this baseline. If a direction changes the area layout, provide an explicit directional map and any proposed contract changes for engineering review. Focus restoration uses stable item identity; do not turn refreshes into jumps back to the first card. Another MusicCast controller can change the shared device menu, so stale selections must refresh and ask the user to choose again.

## Components, type, and state design

Supply reusable specifications for navigation items, menu cards, source cards with two distinct actions, button bars, playback controls, sound controls, volume value, status badges, artwork/fallbacks, lyric panel, text input, dialog, notification, and theme chooser.

For each, show default, focused, selected/current, focused-and-selected, pressed, disabled, busy, and error states where relevant. “Current input,” “Playing,” and keyboard focus are different meanings. Do not rely on color alone to communicate them. Keep geometry stable as focus moves; avoid growing cards or rewrapping rows on focus.

Suggested starting measurements at 1920 × 1080: 48 px outer safe area; 32–40 px primary action labels; 28–32 px body text; 24 px minimum useful secondary text; 64 px action height; a 4 px focus outline with a visible gap. These are design targets to test, not claims about Samsung platform requirements. The current UI has smaller labels; improving sofa readability is part of the assignment. Use hierarchy and progressive disclosure to fit the information. Keep playback reachable and focused content clear of the fixed player.

Show long source names and a title such as “An unusually long collection title with several words and an extended edition.” Define truncation and a readable full-title treatment without a marquee or layout shift. Provide a portrait/missing cover fallback that belongs to every theme. Avoid implying demo art is actual album artwork.

Specify foreground/background contrast values for the final palette. Target at least 4.5:1 for normal text, 3:1 for large text and meaningful UI outlines, plus an unambiguous focus shape. Test focus against selected surfaces, cover artwork, dialogs, and both bright and dark backgrounds. Pair status color with text or an icon.

Use brief, interruptible focus feedback (roughly 100–150 ms as a starting point). Define reduced-motion behavior. Avoid focus zoom that pushes neighboring controls, essential actions revealed only by hover, automatic screen changes, and persistent animated backgrounds.

## Theme architecture and engineering return

The app selects one of nine themes with `document.documentElement.dataset.theme`. An explicit choice is saved as `frame-music-theme`; missing or unrecognized preferences fall back to `gallery-night`. `dataset.style` selects the shared visual family and `dataset.navigation` selects top or side navigation. Tokens and family layouts live in `app/themes.css`, layered over `app/styles.css`. The four directions above describe the original exploration brief and are now implemented, with three darker variants and the two classic themes.

The existing CSS variables in `app/styles.css` are:

```text
--paper --ink --green --muted --line --focus
--surface --selected --hover --featured --card-line
--icon-bg --icon-warm --icon-warm-ink --icon-neutral --icon-neutral-ink
--arrow --error --key-line --indicator --input
--on-accent --overlay --shadow
```

Return a complete token set for each proposed family, with semantic names for accent, focus, foreground/background, current/selected, pressed, disabled, busy, error, player, dialog, and artwork fallback. Include spacing, typography, radii, borders, elevations, and motion. Map the existing variables to the proposed ones; `--green` should become a semantic accent rather than forcing every theme to be green. Separate visual family from light/dark appearance if both are offered, and explain that choice.

Provide theme IDs, display names, thumbnail previews, and the focus behavior of the theme chooser. Switching themes must preserve the current screen, selected source, playback state, focus identity, and scroll. It must issue no Yamaha commands. Explain persistence and fallback when a saved theme is unavailable. A single screen/component implementation should consume theme tokens; do not duplicate device or navigation logic per theme.

Preserve stable DOM IDs used by `app/app.js`, button semantics, accessible labels, hidden/disabled behavior, and dialog focus handling. Visual prototypes can reorganize areas, but implementation output must list any required DOM or navigation changes. Use text rendering for device-supplied titles and lyrics. Provide SVG/icon assets with their source/license and local font files only when redistribution permits it.

## Required delivery and review

1. Four direction boards, each with Browse and Now Playing at the same resolution and with the same content. Explain what makes each direction distinct.
2. A keyboard-operable comparison prototype. Include a visible current-theme choice, working D-pad behavior, Back behavior, and simulated player controls.
3. Named screens for the full inventory in the selected direction after the owner chooses. Before that choice, provide representative error/empty/focus states across the four boards and annotate remaining variants.
4. A component/state sheet, all theme tokens, typography and spacing scales, asset exports/licenses, and a directional navigation diagram.
5. An implementation note mapping designs to the source files below, including assumptions, unsupported capabilities, and any deliberate changes to this remote contract.

Acceptance walkthrough for every direction:

- Start on Browse. Move right, down, left to the sidebar, right back, and down to the player. Focus is obvious and the return item is preserved.
- Open a nested collection from page 2. Back restores that page, item, and scroll. Refresh with a removed item uses a visible fallback.
- Open Now Playing from Browse and from Sources. Back returns to the right origin. Missing artwork and lyrics do not block controls.
- Search and cancel using the remote. The input keeps normal text editing and the dialog never loses focus to the background.
- Hold an arrow, OK, and Back. There is no activation cascade or delayed queue of actions.
- Switch themes with a focused item, a scrolled view, a muted player, and an open dialog. Context and state remain intact; only appearance changes.
- Show standby, unsupported playback, volume limits, connection error, empty results, and slow Yamaha requests. Actions and recovery stay clear.
- At the TV root, Back opens exit confirmation on Keep listening; cancel returns to the prior item. Exiting leaves Yamaha playback alone.

## Files and preview

| File | Purpose |
| --- | --- |
| `Frame-Music-Demo.html` in the supplied pack | Self-contained demo of the current UI and remote behavior. Open locally; no server or dependencies. Storage is isolated and device requests are blocked. It is a reference, not one of the four new styles. |
| `app/index.html` | Screen structure, stable IDs, labels, dialogs, and navigation areas |
| `app/styles.css` | Base tokens, layout, focus, and responsive rules |
| `app/themes.css` | Nine theme palettes, visual families, local fonts, and artist backgrounds |
| `app/artist-scene.js` | Artist identification and matching artwork rules |
| `app/app.js` | View state, focus memory, areas, keyboard handling, and UI actions |
| `app/demo.js` | Simulated source inventory, menus, song, and sound controls |
| `app/protocol.js` | Yamaha capabilities, input names, allowed commands, and request serialization |
| `app/metadata.js` | Artwork and lyric states, matching, and caching |
| `test/` | Executable behavioral contracts, including remote navigation regressions |
| `README.md` | Development instructions and existing feature boundaries |

The pack includes a runnable source snapshot. With Node 22 or newer, `npm test` runs the simulated tests and `npm run build` builds the generic bundle. `npm start` serves the regular preview at http://127.0.0.1:4173; that regular preview can connect to devices if configured. For design review, use the isolated single-file demo instead.

Remote navigation and theme behavior are covered by local tests. The latest app was separately installed and launched on the TV; physical remote and visual checks remain pending. The supplied design pack is an isolated reference snapshot and predates the implemented themes. No device addresses, credentials, certificates, signed packages, or rollout attachments belong in the design pack.
