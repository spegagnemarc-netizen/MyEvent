package app.myevent.mobile.effects

// Backend contract, not a registered RN module or a claimed working renderer.
// Implement with CameraX ImageAnalysis + MediaPipe and a shared GPU compositor.
data class EffectsSupport(
    val liveFilters: Boolean, val faceLandmarks: Boolean, val overlays2D: Boolean,
    val objects3D: Boolean, val segmentation: Boolean, val beauty: Boolean,
    val composedPhoto: Boolean, val composedVideo: Boolean
)
data class RenderFrame(val id: String, val timestampMs: Long, val width: Int, val height: Int)
data class BakedPhoto(val fileUri: String, val width: Int, val height: Int, val effectsBaked: Boolean)
interface EffectsBackend {
    fun capabilities(): EffectsSupport
    suspend fun loadVerifiedLens(manifestJson: String)
    suspend fun captureDisplayedFrame(): BakedPhoto
    fun release()
}
