import SwiftUI

// MARK: - Tone

/// Semantic tone for pills and accents, kept separate from the brand accent.
enum Tone {
    case neutral, primary, good, warning, critical, gold, lavender

    var fill: Color {
        switch self {
        case .neutral:  return Theme.surfaceMuted
        case .primary:  return Theme.primary.opacity(0.14)
        case .good:     return Theme.good.opacity(0.16)
        case .warning:  return Theme.warning.opacity(0.16)
        case .critical: return Theme.critical.opacity(0.16)
        case .gold:     return Theme.gold.opacity(0.18)
        case .lavender: return Theme.lavender.opacity(0.16)
        }
    }

    var ink: Color {
        switch self {
        case .neutral:  return Theme.inkSecondary
        case .primary:  return Theme.primary
        case .good:     return Theme.good
        case .warning:  return Theme.warning
        case .critical: return Theme.critical
        case .gold:     return Theme.gold
        case .lavender: return Theme.lavender
        }
    }
}

// MARK: - Card

struct Card<Content: View>: View {
    var padding: CGFloat = Theme.Space.lg
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
                    .strokeBorder(Theme.hairline, lineWidth: 1)
            )
            .shadow(color: Theme.shadow, radius: 10, x: 0, y: 4)
    }
}

// MARK: - Status pill

struct StatusPill: View {
    let text: String
    var tone: Tone = .neutral
    var systemImage: String? = nil

    var body: some View {
        HStack(spacing: 4) {
            if let systemImage {
                Image(systemName: systemImage).font(.caption2.weight(.bold))
            }
            Text(text)
                .font(.caption.weight(.semibold))
        }
        .foregroundStyle(tone.ink)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(tone.fill, in: Capsule())
    }
}

// MARK: - Section header

struct SectionHeader: View {
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.headline)
                .foregroundStyle(Theme.ink)
            if let subtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Empty state

struct EmptyStateView: View {
    let systemImage: String
    let title: String
    let message: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: Theme.Space.md) {
            Image(systemName: systemImage)
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(Theme.primary)
            Text(title)
                .font(.headline)
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
                .multilineTextAlignment(.center)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(QuietPrimaryButtonStyle())
                    .padding(.top, Theme.Space.xs)
            }
        }
        .padding(Theme.Space.xl)
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Primary button

struct QuietPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, Theme.Space.xl)
            .padding(.vertical, Theme.Space.md)
            .frame(minHeight: 44)
            .background(Theme.primary, in: RoundedRectangle(cornerRadius: Theme.controlRadius, style: .continuous))
            .opacity(configuration.isPressed ? 0.82 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

// MARK: - Screen scaffold

/// A calm scrolling screen with a serif large title and warm background.
struct ScreenScaffold<Content: View>: View {
    let title: String
    var subtitle: String? = nil
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.lg) {
                content
            }
            .padding(Theme.Space.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
    }
}
