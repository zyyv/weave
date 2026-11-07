#!/usr/bin/env swift
import AppKit

// Preserve the transparent mascot silhouette; never add a backing tile.
let sourceURL = URL(fileURLWithPath: "assets/logo-source.png")
let sourceData = try Data(contentsOf: sourceURL)
guard let bitmap = NSBitmapImageRep(data: sourceData), let cgImage = bitmap.cgImage else {
    fatalError("Cannot read assets/logo-source.png")
}
guard bitmap.hasAlpha else { fatalError("The approved logo must retain transparency") }
let source = NSImage(cgImage: cgImage, size: NSSize(width: cgImage.width, height: cgImage.height))
var left = bitmap.pixelsWide, right = -1, top = bitmap.pixelsHigh, bottom = -1
for y in 0..<bitmap.pixelsHigh {
    for x in 0..<bitmap.pixelsWide {
        if (bitmap.colorAt(x: x, y: y)?.alphaComponent ?? 0) > 0.05 {
            left = min(left, x); right = max(right, x)
            top = min(top, y); bottom = max(bottom, y)
        }
    }
}
guard right >= left, bottom >= top else { fatalError("The source logo is empty") }
let contentRect = NSRect(x: left, y: bitmap.pixelsHigh - bottom - 1,
                         width: right - left + 1, height: bottom - top + 1)
func render(_ size: Int) throws -> Data {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    NSGraphicsContext.current?.imageInterpolation = .high
    let edge = CGFloat(size)
    let scale = edge * 0.88 / max(contentRect.width, contentRect.height)
    let width = contentRect.width * scale, height = contentRect.height * scale
    let rect = NSRect(x: (edge - width) / 2, y: (edge - height) / 2, width: width, height: height)
    source.draw(in: rect, from: contentRect, operation: .copy, fraction: 1)
    NSGraphicsContext.restoreGraphicsState()
    // Verify that resizing has not introduced an opaque backing plate.
    guard rep.colorAt(x: 0, y: 0)!.alphaComponent == 0,
          rep.colorAt(x: size / 2, y: 0)!.alphaComponent == 0,
          rep.colorAt(x: size / 2, y: size - 1)!.alphaComponent == 0 else {
        fatalError("Unexpected transparency in rendered icon")
    }
    return rep.representation(using: .png, properties: [:])!
}
for (path, size) in [("assets/AppIcon.png", 1024), ("assets/logo-preview.png", 256), ("assets/dock-preview-32.png", 32), ("assets/dock-preview-48.png", 48), ("assets/dock-preview-64.png", 64), ("frontend/logo.png", 128), ("frontend/app-icon.png", 128)] {
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
