import AVFoundation
import CoreImage
import CoreMotion
import SwiftUI

final class CameraEngine: NSObject, ObservableObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    @Published private(set) var frame: UIImage?
    @Published private(set) var error: String?
    @Published private(set) var roll: Double = 0
    let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "app.myevent.camera")
    private let renderer = FilterPipeline()
    private let motion = CMMotionManager()
    private var device: AVCaptureDevice?
    private var front = true
    private var filter: CameraFilter = .original
    private var ratio: CGFloat = 3/4
    private var active = false
    private let lifecycle = NSLock()
    private var requestRevision = 0

    private func newRequest() -> Int {
        lifecycle.lock(); defer { lifecycle.unlock() }
        requestRevision += 1; return requestRevision
    }
    private func current(_ revision: Int) -> Bool {
        lifecycle.lock(); defer { lifecycle.unlock() }
        return requestRevision == revision
    }
    private func requestToken() -> Int {
        lifecycle.lock(); defer { lifecycle.unlock() }
        return requestRevision
    }

    func start() {
        let request = newRequest()
        AVCaptureDevice.requestAccess(for: .video) { [weak self] allowed in
            guard let self else { return }
            guard self.current(request) else { return }
            guard allowed else { self.fail("Autorisez la caméra dans Réglages, ou utilisez la galerie."); return }
            self.queue.async {
                guard self.current(request) else { return }
                self.active = true
                do { try self.configure(); self.session.startRunning() }
                catch { self.fail("Caméra indisponible : \(error.localizedDescription)") }
            }
        }
        if motion.isDeviceMotionAvailable {
            motion.deviceMotionUpdateInterval = 0.1
            motion.startDeviceMotionUpdates(to: .main) { [weak self] data, _ in self?.roll = data?.attitude.roll ?? 0 }
        }
    }
    func stop() {
        _ = newRequest()
        motion.stopDeviceMotionUpdates()
        queue.async { self.active = false; self.session.stopRunning() }
    }
    private func configure() throws {
        session.beginConfiguration()
        defer { session.commitConfiguration() }
        session.sessionPreset = .hd1280x720
        session.inputs.forEach { session.removeInput($0) }
        session.outputs.forEach { session.removeOutput($0) }
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: front ? .front : .back) else {
            throw NSError(domain: "MyEventCamera", code: 1, userInfo: [NSLocalizedDescriptionKey: "Objectif absent"])
        }
        let input = try AVCaptureDeviceInput(device: camera)
        guard session.canAddInput(input) else { throw NSError(domain: "MyEventCamera", code: 2) }
        session.addInput(input)
        let output = AVCaptureVideoDataOutput()
        output.alwaysDiscardsLateVideoFrames = true
        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        output.setSampleBufferDelegate(self, queue: queue)
        guard session.canAddOutput(output) else { throw NSError(domain: "MyEventCamera", code: 3) }
        session.addOutput(output)
        if let connection = output.connection(with: .video) {
            if connection.isVideoRotationAngleSupported(90) { connection.videoRotationAngle = 90 }
            if connection.isVideoMirroringSupported { connection.automaticallyAdjustsVideoMirroring = false; connection.isVideoMirrored = front }
        }
        device = camera
    }
    func flip() {
        queue.async {
            self.front.toggle()
            do { try self.configure() } catch { self.fail("Changement de caméra impossible.") }
            DispatchQueue.main.async { self.frame = nil }
        }
    }
    func set(filter: CameraFilter, ratio: CGFloat) {
        queue.async { self.filter = filter; self.ratio = ratio }
    }
    func zoom(_ factor: CGFloat) {
        queue.async {
            guard let device = self.device else { return }
            do {
                try device.lockForConfiguration()
                defer { device.unlockForConfiguration() }
                device.videoZoomFactor = max(1, min(factor, min(4, device.activeFormat.videoMaxZoomFactor)))
            } catch { self.fail("Zoom indisponible.") }
        }
    }
    func captureOutput(_ output: AVCaptureOutput, didOutput buffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard active, let pixels = CMSampleBufferGetImageBuffer(buffer),
              let image = renderer.render(CIImage(cvPixelBuffer: pixels), filter: filter, ratio: ratio) else { return }
        let token = requestToken()
        DispatchQueue.main.async {
            // Capture copies the frame actually displayed. Callbacks after stop/background are discarded.
            guard self.current(token) else { return }
            self.frame = image
        }
    }
    private func fail(_ message: String) { DispatchQueue.main.async { self.error = message } }
}
