# Shared iPhone + Samsung Frame control

The iPhone and TV contain the coordinator. No computer, server subscription or
cloud service runs while listening. With both apps open, the iPhone coordinates;
the TV sends semantic actions to it. With the phone closed, the TV coordinates
locally after a recovery interval and an explicit Refresh. Yamaha keeps streaming
the audio through its existing accounts.

## Pair once

1. Install a new iPhone native build containing `MosaicastPeer` and SecureStore,
   and the newly built TV app. Expo Go, the web phone preview and existing iPhone
   build 7 do not contain the native listener.
2. Put iPhone, TV and Yamaha on the same private Wi-Fi network. On iPhone choose
   **Connection → Connect phone + TV**, enter Yamaha's private IPv4 address and
   connect. Leave the phone app open; its local address appears on screen.
3. On TV choose **Connection → Connect phone + TV**. It automatically searches
   for the phone. Choose its address, or enter `http://PHONE_IP:8095` manually.
4. Compare the six digits on both screens. Approve on the phone, then confirm on
   the TV only if they match. Choose Refresh before sending device commands.

The TV searches its private `/24`, with 12 read-only probes at a time and a
1.2-second timeout per address. Discovery reveals only a service/version, address
and random boot identifier. It does not pair or issue Yamaha commands. After
pairing the TV tries the saved phone address and searches every 30 seconds while
active, so a changed phone IP can be found without pairing again. The phone sees
its TV through the authenticated connection; it does not scan for a TV listener.

Same Wi-Fi is insufficient if the router isolates clients. Different `/24` ranges,
guest Wi-Fi, VPNs, blocked port 8095 or denied local-network permission can prevent
automatic discovery. Manual entry handles a reachable phone outside the searched
range. Reserve Yamaha's address; changing receivers requires deliberate setup.
Only one iPhone and one TV per pairing are supported.

## Ownership when apps close

| Apps available | Coordinator and recovery |
| --- | --- |
| Both open | TV finishes its current local operation, then yields to iPhone. Refresh is required after a handoff. |
| iPhone closed or backgrounded | Its listener stops. TV waits 60 seconds after detecting loss, reads Yamaha, and requires Refresh before writes. |
| TV closed | A previously paired phone waits for TV acknowledgement. Choose **TV app is closed — take control**, then Refresh. |
| iPhone reopened | TV reconnects, drains its local operation and yields. Both apps refresh the actual receiver state. |
| Neither open | Yamaha continues playback; no coordinator runs. |

A phone authority lease lasts 12 seconds and is renewed by authenticated TV
traffic. Every Yamaha mutation is checked again immediately before dispatch,
including mutations after a slow preflight read. A late heartbeat cannot revive
an expired lease. TV recovery waits longer than the lease and in-flight request
windows. Network loss never causes an automatic write replay.

Two disconnected devices cannot distinguish an app being closed from a network
partition without an independent arbiter. **Use the phone's explicit takeover only
when the TV app is actually closed.** Automatic takeover on both sides would allow
two coordinators during a partition. This design chooses a deliberate phone
fallback and a delayed TV fallback. Standalone mode is also explicit; it bypasses
shared ownership, so do not use it concurrently with peer mode for coordinated menus.

## Pairing and local transport

The iPhone uses a foreground-only native Network.framework HTTP listener bound
to its private Wi-Fi IPv4 on port 8095. It accepts bounded JSON peer requests,
not arbitrary proxy or device routes. No certificate or computer is needed.
Discovery is public and untrusted. Pairing uses committed X25519 key exchange,
HKDF-SHA256 and a six-digit comparison approved on both screens. Compare all digits;
a mismatch means cancel pairing. Commands and snapshots use authenticated
XChaCha20-Poly1305 envelopes with direction, session, boot and counter checks.
The network sees addresses, timing and message sizes; application contents are encrypted.

Pairing keys live in iOS SecureStore and Tizen Key Manager. A failed secure save
fails pairing. Browser TV previews keep keys in memory and need pairing after
reload. Never put pairing records in localStorage, logs or source files. Re-pair
to replace a TV. Uninstalling either app may require re-pairing.

## Shared behavior

Both screens observe Yamaha's power, input, volume, playback and reported tuner
state. Navigation, focus and themes remain local. The TV retains its themes and
remote control; the phone retains EN/UK, source browsing, FM/DAB and foreground
physical-volume handling. Capabilities and limits come from Yamaha.

One device operation runs at a time, with no command queue. Busy presses are
dropped. Slow source menus leave cached Now Playing and local navigation usable.
Menu ownership lasts 45 seconds; **Take over menu** invalidates the other screen's
selection. External Yamaha apps can still change the receiver; its API cannot
make the final menu-check/selection pair atomic.

Every write is sent once. An uncertain result blocks subsequent writes until
explicit Refresh succeeds. Passive updates, resume and reconnect cannot clear
uncertainty. Refresh reads actual state; it never restores a previous volume,
input, menu or playback request. Closing either app sends no stop or power command.
There is no audio streaming, Art Mode control, automatic TV launch, service login,
CD transport or multiroom grouping.

## Development and validation

Run `npm run check`, `npm run bundle:check`,
`npm run build --workspace @mosaicast/frame` and `npm run test:layout` from the root.
Bundle exports do not compile the Swift module or establish physical-device behavior.
See [validation and outstanding hardware checks](companion-validation.md),
[native builds](native-builds.md) and [source provenance](frame-provenance.md).
