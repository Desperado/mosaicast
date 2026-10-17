> Historical brand-exploration brief. For the current implementation and owner priorities, use [the 17 October design handoff](current-design-handoff.md).

# Claude Design prompt: Mosaicast — English

Copy everything below the divider into Claude Design. Optionally attach `musiccast-user-feedback.md`, the Home Entertainment README, existing screenshots, and `src/musiccast/types.ts`. Use fictional music and sample artwork. The Ukrainian equivalent is `claude-design-prompt.uk.md`.

---

Act as a senior product designer, interaction designer, and brand designer. Create **Mosaicast**, a modern, independent, open-source alternative controller for Yamaha MusicCast, with optional Samsung The Frame and AI extensions. Deliver an original identity, a complete mobile redesign, a clickable prototype, and an actionable engineering handoff.

Our central ambition: make using existing MusicCast hardware substantially easier, faster to navigate, and more understandable. Everyday music control is the core product. Artwork and AI extend an excellent controller. Make concrete decisions and proceed with stated assumptions.

## 1. Brand and character

Use **Mosaicast** as the product name and **MosAIcast** as the stylized wordmark, with subtle emphasis on AI. Use normal casing in interface text, documentation, spoken references, and accessibility labels. This is a selected working name, not a claim of trademark or store availability.

Tagline: **Your music. Your art. Your room.** Ukrainian: **Твоя музика. Твої зображення. Твоя кімната.**

The mosaic represents music, artwork, devices, and rooms coming together. Express that through composition and coordinated states; do not turn every screen into a tiled dashboard. The name's “cast” suggests connected experiences, not a promise of implemented phone-to-device streaming.

Create two visual directions, then choose one: **Gallery**, with warm ivory, ink, editorial typography, and record-sleeve compositions; **After Dark**, with deep charcoal, restrained artwork-derived accents, and tactile controls. Develop the chosen identity in light and dark themes, with a System setting. Aim for a contemporary music app with the warmth of a listening room. Keep the brand original and small-size legibility strong. Avoid generic admin dashboards, excessive glass, robot mascots, and decoration that competes with controls.

## 2. Research-based priorities

The attached research samples public iOS and Android reviews. It identifies complaints, not their prevalence or technical causes. Positive reviews and reported speed improvements also exist. Do not describe “most users” as dissatisfied or call the official app abandoned.

Use these themes as design inputs:

- Controls buried in navigation → persistent, obvious volume, mute, playback, and active-room identity.
- Too many screens for simple listening → a focused single-device experience and short paths to sources and favourites.
- Delayed responses and freezing → immediate interaction feedback, bounded loading, and independently updating regions.
- Failed reconnection or lost room state → remember devices and browsing context, show stale state, and offer contextual recovery.
- Unclear streaming-service handoffs → distinguish selecting a source, browsing its catalogue, and opening its external app.
- Unreliable grouping → show membership, individual status, and partial results rather than a single success badge.

These are design hypotheses to validate. A new interface cannot by itself repair firmware, Wi-Fi interference, service outages, synchronization, or undocumented device limitations.

## 3. Platforms and scope

Primary product: native **iOS and Android**, built in **TypeScript with Expo and React Native**. Respect safe areas, one-handed use, native navigation, and adaptive tablet layouts. Explore a desktop companion and a TV interface as extensions. Representative hardware: Yamaha CD-NT670D and Samsung The Frame 2023. Keep other models and multiple rooms in mind.

Create separate deliverable collections:

**Mobile foundation:** demo onboarding, manual local-IP connection, device capability overview, advertised source selection, explicit power/standby, native device volume and mute, supported playback controls, and available track metadata/artwork. These are implementation targets for an incomplete scaffold, not already shipped or hardware-validated mobile features.

**Expanded product:** discovery, source browsing/search, favourites, artist/album pages, optional lyrics, Frame photo management, saved scenes, multiroom controls, and an optional AI agent. Annotate required new integrations in the handoff. Existing TV experiments do not prove mobile parity. Do not clutter the first release with empty future tabs.

## 4. Navigation and daily use

Propose and test a compact architecture around **Listen**, **Rooms**, and **Library**, with **Gallery** and **Scenes** appearing when their functions are available. Settings should be easy to reach. Decide where source browsing belongs and justify the choice. Keep an active-room selector and mini-player available in relevant contexts.

For one device, open directly to its listening screen rather than requiring a room-selection ritual. For multiple rooms, make the current target unmistakable. Users should understand at a glance: what is playing, where, from which source, whether the device is reachable, and what action they can take.

Now Playing should give artwork, title, artist, album, and essential controls clear hierarchy. Handle long titles, missing covers, paused/stopped playback, no track, standby, and unavailable metadata. Keep transport and volume accessible without opening a settings sheet. Add a discreet advanced-controls area only for supported device functions; allow frequently used controls to be pinned. Do not invent bass management or DSP capabilities for unsupported hardware.

Source rows must reflect actual advertised inputs. Examples may include Deezer, network/server, USB, CD, tuner, Bluetooth, AirPlay, Spotify Connect, and external inputs. A capability is not evidence of an active connection or a currently usable service. Browsing must not silently change the input. Changing input must not imply autoplay.

Future browsing should preserve scroll position, breadcrumb/back context, and the current player. Explore search, alphabetical access for large libraries, recent items, and favourites for stations, albums, or playlists where the provider allows them. Clearly explain external-app handoffs and unavailable regional/model services. Do not promise one universal catalogue search without provider support.

## 5. Speed, responsiveness, and reliability

Design the experience around fast access to controls, not animated loading sequences. Render a cached last-known screen immediately, clearly marking stale values and refreshing independently. Cached values must never appear as freshly confirmed device state.

Show feedback immediately after a tap. Distinguish **requested**, **confirmed**, **failed**, and **outcome unknown**. A local animation is not proof of device execution. Keep unrelated controls usable while artwork or metadata loads. Slow album-art requests must not block volume or mute.

For volume, avoid accumulating delayed relative commands. Show the pending intended level, coalesce gestures in the proposed implementation where supported, and reconcile with actual device values. Do not blindly retry writes after a timeout. Refresh state first and give the user a clear choice if the outcome remains unknown. Do not send queued gestures on reconnection.

When another remote or app changes playback, update gracefully and avoid overwriting newer state. Clear stale artwork when a track/source changes. Preserve saved device identity through temporary disconnection; recovery should not require deleting a room or repeating onboarding.

Propose measurable acceptance targets, not claimed results: local visual feedback within 100 ms; remembered controls visible within 1 second in a release build on stated reference phones; no indefinite spinner; testing under 0.5–5 second device latency, packet loss, and app resume. Distinguish UI response time from device completion time. Document how a coding agent should measure these and adjust targets with evidence.

## 6. Complete English and Ukrainian experience

Deliver equivalent **English (`en`)** and **Ukrainian (`uk`)** versions of every key screen and prototype flow. Use the device language by default and provide **System / English / Українська** selection. Keep layout and functionality equal across languages.

Translate navigation, onboarding, controls, errors, recovery, permission explanations, accessibility labels, notifications, scene names, AI prompts, plans, and results. Use natural Ukrainian, not Russian or literal word substitution. Keep brand names, service names, device models, and user-provided metadata unchanged. Fonts must include Ukrainian **і, ї, є, ґ** and correct apostrophe rendering.

Provide `en.json` and `uk.json` with identical semantic keys, interpolation variables, and locale-aware plural/date/number handling. Avoid assembling sentences from translated fragments. Allow longer labels, wrapping, and 200% text scaling. Never use flags as language selectors. Switching language must preserve the active room, playback, navigation, and draft scene. It must not send device commands.

Use these as starting terminology, then maintain a consistent glossary:

| English | Українська |
| --- | --- |
| Listen | Слухати |
| Rooms | Кімнати |
| Library | Медіатека |
| Sources | Джерела |
| Now playing | Зараз грає |
| Volume | Гучність |
| Mute | Вимкнути звук |
| Power on | Увімкнути |
| Standby | Режим очікування |
| Reconnect | Підключитися знову |
| Try demo | Спробувати демо |
| Apply scene | Застосувати сцену |

Do not claim native-speaker review has occurred. Identify any copy needing linguistic validation.

## 7. Connection, hardware truth, and recovery

Offer an account-free demo and local control. Request permissions at the moment they are needed, with platform-appropriate explanations. Manual IP entry must handle invalid addresses, denied permission, unreachable devices, and success. Discovery is a future flow unless implemented. Connecting and inspecting capabilities must not switch input, power on, or alter volume.

Separate connectivity from power. A reachable Yamaha can be in standby. Remote power-on requires Network Standby and a reachable device; provide an honest failed-wake path. Pause, Yamaha standby, TV power, and Frame Art Mode are separate actions.

Volume uses the model's native range. For the CD-NT670D example, show **12 on a 0–63 scale**, not 12% or invented decibels. Transport controls depend on source and device support. Do not treat network playback controls as CD/tuner controls. Make large scene volume changes explicit.

Show recoverable states for loading, empty content, offline, denied permission, unsupported actions, stale data, unknown write outcomes, and partial group failures. Keep the listening context visible. Use concise explanations and actionable recovery, without blaming the user or exposing raw API errors.

## 8. Artwork, scenes, and optional AI

Future Gallery: local private photos, 16:9 crop preview, supported matte choices, upload progress, selecting artwork, and entering Frame Art Mode. Include TV approval, unsupported models, interrupted uploads, and storage limits. Keep photos local by default. Do not imply a paid-art subscription bypass or assume interactive app UI can run inside Art Mode.

Future Scenes: editable music/source, room targets, per-device volume, and artwork. Show actual membership and per-device outcomes. Use examples **Quiet evening / Тихий вечір** and **Sunday morning / Недільний ранок**. Only offer scheduling or linking that has a defined implementation path.

The optional agent's signature flow is **intent → editable plan → apply → verified result**. Direct controls must remain complete without chat.

English example: “Set up a quiet evening: play something mellow in the living room, keep the Yamaha at level 12, and show my coastal photos on the Frame.”

Ukrainian example: “Створи атмосферу тихого вечора: увімкни спокійну музику у вітальні, установи гучність Yamaha на 12 і покажи мої фото узбережжя на The Frame.”

Resolve ambiguity with one concise question when needed. Show exact devices, source/selection, volume, and artwork before Apply. As execution proceeds, use the mosaic idea to show each confirmed piece coming together. Provide reduced-motion equivalents. Show both success and a partial result where music starts but the TV is unreachable. Retry only the failed action after checking its current state.

Offer restoration only for captured, genuinely reversible state; do not promise undo for playback history or an uncaptured queue. Cloud AI must be opt-in and disclose what leaves the local network. Voice is an extension; text must work independently. Prototype all agent actions with mock data and no real device or cloud calls.

## 9. Accessibility and companion surfaces

Design logical screen-reader order, semantic control labels in both languages, visible keyboard/remote focus, sufficient contrast, reduced motion, and large-text layouts. Use minimum 44-point iOS and 48-dp Android targets. Never communicate state through colour alone. Treat WCAG AA as a design target, not a completed audit.

Show mobile frames at 390×844 and 360×800, tablet at 768×1024, desktop at 1440×900, and TV at 1920×1080. Adapt density and navigation. Desktop can emphasize artwork collections and scene editing; TV can emphasize current music, browsing, artwork, and optional lyrics, with sofa-readable type, directional focus, and predictable Back behavior. Lyrics have found/not-found/offline states and timing only when available. Disclose optional external metadata/lyrics lookups and let users disable them.

## 10. Deliverables and open-source handoff

Produce:

1. Two identity directions and one selected wordmark/icon, with the mosaic concept tied to useful behavior.
2. Information architecture, annotated flows, and a traceability table mapping feedback → design decision → acceptance check.
3. High-fidelity light and dark screens in English and Ukrainian, plus adaptive tablet, desktop, and TV concepts.
4. A clickable bilingual prototype: demo → connection → listen → source; standby/offline recovery; future art upload; editable agent plan with partial failure. Separate the foundation and expanded flows.
5. Components with default, pressed, focused, selected, disabled, loading, stale, and error states; semantic JSON/TypeScript tokens; complete `en.json`, `uk.json`, and glossary.
6. An implementation handoff covering navigation, state transitions, capability gating, accessibility, latency/recovery rules, acceptance checks, and proposed validation with novice and experienced MusicCast users. Keep communication behind the existing typed **Controller / Snapshot / Command** boundary and document new contracts separately.
7. An asset and license inventory: original icon/artwork, fictional artists, original sample lyrics, fonts supporting Ukrainian, and reusable icons. The app is intended to be MIT licensed; preserve required third-party notices and distinguish asset licenses. Do not copy official logos, proprietary reference-app assets, commercial covers, or private photos. Include About/Open-source licenses and independent-project attribution.

Any runnable prototype must be self-contained with mock data, no credentials, no external requests, and no real hardware writes. Web prototype code is design evidence; production remains React Native. Do not claim hardware tests, localization review, performance measurements, or accessibility audits that have not happened.

Start with a short concept and assumptions, then deliver the identity, screens, interactive flows, and handoff. The final result should make ordinary MusicCast listening feel clear and immediate, with room artwork and AI growing from that foundation.
