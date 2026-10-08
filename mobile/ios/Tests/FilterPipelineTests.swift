import XCTest
import CoreImage
@testable import MyEventMobile

final class FilterPipelineTests: XCTestCase {
    func testCommonRendererKeepsCropAndProducesActualFilteredPixels() throws {
        let input = CIImage(color: CIColor(red: 0.8, green: 0.2, blue: 0.1)).cropped(to: CGRect(x: 0, y: 0, width: 400, height: 300))
        let pipeline = FilterPipeline()
        let original = try XCTUnwrap(pipeline.render(input, filter: .original, ratio: 1))
        let noir = try XCTUnwrap(pipeline.render(input, filter: .monochrome, ratio: 1))
        XCTAssertEqual(original.size, CGSize(width: 300, height: 300))
        XCTAssertEqual(noir.size, original.size)
        XCTAssertNotEqual(original.pngData(), noir.pngData())
        XCTAssertEqual(pipeline.render(input, filter: .monochrome, ratio: 1)?.pngData(), noir.pngData())
    }
    func testEveryRecipeProducesAnExportableImage() throws {
        let input = CIImage(color: CIColor(red: 0.4, green: 0.6, blue: 0.2)).cropped(to: CGRect(x: 0, y: 0, width: 200, height: 300))
        for filter in CameraFilter.allCases {
            let image = try XCTUnwrap(FilterPipeline().render(input, filter: filter, ratio: 9/16))
            XCTAssertNotNil(image.jpegData(compressionQuality: 0.85))
        }
    }
}
