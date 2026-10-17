# Third-party notices

Our source and original documentation are MIT licensed. Dependencies retain
their own licenses. The npm lockfile records dependency versions and license
metadata; inspect installed packages' LICENSE/NOTICE files before distribution.
An npm package's license field alone is not a complete license audit.

The mobile setup originated from the MIT-licensed Expo template. Its notice is
retained in `licenses/Expo-MIT.txt`. No Expo placeholder images are bundled.
React, React Native and Expo are external dependencies, not relicensed here.
Native iPhone volume capture uses the MIT-licensed `react-native-volume-manager`
by Hirbod Mirjavadi. Its copyright and license are retained in the dependency.

The user-supplied Claude Design archive contains a QualityMax runtime/component
bundle and remote font imports without accompanying license notices. That
archive and runtime are not distributed in this repository. The design intake
and prompts describe the intended product; they do not grant rights to any
third-party bundle. Obtain licenses and preserve notices before importing assets.
The mobile design uses platform system fonts and no album-art files. Mosaic
artwork, SVG icon geometry, and fictional track names were created for this
implementation; the supplied runtime, fonts, and media were not imported.

MusicCast, Yamaha, Samsung, The Frame, Deezer, and other service names are
trademarks of their respective owners. This is an independent project with no
claimed endorsement. The MIT license covers our code, not third-party media,
lyrics, trademarks, streaming catalogs, or proprietary protocols.

The Samsung Frame app in `apps/frame` was imported from the owner-authorized
Desperado/home-entertainment source. Its snapshot hashes and authorization are
recorded in [Frame provenance](docs/frame-provenance.md). Its bundled typefaces
retain their original SIL OFL files in `apps/frame/app/fonts`; its Yamaha logo
retains `apps/frame/app/assets/README.md`. These notices travel with the TV app.


Peer pairing and encryption use `@noble/curves` and `@noble/ciphers` (MIT, Paul
Miller and contributors), with `@noble/hashes` for HKDF/SHA-256. Their package
LICENSE files and retained bundle notices apply. See the upstream licenses for
[noble-curves](https://github.com/paulmillr/noble-curves/blob/main/LICENSE) and
[noble-ciphers](https://github.com/paulmillr/noble-ciphers/blob/main/LICENSE).
