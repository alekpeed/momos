import SwiftUI

/// Pulls a product, store, price, and date out of pasted receipt/email text —
/// review-first, never auto-saved. Carries the safe date parsing from the web
/// engine (day-first dates don't crash; unambiguous D/M/Y is salvaged).
enum ReceiptParser {
    struct Result {
        var product: String
        var store: String
        var price: String
        var date: Date?
    }

    static func parse(_ text: String) -> Result {
        let lines = text.split(whereSeparator: \.isNewline).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        let skip = try? Regex("(?i)total|subtotal|visa|mastercard|receipt")
        let product = lines.first(where: { line in (skip.map { line.firstMatch(of: $0) == nil } ?? true) }) ?? lines.first ?? "Imported purchase"

        var price = ""
        if let r = text.range(of: "\\$?[0-9]+\\.[0-9]{2}", options: .regularExpression) {
            price = String(text[r]).replacingOccurrences(of: "$", with: "")
        }

        var date: Date?
        if let r = text.range(of: "20[0-9]{2}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}/[0-9]{1,2}/20[0-9]{2}", options: .regularExpression) {
            date = normalizeDate(String(text[r]))
        }

        return Result(product: product, store: lines.first ?? "", price: price, date: date)
    }

    private static func normalizeDate(_ raw: String) -> Date? {
        let cal = Calendar.current
        if raw.contains("-") {
            let p = raw.split(separator: "-")
            guard p.count == 3, let y = Int(p[0]), let m = Int(p[1]), let d = Int(p[2]) else { return nil }
            return make(y, m, d, cal)
        }
        let p = raw.split(separator: "/")
        guard p.count == 3, var m = Int(p[0]), var d = Int(p[1]), let y = Int(p[2]) else { return nil }
        if m > 12 && d <= 12 { swap(&m, &d) }        // salvage a day-first date
        guard (1...12).contains(m), (1...31).contains(d) else { return nil }
        return make(y, m, d, cal)
    }

    private static func make(_ y: Int, _ m: Int, _ d: Int, _ cal: Calendar) -> Date? {
        var c = DateComponents(); c.year = y; c.month = m; c.day = d
        return cal.date(from: c)
    }
}

struct ReceiptImportView: View {
    @State private var text = ""
    @State private var parsed: Parsed?

    struct Parsed: Identifiable, Hashable {
        let id = UUID()
        let product, store, price: String
        let date: Date
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Paste receipt or email text") {
                    TextEditor(text: $text)
                        .frame(minHeight: 220)
                        .autocorrectionDisabled()
                }
                Text("We'll pull out a product, store, price, and date for you to check before anything is saved.")
                    .font(.caption).foregroundStyle(Theme.inkSecondary)
            }
            .navigationTitle("Import receipt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Review") {
                        let r = ReceiptParser.parse(text)
                        parsed = Parsed(product: r.product, store: r.store, price: r.price, date: r.date ?? .now)
                    }
                    .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .navigationDestination(item: $parsed) { p in
                PurchaseEditor(name: p.product, store: p.store, price: p.price, date: p.date)
            }
        }
    }
}

#Preview {
    ReceiptImportView()
        .modelContainer(PreviewData.container)
}
