#!/usr/bin/env swift
import AppKit

// The approved concept 06 is the source of truth. Preserve its transparent
// background, proportions and colors; only resize and add transparent padding.
let sourceURL = URL(fileURLWithPath: "assets/logo-source.png")
let sourceData = try Data(contentsOf: sourceURL)
guard let bitmap = NSBitmapImageRep(data: sourceData), let cgImage = bitmap.cgImage else {
    fatalError("Cannot read assets/logo-source.png")
}
guard bitmap.hasAlpha else { fatalError("The approved logo must retain transparency") }
let source = NSImage(cgImage: cgImage, size: NSSize(width: cgImage.width, height: cgImage.height))
func render(_ size: Int) throws -> Data {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    NSGraphicsContext.current?.imageInterpolation = .high
    let edge = CGFloat(size)
    let scale = edge * 0.88 / max(source.size.width, source.size.height)
    let width = source.size.width * scale, height = source.size.height * scale
    source.draw(in: NSRect(x: (edge - width) / 2, y: (edge - height) / 2, width: width, height: height), from: .zero, operation: .copy, fraction: 1)
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
print("Generated concept 06: transparent PNGs and macOS ICNS (16–1024px).")
