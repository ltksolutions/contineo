// Nahrávka obrazovky + vety komentára: orez od začiatku prvej scény, vety v čase značiek scén.
// swift narrate.swift <nahrávka.mov> <začiatok nahrávky, epoch s> "s1:ms,…,end:ms" <priečinok s s1.wav…> <výstup.mp4> <dobeh s>
import AVFoundation
let a = CommandLine.arguments
let mov = URL(fileURLWithPath: a[1]), recStart = Double(a[2])!, marksArg = a[3], voice = a[4], out = URL(fileURLWithPath: a[5])
let endPad = Double(a[6]) ?? 1.0
// značky "s1:epochMs,s2:epochMs,…,end:epochMs"
let marks = marksArg.split(separator: ",").map { p -> (String, Double) in let q = p.split(separator: ":"); return (String(q[0]), Double(q[1])! / 1000 - recStart) }
let t0 = marks[0].1 - 0.3
let tEnd = marks.last!.1 + endPad
let asset = AVURLAsset(url: mov)
let vt = try! await asset.loadTracks(withMediaType: .video)[0]
let comp = AVMutableComposition()
let cv = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
let ts: CMTimeScale = 600
try! cv.insertTimeRange(CMTimeRange(start: CMTime(seconds: t0, preferredTimescale: ts), end: CMTime(seconds: tEnd, preferredTimescale: ts)), of: vt, at: .zero)
cv.preferredTransform = try! await vt.load(.preferredTransform)
let ca = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
var prevEnd = 0.0
for (name, t) in marks where name.hasPrefix("s") {
  let au = AVURLAsset(url: URL(fileURLWithPath: "\(voice)/\(name).wav"))
  let at = try! await au.loadTracks(withMediaType: .audio)[0]
  let d = try! await au.load(.duration)
  // Veta sa neprekrýva s predchádzajúcou: začne najskôr 0,3 s po jej konci.
  let start = max(t - t0 + 0.4, prevEnd + 0.3)
  try! ca.insertTimeRange(CMTimeRange(start: .zero, duration: d), of: at, at: CMTime(seconds: start, preferredTimescale: ts))
  prevEnd = start + d.seconds
  print(name, String(format: "%.2f–%.2f", start, prevEnd))
}
try? FileManager.default.removeItem(at: out)
let ex = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetHighestQuality)!
try! await ex.export(to: out, as: .mp4)
print("OK \(String(format: "%.1f", tEnd - t0)) s")
