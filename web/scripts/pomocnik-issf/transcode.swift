// Prekódovanie pre web: H.264 s pevným dátovým tokom, šírka 1600 px, AAC zvuk.
// swift transcode.swift <vstup.mp4> <výstup.mp4> <bitov za sekundu>
import AVFoundation
let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1])); let out = URL(fileURLWithPath: a[2]); let rate = Int(a[3])!
try? FileManager.default.removeItem(at: out)
let vt = try! await asset.loadTracks(withMediaType: .video)[0]; let at = try! await asset.loadTracks(withMediaType: .audio)[0]
let size = try! await vt.load(.naturalSize)
let W = 1600, H = Int((Double(W) * size.height / size.width / 2).rounded()) * 2
let reader = try! AVAssetReader(asset: asset)
let vo = AVAssetReaderTrackOutput(track: vt, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]); reader.add(vo)
let ao = AVAssetReaderTrackOutput(track: at, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM]); reader.add(ao)
let writer = try! AVAssetWriter(outputURL: out, fileType: .mp4)
let vi = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H, AVVideoScalingModeKey: AVVideoScalingModeResizeAspect,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: rate, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel]])
let ai = AVAssetWriterInput(mediaType: .audio, outputSettings: [AVFormatIDKey: kAudioFormatMPEG4AAC, AVNumberOfChannelsKey: 1, AVSampleRateKey: 48000, AVEncoderBitRateKey: 96000])
vi.expectsMediaDataInRealTime = false; ai.expectsMediaDataInRealTime = false
writer.add(vi); writer.add(ai); writer.shouldOptimizeForNetworkUse = true
reader.startReading(); writer.startWriting(); writer.startSession(atSourceTime: .zero)
func pump(_ o: AVAssetReaderTrackOutput, _ i: AVAssetWriterInput) async {
  await withCheckedContinuation { (c: CheckedContinuation<Void, Never>) in
    i.requestMediaDataWhenReady(on: DispatchQueue(label: UUID().uuidString)) {
      while i.isReadyForMoreMediaData { if let s = o.copyNextSampleBuffer() { i.append(s) } else { i.markAsFinished(); c.resume(); return } }
    }
  }
}
async let v: Void = pump(vo, vi); async let s: Void = pump(ao, ai); _ = await (v, s)
await writer.finishWriting(); print(writer.status.rawValue, writer.error as Any)
