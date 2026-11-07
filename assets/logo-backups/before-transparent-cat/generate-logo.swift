#!/usr/bin/env swift
import AppKit

// Preserve the source artwork and colors. Normalize its existing rounded tile
// when packaging so transparent generation residue cannot appear in the Dock.
let sourceURL = URL(fileURLWithPath: "assets/logo-source.png")
let sourceData = try Data(contentsOf: sourceURL)
guard let bitmap = NSBitmapImageRep(data: sourceData), let cgImage = bitmap.cgImage else {
    fatalError("Cannot read assets/logo-source.png")
}
guard bitmap.hasAlpha else { fatalError("The approved logo must retain transparency") }
let source = NSImage(cgImage: cgImage, size: NSSize(width: cgImage.width, height: cgImage.height))
let centerX = bitmap.pixelsWide / 2, centerY = bitmap.pixelsHigh / 2
func opaque(_ x: Int, _ y: Int) -> Bool {
    return (bitmap.colorAt(x: x, y: y)?.alphaComponent ?? 0) > 0.98
}
var left = centerX, right = centerX, top = centerY, bottom = centerY
while left > 0 && opaque(left - 1, centerY) { left -= 1 }
while right + 1 < bitmap.pixelsWide && opaque(right + 1, centerY) { right += 1 }
while top > 0 && opaque(centerX, top - 1) { top -= 1 }
while bottom + 1 < bitmap.pixelsHigh && opaque(centerX, bottom + 1) { bottom += 1 }
guard right - left > bitmap.pixelsWide / 2, bottom - top > bitmap.pixelsHigh / 2 else {
    fatalError("Expected a rounded-square app tile in assets/logo-source.png")
}
// Stay just inside the existing rim; clip to its clean macOS tile silhouette.
let contentRect = NSRect(x: left + 2, y: bitmap.pixelsHigh - bottom + 1,
                         width: right - left - 3, height: bottom - top - 3)
func render(_ size: Int) throws -> Data {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    NSGraphicsContext.current?.imageInterpolation = .high
    let edge = CGFloat(size)
    let tile = NSRect(x: edge * 0.06, y: edge * 0.06, width: edge * 0.88, height: edge * 0.88)
    NSBezierPath(roundedRect: tile, xRadius: tile.width * 0.23, yRadius: tile.height * 0.23).addClip()
    source.draw(in: tile, from: contentRect, operation: .copy, fraction: 1)
    NSGraphicsContext.restoreGraphicsState()
    // Verify that resizing has not introduced an opaque backing plate.
    guard rep.colorAt(x: 0, y: 0)!.alphaComponent == 0,
          rep.colorAt(x: size / 2, y: size / 2)!.alphaComponent > 0 else {
        fatalError("Unexpected transparency in rendered icon")
    }
    return rep.representation(using: .png, properties: [:])!
}
for (path, size) in [("assets/AppIcon.png", 1024), ("assets/logo-preview.png", 256), ("frontend/logo.png", 128), ("frontend/app-icon.png", 128)] {
    try render(size).write(to: URL(fileURLWithPath: path))
}
// Modern macOS supports PNG-backed ICNS entries, including Retina sizes.
func word(_ value: UInt32) -> Data {
    var big = value.bigEndian
    return withUnsafeBytes(of: &big) { Data($0) }
}
var entries = Data()
for (kind, size) in [("icp4", 16), ("icp5", 32), ("icp6", 64), ("ic07", 128), ("ic08", 256), ("ic09", 512), ("ic10", 1024), ("ic11", 32), ("ic12", 64), ("ic13", 256), ("ic14", 512)] {
    let png = try render(size)
    entries.append(Data(kind.utf8))
    entries.append(word(UInt32(png.count + 8)))
    entries.append(png)
}
var icns = Data("icns".utf8)
icns.append(word(UInt32(entries.count + 8)))
icns.append(entries)
try icns.write(to: URL(fileURLWithPath: "assets/AppIcon.icns"))
print("Generated app logo: transparent PNGs and macOS ICNS (16–1024px).")
