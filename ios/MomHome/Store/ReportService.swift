import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// A file wrapper for exporting a generated report (CSV or PDF) through the
/// native file/share sheet.
struct ReportDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.pdf, .commaSeparatedText, .plainText] }
    var data: Data
    var type: UTType
    init(data: Data, type: UTType) { self.data = data; self.type = type }
    init(configuration: ReadConfiguration) throws {
        data = configuration.file.regularFileContents ?? Data()
        type = .plainText
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}

@MainActor
enum ReportService {

    static func supplementsCSV(_ items: [Supplement]) -> Data {
        var rows = ["Name,Remaining,Low threshold,Instructions"]
        for s in items {
            rows.append("\(csv(s.name)),\(s.remainingCount),\(s.lowThreshold),\(csv(s.instructions))")
        }
        return Data(rows.joined(separator: "\n").utf8)
    }

    static func supplementsPDF(_ items: [Supplement], household: String) -> Data {
        let page = CGRect(x: 0, y: 0, width: 612, height: 792) // US Letter
        let renderer = UIGraphicsPDFRenderer(bounds: page)
        return renderer.pdfData { ctx in
            ctx.beginPage()
            var y: CGFloat = 56
            draw("MomOS — Supplements", at: &y, x: 48, size: 22, weight: .semibold)
            draw("\(household) · \(Date.now.formatted(date: .abbreviated, time: .omitted))", at: &y, x: 48, size: 12, color: .gray)
            y += 12
            if items.isEmpty {
                draw("No supplements tracked.", at: &y, x: 48, size: 14)
            }
            for s in items {
                let low = s.isLow ? "  (running low)" : ""
                draw("\(s.name) — \(s.remainingCount) left\(low)", at: &y, x: 48, size: 14, weight: .medium)
                if !s.instructions.isEmpty {
                    draw(s.instructions, at: &y, x: 64, size: 12, color: .darkGray)
                }
                y += 8
                if y > 740 { ctx.beginPage(); y = 56 }
            }
            draw("This is a personal reference, not medical advice.", at: &y, x: 48, size: 10, color: .gray)
        }
    }

    // MARK: - Helpers

    private static func csv(_ value: String) -> String {
        "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
    }

    private static func draw(_ text: String, at y: inout CGFloat, x: CGFloat, size: CGFloat, weight: UIFont.Weight = .regular, color: UIColor = .black) {
        let attrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: size, weight: weight),
            .foregroundColor: color
        ]
        text.draw(at: CGPoint(x: x, y: y), withAttributes: attrs)
        y += size + 8
    }
}
