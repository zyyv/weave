#!/bin/zsh
set -eu
cd "$(dirname "$0")"
weave_stage=$(mktemp -d /private/tmp/weave-build.XXXXXX)
trap 'rm -rf "$weave_stage"' EXIT
weave_arch=$(go env GOARCH)
weave_version=$(plutil -extract version raw -o - package.json)
weave_bundle_version="${weave_version%%-*}"
weave_artifact="Weave-v$weave_version-macOS-$weave_arch"
weave_bundle="$weave_stage/image/Weave.app"
mkdir -p "$weave_bundle/Contents/MacOS" "$weave_bundle/Contents/Resources" build
CGO_ENABLED=0 go build -trimpath -tags mygo_noinspector -ldflags '-s -w' -o "$weave_bundle/Contents/MacOS/Weave" .
cat > "$weave_bundle/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleName</key><string>Weave</string><key>CFBundleDisplayName</key><string>Weave</string><key>CFBundleIdentifier</key><string>dev.weave.resources</string><key>CFBundleVersion</key><string>$weave_bundle_version</string><key>CFBundleShortVersionString</key><string>$weave_bundle_version</string><key>CFBundleExecutable</key><string>Weave</string><key>CFBundlePackageType</key><string>APPL</string><key>LSMinimumSystemVersion</key><string>12.0</string><key>NSHighResolutionCapable</key><true/><key>CFBundleIconFile</key><string>AppIcon</string></dict></plist>
PLIST
if [[ -f assets/AppIcon.icns ]]; then cp assets/AppIcon.icns "$weave_bundle/Contents/Resources/"; fi
# Sign outside FileProvider-managed Documents, which can reattach FinderInfo.
xattr -cr "$weave_bundle"
codesign --force --deep --sign - "$weave_bundle"
codesign --verify --deep --strict "$weave_bundle"
# Package the clean bundle before copying it into Documents, where FileProvider
# can attach FinderInfo again. Both archives preserve the app's ad-hoc signature.
ditto -c -k --keepParent --norsrc --noextattr "$weave_bundle" "build/$weave_artifact.zip"
ln -s /Applications "$weave_stage/image/Applications"
hdiutil create -volname Weave -srcfolder "$weave_stage/image" -fs HFS+ -format UDZO "$weave_stage/$weave_artifact.dmg"
hdiutil verify "$weave_stage/$weave_artifact.dmg"
cp "$weave_stage/$weave_artifact.dmg" "build/$weave_artifact.dmg"
ditto --norsrc --noextattr "$weave_bundle" build/Weave.app
xattr -d com.apple.FinderInfo build/Weave.app 2>/dev/null || true
mkdir "$weave_stage/verify"
ditto -x -k "build/$weave_artifact.zip" "$weave_stage/verify"
codesign --verify --deep --strict "$weave_stage/verify/Weave.app"
printf 'Built and verified:\n%s/build/%s.dmg\n%s/build/%s.zip\n' "$PWD" "$weave_artifact" "$PWD" "$weave_artifact"
