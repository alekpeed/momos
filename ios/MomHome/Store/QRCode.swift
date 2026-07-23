import SwiftUI
import CoreImage.CIFilterBuiltins
import UIKit

/// Generates crisp QR label images on-device (no network) for bin scan links.
enum QRCode {
    private static let context = CIContext()

    static func image(for string: String, scale: CGFloat = 10) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }
        let transformed = output.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        guard let cg = context.createCGImage(transformed, from: transformed.extent) else { return nil }
        return UIImage(cgImage: cg)
    }

    /// The deep-link a bin QR encodes. Mirrors the web `?container=CODE` scheme.
    static func binLink(code: String) -> String {
        "momhome://bin/\(code.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? code)"
    }
}
