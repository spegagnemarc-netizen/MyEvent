import Foundation

// Adapt the preserved prototype through this port, rather than making ARKit the app architecture.
struct EffectsSupport {
    let liveFilters, faceLandmarks, overlays2D, objects3D: Bool
    let segmentation, beauty, composedPhoto, composedVideo: Bool
}
struct BakedPhoto {
    let fileURL: URL
    let width, height: Int
    let effectsBaked: Bool
}
protocol EffectsBackend: AnyObject {
    func capabilities() async -> EffectsSupport
    func loadVerifiedLens(manifestJSON: String) async throws
    func captureDisplayedFrame() async throws -> BakedPhoto
    func release() async
}
