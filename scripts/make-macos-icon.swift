import AppKit
import Foundation

guard CommandLine.arguments.count == 2 else {
  fputs("Usage: swift make-macos-icon.swift <iconset-directory>\n", stderr)
  exit(2)
}

let destination = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)

let outputs: [(String, Int)] = [
  ("icon_16x16.png", 16),
  ("icon_16x16@2x.png", 32),
  ("icon_32x32.png", 32),
  ("icon_32x32@2x.png", 64),
  ("icon_128x128.png", 128),
  ("icon_128x128@2x.png", 256),
  ("icon_256x256.png", 256),
  ("icon_256x256@2x.png", 512),
  ("icon_512x512.png", 512),
  ("icon_512x512@2x.png", 1024),
]

func makeIcon(size: Int, url: URL) throws {
  let dimension = CGFloat(size)
  let image = NSImage(size: NSSize(width: dimension, height: dimension))
  image.lockFocus()

  NSGraphicsContext.current?.imageInterpolation = .high

  let background = NSColor(
    calibratedRed: 79.0 / 255.0,
    green: 70.0 / 255.0,
    blue: 229.0 / 255.0,
    alpha: 1
  )
  background.setFill()
  let radius = dimension * 0.22
  NSBezierPath(
    roundedRect: NSRect(x: 0, y: 0, width: dimension, height: dimension),
    xRadius: radius,
    yRadius: radius
  ).fill()

  let paragraph = NSMutableParagraphStyle()
  paragraph.alignment = .center

  let textAttributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: dimension * 0.37, weight: .heavy),
    .foregroundColor: NSColor.white,
    .paragraphStyle: paragraph,
  ]
  let textRect = NSRect(
    x: dimension * 0.08,
    y: dimension * 0.36,
    width: dimension * 0.84,
    height: dimension * 0.36
  )
  ("CG" as NSString).draw(in: textRect, withAttributes: textAttributes)

  NSColor.white.setStroke()
  let underline = NSBezierPath()
  underline.lineWidth = max(2, dimension * 0.034)
  underline.lineCapStyle = .round
  underline.move(to: NSPoint(x: dimension * 0.35, y: dimension * 0.26))
  underline.line(to: NSPoint(x: dimension * 0.65, y: dimension * 0.26))
  underline.stroke()

  image.unlockFocus()

  guard
    let tiff = image.tiffRepresentation,
    let bitmap = NSBitmapImageRep(data: tiff),
    let data = bitmap.representation(using: .png, properties: [:])
  else {
    throw NSError(domain: "ClassGraphIcon", code: 1)
  }
  try data.write(to: url)
}

for (name, size) in outputs {
  try makeIcon(size: size, url: destination.appendingPathComponent(name))
}
