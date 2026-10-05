import CoreImage
import UIKit

enum CameraFilter: String, CaseIterable, Identifiable {
    case original, warm, cool, monochrome, vintage, cinema, contrast, blur
    var id: String { rawValue }
    var label: String {
        switch self {
        case .original: return "Original"
        case .warm: return "Chaud"
        case .cool: return "Froid"
        case .monochrome: return "Noir et blanc"
        case .vintage: return "Vintage"
        case .cinema: return "Cinéma"
        case .contrast: return "Contraste"
        case .blur: return "Flou"
        }
    }
}

/// Preview and captured photo use this same output, never an unfiltered sensor image.
final class FilterPipeline {
    private let context = CIContext(options: [.cacheIntermediates: false])
    func render(_ source: CIImage, filter: CameraFilter, ratio: CGFloat) -> UIImage? {
        let extent = source.extent
        let width = min(extent.width, extent.height * ratio)
        let height = width / ratio
        let crop = CGRect(x: extent.midX - width/2, y: extent.midY - height/2, width: width, height: height)
        var output = source.cropped(to: crop)
        switch filter {
        case .original: break
        case .warm, .cool:
            output = output.applyingFilter("CITemperatureAndTint", parameters: [
                "inputNeutral": CIVector(x: 6500, y: 0),
                "inputTargetNeutral": CIVector(x: filter == .warm ? 8000 : 4500, y: 0)])
        case .monochrome: output = output.applyingFilter("CIPhotoEffectNoir")
        case .vintage: output = output.applyingFilter("CIPhotoEffectTransfer")
        case .cinema: output = output.applyingFilter("CIColorControls", parameters: ["inputSaturation": 0.85, "inputContrast": 1.12])
        case .contrast: output = output.applyingFilter("CIColorControls", parameters: ["inputContrast": 1.2])
        case .blur: output = output.clampedToExtent().applyingFilter("CIGaussianBlur", parameters: ["inputRadius": 2]).cropped(to: crop)
        }
        guard let image = context.createCGImage(output, from: crop) else { return nil }
        return UIImage(cgImage: image)
    }
}
