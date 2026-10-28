// Jeden snímok z videa v plnom rozlíšení ako PNG: swift still.swift <video> <čas v s> <výstup.png>
import AVFoundation
import AppKit
let a = CommandLine.arguments
let g = AVAssetImageGenerator(asset: AVURLAsset(url: URL(fileURLWithPath: a[1]))); g.requestedTimeToleranceBefore = .zero; g.requestedTimeToleranceAfter = .zero
let img = try! await g.image(at: CMTime(seconds: Double(a[2])!, preferredTimescale: 600)).image
try! NSBitmapImageRep(cgImage: img).representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[3]))
