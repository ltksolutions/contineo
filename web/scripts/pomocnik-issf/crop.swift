// Odreže horný pás (okraj panela prehliadača) zo snímky PNG: swift crop.swift <vstup> <výstup> <px>
import AppKit
let a = CommandLine.arguments; let top = Int(a[3])!
let img = NSBitmapImageRep(data: try! Data(contentsOf: URL(fileURLWithPath: a[1])))!.cgImage!
let c = img.cropping(to: CGRect(x: 0, y: top, width: img.width, height: img.height - top))!
try! NSBitmapImageRep(cgImage: c).representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[2]))
