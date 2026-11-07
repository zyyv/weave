#!/bin/zsh
set -eu
cd "$(dirname "$0")"
weave_stage=$(mktemp -d /private/tmp/weave-build.XXXXXX)
trap 'rm -rf "$weave_stage"' EXIT
weave_bundle="$weave_stage/Weave.app"
mkdir -p "$weave_bundle/Contents/MacOS" "$weave_bundle/Contents/Resources" build
CGO_ENABLED=0 go build -trimpath -tags mygo_noinspector -ldflags '-s -w' -o "$weave_bundle/Contents/MacOS/Weave" .
cat > "$weave_bundle/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleName</key><string>Weave</string><key>CFBundleDisplayName</key><string>Weave</string><key>CFBundleIdentifier</key><string>dev.weave.resources</string><key>CFBundleVersion</key><string>5</string><key>CFBundleShortVersionString</key><string>0.2.3</string><key>CFBundleExecutable</key><string>Weave</string><key>CFBundlePackageType</key><string>APPL</string><key>LSMinimumSystemVersion</key><string>12.0</string><key>NSHighResolutionCapable</key><true/><key>CFBundleIconFile</key><string>AppIcon</string></dict></plist>
PLIST
if [[ -f assets/AppIcon.icns ]]; then cp assets/AppIcon.icns "$weave_bundle/Contents/Resources/"; fi
# Sign outside FileProvider-managed Documents, which can reattach FinderInfo.
xattr -cr "$weave_bundle"
codesign --force --deep --sign - "$weave_bundle"
codesign --verify --deep --strict "$weave_bundle"
# The signed ZIP is the distribution artifact; Documents FileProvider can
# attach FinderInfo again after an .app has been copied into this directory.
ditto -c -k --keepParent --norsrc --noextattr "$weave_bundle" build/Weave-macOS-arm64.zip
ditto --norsrc --noextattr "$weave_bundle" build/Weave.app
xattr -d com.apple.FinderInfo build/Weave.app 2>/dev/null || true
mkdir "$weave_stage/verify"
ditto -x -k build/Weave-macOS-arm64.zip "$weave_stage/verify"
codesign --verify --deep --strict "$weave_stage/verify/Weave.app"
printf 'Built and verified: %s/build/Weave-macOS-arm64.zip\n' "$PWD"
