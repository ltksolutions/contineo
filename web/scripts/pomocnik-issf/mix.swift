// Video + zvukové stopy v daných časoch (každá s vlastnou hlasitosťou), voliteľne nadpojené ďalšie videá so zvukom.
// swift mix.swift <video.mp4> <out.mp4> "subor.wav@cas@hlasitost,…" [pokračovanie.mp4 …]
import AVFoundation
let a = CommandLine.arguments
let ts: CMTimeScale = 600
let comp = AVMutableComposition()
let v1 = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let vt = try! await v1.loadTracks(withMediaType: .video)[0]
let d1 = try! await v1.load(.duration)
let cv = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
try! cv.insertTimeRange(CMTimeRange(start: .zero, duration: d1), of: vt, at: .zero)
var params: [AVMutableAudioMixInputParameters] = []
for cue in a[3].split(separator: ",") {
  let p = cue.split(separator: "@"); let au = AVURLAsset(url: URL(fileURLWithPath: String(p[0])))
  let at = try! await au.loadTracks(withMediaType: .audio)[0]; let d = try! await au.load(.duration)
  let ca = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
  try! ca.insertTimeRange(CMTimeRange(start: .zero, duration: d), of: at, at: CMTime(seconds: Double(p[1])!, preferredTimescale: ts))
  let mp = AVMutableAudioMixInputParameters(track: ca); mp.setVolume(Float(p[2])!, at: .zero); params.append(mp)
}
// pokračovania: ďalšie videá aj s ich zvukom, jedno za druhým
var at0 = d1
for path in a.dropFirst(4) {
  let v2 = AVURLAsset(url: URL(fileURLWithPath: path))
  let d2 = try! await v2.load(.duration)
  try! cv.insertTimeRange(CMTimeRange(start: .zero, duration: d2), of: try! await v2.loadTracks(withMediaType: .video)[0], at: at0)
  if let src = try! await v2.loadTracks(withMediaType: .audio).first {
    let ca = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
    try! ca.insertTimeRange(CMTimeRange(start: .zero, duration: d2), of: src, at: at0)
    let mp = AVMutableAudioMixInputParameters(track: ca); mp.setVolume(1, at: .zero); params.append(mp)
  }
  at0 = CMTimeAdd(at0, d2)
}
let mix = AVMutableAudioMix(); mix.inputParameters = params
let out = URL(fileURLWithPath: a[2]); try? FileManager.default.removeItem(at: out)
let ex = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetHighestQuality)!
ex.audioMix = mix
try! await ex.export(to: out, as: .mp4)
print("OK", String(format: "%.1f s", (try! await comp.load(.duration)).seconds))
