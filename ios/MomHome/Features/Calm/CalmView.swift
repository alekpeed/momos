import SwiftUI

/// A quiet screen: a breathing prompt and a simple Focus Season countdown for
/// one calm stretch of work. No accounts, no data — just a moment.
struct CalmView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let presets = [1, 5, 10, 25]
    @State private var totalMinutes = 5
    @State private var remaining = 5 * 60
    @State private var running = false
    @State private var breatheIn = false

    private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var finished: Bool { remaining == 0 }

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.Space.xl) {
                Text("Take a calm minute")
                    .font(.system(.title, design: .serif).weight(.semibold))
                    .foregroundStyle(Theme.ink)
                    .padding(.top, Theme.Space.lg)

                breathingCircle

                Text(finished ? "Nicely done." : (running ? "Breathe with the circle." : "When you're ready."))
                    .font(.subheadline)
                    .foregroundStyle(Theme.inkSecondary)
                    .animation(.easeInOut, value: running)

                controls

                if !running {
                    presetRow
                }
            }
            .padding(Theme.Space.lg)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Calm")
        .navigationBarTitleDisplayMode(.inline)
        .onReceive(ticker) { _ in tick() }
    }

    private var breathingCircle: some View {
        ZStack {
            Circle()
                .fill(Theme.primary.opacity(0.10))
                .frame(width: 240, height: 240)
            Circle()
                .stroke(Theme.gold.opacity(0.5), lineWidth: 2)
                .frame(width: 200, height: 200)
                .scaleEffect(running && !reduceMotion ? (breatheIn ? 1.12 : 0.86) : 1)
                .animation(reduceMotion ? nil : .easeInOut(duration: 4).repeatForever(autoreverses: true), value: breatheIn)
            Text(timeLabel)
                .font(.system(size: 44, weight: .light, design: .serif))
                .foregroundStyle(Theme.ink)
                .monospacedDigit()
                .contentTransition(.numericText())
        }
        .frame(height: 260)
    }

    private var controls: some View {
        HStack(spacing: Theme.Space.md) {
            Button(running ? "Pause" : (finished ? "Again" : "Begin")) {
                if finished { reset(); start() }
                else if running { running = false }
                else { start() }
            }
            .buttonStyle(QuietPrimaryButtonStyle())

            if remaining != totalMinutes * 60 || running {
                Button("Reset") { reset() }
                    .buttonStyle(.bordered)
                    .tint(Theme.primary)
            }
        }
    }

    private var presetRow: some View {
        HStack(spacing: Theme.Space.sm) {
            ForEach(presets, id: \.self) { m in
                let active = m == totalMinutes
                Button {
                    totalMinutes = m
                    remaining = m * 60
                } label: {
                    Text("\(m) min")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(active ? .white : Theme.inkSecondary)
                        .padding(.horizontal, Theme.Space.lg)
                        .padding(.vertical, Theme.Space.sm)
                        .background(active ? Theme.primary : Theme.surfaceMuted, in: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var timeLabel: String {
        String(format: "%d:%02d", remaining / 60, remaining % 60)
    }

    private func start() {
        if finished { reset() }
        running = true
        breatheIn = true
    }
    private func reset() {
        running = false
        remaining = totalMinutes * 60
    }
    private func tick() {
        guard running, remaining > 0 else { return }
        remaining -= 1
        if remaining == 0 { running = false }
    }
}

#Preview {
    NavigationStack { CalmView() }
}
