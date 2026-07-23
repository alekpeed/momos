import SwiftUI
import UIKit

/// "Quiet Household" design tokens.
///
/// Warm, calm, premium — not an enterprise dashboard, not a medical app.
/// Colors are defined as dynamic (light/dark) so the palette is deliberately
/// designed for both appearances rather than naively inverted.
enum Theme {

    // MARK: Palette

    /// Soft warm cream / warm charcoal.
    static let background = dynamic(light: 0xF7F3EC, dark: 0x1A1712)
    /// Card / raised surface.
    static let surface = dynamic(light: 0xFFFFFF, dark: 0x252017)
    /// A slightly recessed fill for chips and wells.
    static let surfaceMuted = dynamic(light: 0xF0EAE0, dark: 0x2E2819)
    /// Deep sage / muted teal — primary action color.
    static let primary = dynamic(light: 0x4C7A6B, dark: 0x86B3A3)
    /// Warm gold accent, used sparingly for stars / highlights.
    static let gold = dynamic(light: 0xC29A45, dark: 0xD9B662)
    /// Soft clay — warmth and gentle warnings.
    static let clay = dynamic(light: 0xC1785C, dark: 0xD79372)
    /// Lavender-gray — quiet secondary accent.
    static let lavender = dynamic(light: 0x7E7C9C, dark: 0xA6A3C4)

    // MARK: Text

    static let ink = dynamic(light: 0x2B2A26, dark: 0xF1EEE6)
    static let inkSecondary = dynamic(light: 0x6B675E, dark: 0xB7B2A6)
    static let inkTertiary = dynamic(light: 0x938E82, dark: 0x847F73)

    // MARK: Semantic (separate from the accent)

    static let good = dynamic(light: 0x3F7A57, dark: 0x74B48C)
    static let warning = dynamic(light: 0xB06B1F, dark: 0xD9A159)
    static let critical = dynamic(light: 0xB0473A, dark: 0xE08A7C)

    // MARK: Lines & shadow

    static let hairline = dynamic(light: 0xE4DDD0, dark: 0x38311F)
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
