import SwiftUI

/// "Explain mode": a safe, guided state. When it's on, tapping a control shows a
/// friendly explanation of what it does — and the control does nothing. She can
/// explore the whole app without triggering anything or getting lost.
@MainActor
@Observable
final class ExplainMode {
    var isOn = false
    var current: Explanation?
}

struct Explanation: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let text: String
}

private struct Explainable: ViewModifier {
    // Optional so any view can use `.explains` without providing the object
    // (e.g. in Xcode previews); it simply does nothing when absent.
    @Environment(ExplainMode.self) private var mode: ExplainMode?
    let title: String
    let text: String

    func body(content: Content) -> some View {
        let on = mode?.isOn ?? false
        return content
            // While explaining, the real control ignores taps…
            .allowsHitTesting(!on)
            // …and a dashed overlay catches the tap to show the explanation instead.
            .overlay {
                if on {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(Theme.gold.opacity(0.85), style: StrokeStyle(lineWidth: 1.5, dash: [5, 3]))
                        .background(Theme.gold.opacity(0.07), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .onTapGesture { mode?.current = Explanation(title: title, text: text) }
                        .accessibilityLabel("What is \(title)?")
                        .accessibilityHint(text)
                }
            }
    }
}

extension View {
    /// Marks a control with a plain-language explanation shown in Explain mode.
    func explains(_ title: String, _ text: String) -> some View {
        modifier(Explainable(title: title, text: text))
    }
}

/// The banner shown across the top while Explain mode is on.
struct ExplainBanner: View {
    let onDone: () -> Void
    var body: some View {
        HStack(spacing: Theme.Space.sm) {
            Image(systemName: "hand.tap")
                .font(.subheadline.weight(.semibold))
            Text("Explain mode — tap anything to learn. Nothing will happen.")
                .font(.footnote.weight(.medium))
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 8)
            Button("Done", action: onDone)
                .font(.footnote.weight(.bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(.white.opacity(0.22), in: Capsule())
        }
        .foregroundStyle(.white)
        .padding(.horizontal, Theme.Space.lg)
        .padding(.vertical, Theme.Space.sm + 2)
        .frame(maxWidth: .infinity)
        .background(Theme.gold)
    }
}

/// The little card that answers "what does this do?"
struct ExplanationCard: View {
    let explanation: Explanation
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.md) {
            HStack(spacing: 10) {
                Image(systemName: "lightbulb")
                    .font(.title3)
                    .foregroundStyle(Theme.primary)
                Text(explanation.title)
                    .font(.system(.title3, design: .serif).weight(.semibold))
                    .foregroundStyle(Theme.ink)
            }
            Text(explanation.text)
                .font(.body)
                .foregroundStyle(Theme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            Button("Got it", action: onClose)
                .buttonStyle(QuietPrimaryButtonStyle())
                .frame(maxWidth: .infinity)
        }
        .padding(Theme.Space.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .presentationDetents([.height(260)])
        .presentationDragIndicator(.visible)
        .presentationBackground(Theme.background)
    }
}
