import SwiftUI

/// A short, calm first-run welcome. Shown once.
struct OnboardingView: View {
    var onDone: () -> Void
    @State private var page = 0

    private struct Slide: Identifiable {
        let id = Int()
        let icon: String
        let title: String
        let body: String
    }
    private let slides = [
        Slide(icon: "house", title: "Welcome to MomOS",
              body: "A calm place to keep the household organized — what to do, what to buy, what to remember."),
        Slide(icon: "sun.max", title: "Start with Today",
              body: "Today shows a few gentle signals and quick wins. Tap the colored tiles to see what needs a hand."),
        Slide(icon: "lock.shield", title: "Yours, on this device",
              body: "Everything stays on your iPhone. The private vault is encrypted, and nothing is shared unless you choose to.")
    ]

    var body: some View {
        VStack(spacing: Theme.Space.xl) {
            TabView(selection: $page) {
                ForEach(slides.indices, id: \.self) { index in
                    let slide = slides[index]
                    VStack(spacing: Theme.Space.lg) {
                        Image(systemName: slide.icon)
                            .font(.system(size: 64, weight: .light))
                            .foregroundStyle(Theme.primary)
                        Text(slide.title)
                            .font(.system(.title, design: .serif).weight(.semibold))
                            .foregroundStyle(Theme.ink)
                            .multilineTextAlignment(.center)
                        Text(slide.body)
                            .font(.body)
                            .foregroundStyle(Theme.inkSecondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, Theme.Space.lg)
                    }
                    .padding(Theme.Space.xl)
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))

            Button(page == slides.count - 1 ? "Get started" : "Next") {
                if page == slides.count - 1 { onDone() }
                else { withAnimation { page += 1 } }
            }
            .buttonStyle(QuietPrimaryButtonStyle())
            .padding(.horizontal, Theme.Space.xl)
            .padding(.bottom, Theme.Space.xl)
        }
        .background(Theme.background.ignoresSafeArea())
    }
}

#Preview {
    OnboardingView(onDone: {})
}
