// Vykreslí animáciu z index.html snímku po snímke cez WKWebView do MP4 (H.264).
// swift render.swift <url bez t> <out.mp4> <fps> <scale>
import AppKit
import WebKit
import AVFoundation

let a = CommandLine.arguments
let base = a[1], out = URL(fileURLWithPath: a[2]), fps = Int(a[3]) ?? 60, scale = Double(a[4]) ?? 2

@MainActor
final class Renderer: NSObject, WKNavigationDelegate {
  let web: WKWebView
  var loaded: CheckedContinuation<Void, Never>?
  override init() {
    web = WKWebView(frame: NSRect(x: 0, y: 0, width: 1200, height: 1200))
    super.init()
    web.navigationDelegate = self
  }
  func webView(_ w: WKWebView, didFinish n: WKNavigation!) { loaded?.resume(); loaded = nil }
  func load() async { await withCheckedContinuation { c in loaded = c; web.load(URLRequest(url: URL(string: base)!)) } }
  func js(_ s: String) async -> Any? { try? await web.evaluateJavaScript(s) }
  func snap(w: Int, h: Int) async -> CGImage {
    let cfg = WKSnapshotConfiguration(); cfg.rect = CGRect(x: 0, y: 0, width: w, height: h); cfg.snapshotWidth = NSNumber(value: Double(w) * scale)
    let img = try! await web.takeSnapshot(configuration: cfg)
    var r = CGRect(origin: .zero, size: img.size)
    return img.cgImage(forProposedRect: &r, context: nil, hints: nil)!
  }
}

@MainActor
func run() async {
  let r = Renderer()
  await r.load()
  let size = await r.js("window.SIZE") as! [Int]
  let dur = await r.js("window.DURATION") as! Double
  let W = size[0], H = size[1]
  r.web.frame = NSRect(x: 0, y: 0, width: W, height: H)
  // stránka centruje scénu v okne; pri presnej veľkosti okna je scéna v (0,0)
  _ = await r.js("document.body.style.display='block'")
  let PW = Int(Double(W) * scale), PH = Int(Double(H) * scale)
  try? FileManager.default.removeItem(at: out)
  let writer = try! AVAssetWriter(outputURL: out, fileType: .mp4)
  let input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: PW, AVVideoHeightKey: PH,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 12_000_000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel]])
  let ad = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: PW, kCVPixelBufferHeightKey as String: PH])
  writer.add(input); writer.startWriting(); writer.startSession(atSourceTime: .zero)
  let frames = Int(dur * Double(fps)) + 1
  for i in 0..<frames {
    let t = Double(i) / Double(fps)
    _ = await r.js("render(\(t)); 0")
    let img = await r.snap(w: W, h: H)
    while !input.isReadyForMoreMediaData { try? await Task.sleep(nanoseconds: 2_000_000) }
    var pb: CVPixelBuffer?; CVPixelBufferPoolCreatePixelBuffer(nil, ad.pixelBufferPool!, &pb)
    CVPixelBufferLockBaseAddress(pb!, [])
    let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb!), width: PW, height: PH, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pb!), space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: PW, height: PH))
    CVPixelBufferUnlockBaseAddress(pb!, [])
    ad.append(pb!, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: CMTimeScale(fps)))
    if i % 60 == 0 { print("frame \(i)/\(frames)") }
  }
  input.markAsFinished(); await writer.finishWriting()
  print("OK \(PW)x\(PH) \(frames) frames", writer.error as Any)
}

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
Task { @MainActor in await run(); exit(0) }
app.run()
