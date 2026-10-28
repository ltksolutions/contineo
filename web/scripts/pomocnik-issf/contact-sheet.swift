// Pás zmenšených snímok z videa vedľa seba, na kontrolu časovania:
// swift contact-sheet.swift <video> "1.0,2.5,4.0" <výstup.png>
import AVFoundation
import AppKit
let a = CommandLine.arguments
let g = AVAssetImageGenerator(asset: AVURLAsset(url: URL(fileURLWithPath: a[1]))); g.requestedTimeToleranceBefore = .zero; g.requestedTimeToleranceAfter = .zero
var imgs: [CGImage] = []
for s in a[2].split(separator: ",") { imgs.append(try! await g.image(at: CMTime(seconds: Double(s)!, preferredTimescale: 600)).image) }
// zložené vedľa seba, zmenšené na 1/4
let w = imgs[0].width / 4, h = imgs[0].height / 4
let ctx = CGContext(data: nil, width: w * imgs.count, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
for (i, im) in imgs.enumerated() { ctx.draw(im, in: CGRect(x: i * w, y: 0, width: w, height: h)) }
let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[3]))
