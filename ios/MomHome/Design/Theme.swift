import SwiftUI
import UIKit

/// "Quiet Household" design tokens.
///
/// Warm, calm, premium — not an enterprise dashboard, not a medical app.
/// Colors are defined as dynamic (light/dark) so the palette is deliberately
/// designed for both appearances rather than naively inverted.
enum Theme {

    // MARK: Palette — "Warm Paper"

    /// Warm cream stock / warm charcoal.
    static let background = dynamic(light: 0xFAF5EA, dark: 0x1A1712)
    /// Ivory card / raised surface.
    static let surface = dynamic(light: 0xFFFDF7, dark: 0x252017)
    /// A slightly recessed warm fill for chips and wells.
    static let surfaceMuted = dynamic(light: 0xF1E9D6, dark: 0x2E2819)
    /// Antique gold — the brand thread and primary interactive color.
    static let primary = dynamic(light: 0xA07D2E, dark: 0xE4C579)
    /// Lighter gold for decorative labels, stars, and hairlines.
    static let gold = dynamic(light: 0xB79040, dark: 0xD9B662)
    /// Soft clay — warmth and gentle accents.
    static let clay = dynamic(light: 0xB96A4C, dark: 0xD79372)
    /// Periwinkle — quiet secondary accent.
    static let lavender = dynamic(light: 0x6D6EA0, dark: 0xA6A3C4)

    // MARK: Text

    static let ink = dynamic(light: 0x2B2A22, dark: 0xF1EEE6)
    static let inkSecondary = dynamic(light: 0x857C68, dark: 0xB7B2A6)
    static let inkTertiary = dynamic(light: 0xA79E86, dark: 0x847F73)

    // MARK: Semantic (separate from the accent)

    static let good = dynamic(light: 0x4C7A6B, dark: 0x86B3A3)
    static let warning = dynamic(light: 0xB0791F, dark: 0xD9A159)
    static let critical = dynamic(light: 0xBF5561, dark: 0xE08A7C)

    // MARK: Category color code (Do / Buy / Take / Watch / Help)

    static let catDo    = dynamic(light: 0x8A5AA5, dark: 0xC0A3DE)
    static let catBuy   = dynamic(light: 0x4C7A6B, dark: 0x86B3A3)
    static let catTake  = dynamic(light: 0xB7862A, dark: 0xD9B662)
    static let catWatch = dynamic(light: 0x6D6EA0, dark: 0xA6A3C4)
    static let catHelp  = dynamic(light: 0xBF5561, dark: 0xDD8A8A)

    // MARK: Lines & shadow

    static let hairline = dynamic(light: 0xECE3D0, dark: 0x38311F)
    static let shadow = Color.black.opacity(0.06)

    // MARK: Shape

    static let cardRadius: CGFloat = 20
    static let controlRadius: CGFloat = 14
    static let pillRadius: CGFloat = 999

    // MARK: Spacing scale

    enum Space {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 24
        static let xxl: CGFloat = 32
    }

    // MARK: Helpers

    static func dynamic(light: UInt, dark: UInt) -> Color {
        Color(uiColor: UIColor { traits in
            UIColor(rgb: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

extension UIColor {
    fileprivate convenience init(rgb: UInt) {
        self.init(
            red: CGFloat((rgb >> 16) & 0xFF) / 255.0,
            green: CGFloat((rgb >> 8) & 0xFF) / 255.0,
            blue: CGFloat(rgb & 0xFF) / 255.0,
            alpha: 1.0
        )
    }
}

// MARK: - Typography

/// Warm serif for titles (New York), system for body — both built in, so no
/// bundled fonts, and full Dynamic Type support.
extension Font {
    static func serifTitle(_ style: Font.TextStyle = .title) -> Font {
        .system(style, design: .serif)
    }
}

extension View {
    /// Large calm screen title used at the top of each tab.
    func screenTitle() -> some View {
        self.font(.system(.largeTitle, design: .serif).weight(.semibold))
            .foregroundStyle(Theme.ink)
    }
}
