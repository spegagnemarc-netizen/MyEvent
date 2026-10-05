import ARKit
import RealityKit
import UIKit
import CryptoKit
import AVFoundation

struct LensManifest: Codable {
    let schemaVersion: Int
    let id: String
    let label: String
    let tracking: String
    let asset: String
    let sha256: String
    let scale: Float
}

/// Separate capture backend: ARKit owns its camera. Never run alongside CameraEngine.
@MainActor final class LensEngine {
    let view = ARView(frame: .zero)
    private var anchor: AnchorEntity?
    var supported: Bool { ARFaceTrackingConfiguration.isSupported }
    init() { view.automaticallyConfigureSession = false }
    func start(manifest: LensManifest) throws {
        guard supported, AVCaptureDevice.authorizationStatus(for: .video) == .authorized,
              manifest.schemaVersion == 1, manifest.tracking == "face",
              manifest.asset.range(of: "^[a-zA-Z0-9_-]+\\.usdz$", options: .regularExpression) != nil,
              manifest.sha256.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
              (0.01...10).contains(manifest.scale),
              let assetURL = Bundle.main.url(forResource: String(manifest.asset.dropLast(5)), withExtension: "usdz") else {
            throw NSError(domain: "MyEventLens", code: 1, userInfo: [NSLocalizedDescriptionKey: "Lens non compatible"])
        }
        let bytes = try Data(contentsOf: assetURL, options: .mappedIfSafe)
        guard bytes.count <= 20*1024*1024,
              SHA256.hash(data: bytes).map({ String(format: "%02x", $0) }).joined() == manifest.sha256 else {
            throw NSError(domain: "MyEventLens", code: 2, userInfo: [NSLocalizedDescriptionKey: "Intégrité Lens invalide"])
        }
        let model = try Entity.load(contentsOf: assetURL)
        stop()
        let face = AnchorEntity(.face)
        model.scale = SIMD3<Float>(repeating: manifest.scale)
        face.addChild(model)
        view.scene.addAnchor(face); anchor = face
        view.session.run(ARFaceTrackingConfiguration(), options: [.resetTracking, .removeExistingAnchors])
    }
    func snapshot(completion: @escaping (UIImage?) -> Void) {
        guard anchor != nil else { completion(nil); return }
        view.snapshot(saveToHDR: false, completion: completion)
    }
    func stop() { view.session.pause(); view.scene.anchors.removeAll(); anchor = nil }
}
