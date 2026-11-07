# Weave

[简体中文](README.zh-CN.md)

A macOS desktop app for browsing, organizing, and exporting files from local resource folders. Find images, videos, voice messages, and documents in one library, with conversation views and built-in media previews.

Built with Go and MyGo, using the system WKWebView. The packaged app needs no Electron, Node.js, or Go runtime.

## Installation and first launch

Requires macOS 12 or later. Choose a package matching your Mac: `arm64` for Apple silicon or `amd64` for Intel. Availability depends on the files attached to the release.

1. Download and open the `.dmg` from this project's GitHub Releases.
2. Drag **Weave.app** into **Applications**, then launch Weave from Applications. Eject the disk image after installation. Alternatively, download the ZIP, extract it, and move Weave.app into Applications.
3. If macOS blocks the first launch, after attempting to open the app, go to **System Settings → Privacy & Security → Open Anyway**, authenticate if prompted, and confirm opening it. On older macOS versions, use **System Preferences → Security & Privacy → General**. macOS saves an exception for this app, so subsequent launches normally work directly.

**The current build uses only a local ad-hoc signature. It has no Apple Developer ID signature and is not notarized by Apple.** Only allow an app whose source you trust and which has not been tampered with; see [Apple's instructions](https://support.apple.com/en-us/102445). If macOS reports that the app is damaged or contains malware, stop installation, download it again, and report the exact message instead of treating it as an ordinary unidentified-developer warning.

## Build locally

On macOS, install Go (see `go.mod` for the required version), then run:

```sh
./build.sh
```

The script reads the version from `package.json` and produces `build/Weave.app`, `build/Weave-v<version>-macOS-<arch>.dmg`, and `.zip`, using the local Go target architecture by default (typically `arm64` on Apple silicon). It verifies the app signature and DMG checksum. Use these generated packages; copying `.app` bundles directly through synced Documents folders can affect signing metadata.

## Release a new version

The release command uses [bumpp](https://github.com/antfu-collective/bumpp). Install Node.js 24.11+ (24.x) and npm, ensure Git can push to the repository, and run `npm ci` once. Commit the changes you want to release on `main` and start with a clean working tree:

```sh
npm run release
```

By default this increments the patch version, for example `0.0.1 → 0.0.2`. After confirmation, it updates `package.json`, the lockfile, MyGo configuration, and the settings-page version, runs checks, creates a release commit and `v0.0.2` tag, and pushes them to GitHub. The app bundle reads its version from `package.json`.

To publish the initial `0.0.1` without incrementing it (before `v0.0.1` exists):

```sh
npm run release -- --release 0.0.1
```

Use `npm run release -- --release 0.1.0` for an explicit version, or add `--yes` to skip bumpp's confirmation.

Pushing a `v*` tag triggers GitHub Actions to check, test, and build Apple silicon DMG and ZIP packages on a macOS runner, generate `SHA256SUMS.txt`, and publish them to [Releases](https://github.com/zyyv/weave/releases). Building and uploading happen on GitHub. The workflow uses the automatic `GITHUB_TOKEN`; no Apple certificates or additional publishing tokens are required. GitHub Actions must be enabled for the repository.

Follow progress in [Actions](https://github.com/zyyv/weave/actions/workflows/release.yml). After fixing a failure, rerun failed jobs; incomplete drafts can resume uploading, while published versions are never overwritten. A private repository's releases are accessible only to people with repository access. If a Git push fails after the local tag is created, finish pushing that commit and tag before bumping another version.

## Features

| Feature | What you can do |
| --- | --- |
| Browse your library | Explore files by conversation or in a flat view. Switch between grid and list layouts, sort by modification time, size, or name, and browse conversations grouped by date. |
| Search and organize | Search filenames, tags, and bound conversation names or account identifiers. Combine file-type, conversation, and favorites filters; select multiple file types within a conversation. Add favorites and tags for later. |
| Preview and play | View images, paired originals and thumbnails, file details, and TXT / MD / CSV previews. Play video and audio with seeking, volume, and speed controls; navigate audio with a waveform. Decode SILK and AMR-NB voice messages locally. |
| Name conversations | Manually associate folder identifiers with confirmed contact names, group chats, or custom names. Import mappings in JSON; bindings are kept separately for each resource root. |
| Export files | Reveal a file in Finder or copy up to 200 selected resources to a folder using the native directory picker. Exported files use `resourceID_originalFilename` and do not overwrite existing files. |

The interface supports English and Simplified Chinese, dark / light / system appearance, three color palettes, and comfortable or compact spacing. Preferences are saved automatically. Virtual scrolling, thumbnail caching, and background audio decoding help keep large libraries responsive.

## Local data and limitations

Weave reads the source directory without deleting, moving, renaming, or writing its files. Previews, playback, and voice decoding run locally without external requests. The local service listens only on `127.0.0.1`, using a random port and access path, and rejects cross-origin requests.

Library metadata is stored separately in `~/Library/Application Support/Weave/`:

| File | Contents |
| --- | --- |
| `marks.json` | Favorites and tags |
| `source.txt` | Selected resource directory |
| `settings.json` | Preferences and conversation bindings |

- **Conversation names are manual.** Weave does not decrypt contact or session databases, infer names from folder hashes, or verify account ownership.
- **Preview support depends on the format.** Encrypted DAT / PIC images and unsupported media codecs cannot be previewed. SILK / AMR-NB decoding is limited to 16 MiB per file and 15 minutes of decoded audio; AMR-WB is unsupported. Original files can still be exported.
- **Documents have limited previews.** TXT / MD / CSV previews show up to the first 128 KiB. PDF, Office, and HTML files are managed as files without embedding or executing their contents.
- **Dates and availability come from local files.** Modification times may differ from message timestamps. Files removed from the source directory are no longer available for preview or export; rescan to refresh the library.

## Credit

Weave uses these open-source projects:

| Dependency | Role |
| --- | --- |
| [Hugeicons](https://icon-sets.iconify.design/hugeicons/) · `@iconify-json/hugeicons` 1.2.35 | Interface and player icons, bundled locally as SVG. [MIT](frontend/vendor/hugeicons/LICENSE.txt). |
| [MyGo](https://github.com/egoist/mygo) · 0.7.4 | macOS desktop shell and system WKWebView integration. |
| [WaveSurfer.js](https://github.com/katspaugh/wavesurfer.js) · 8.0.5 | Audio playback and waveform navigation. [BSD-3-Clause](frontend/vendor/wavesurfer/LICENSE). |
| [Video.js](https://github.com/videojs/video.js) · 10.3.0 | Video playback with the Neutral skin, bundled from `@videojs/cdn`. [Apache-2.0](frontend/vendor/videojs/APACHE-LICENSE-2.0.txt); [upstream notices](frontend/vendor/videojs/LICENSE). |
| [silk-wasm](https://github.com/idranme/silk-wasm) · 3.7.1 | Local decoding of SILK voice messages. [MIT](frontend/vendor/SILK-LICENSE.txt). |
| [benz-amr-recorder](https://github.com/BenzLeung/benz-amr-recorder) · 1.1.5 | Local AMR-NB decoding using its worker source. [MIT and decoder notices](frontend/vendor/AMR-LICENSE.txt). |
| [x18n](https://github.com/x18n-dev/x18n) | English and Simplified Chinese translation management during development. |

Media dependencies are bundled locally. The SILK module and WebAssembly files are unmodified; the AMR decoder's CommonJS factory is wrapped for use as a standalone worker, without microphone or recording APIs. Decoder license notices are retained. Video.js production JavaScript and CSS and the WaveSurfer ESM bundle are retained with their licenses; package sources and integrity hashes are recorded in the respective `VENDORED.json` files. Playback and decoding use local assets, with no analytics or remote media services enabled.
