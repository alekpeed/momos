import SwiftUI
import SwiftData

struct MoreView: View {
    var body: some View {
        List {
            Section {
                link("Search everything", "magnifyingglass",
                     "Find anything — tasks, items, ideas, purchases, and orders — in one place.",
                     SearchView())
            }
            Section("Household") {
                link("Orders & purchases", "cart",
                     "What to buy, and a record of what you've bought.", OrdersView())
                link("Places & bins", "map",
                     "Your rooms and the bins inside them, with printable QR labels.", PlacesView())
                link("Low stock", "exclamationmark.triangle",
                     "Everything running low or out, in one list.", LowStockView())
                link("Supplements", "pills",
                     "Track what you take and how much is left.", SupplementsView())
                link("Help & alerts", "hand.raised",
                     "Ask a helper for a hand by text or email.", HelpView())
            }
            Section("For you") {
                link("Calm", "leaf",
                     "A breathing minute and a small focus timer.", CalmView())
                link("Energy journal", "waveform.path.ecg",
                     "A private note about how the day feels.", EnergyJournalView())
            }
            Section("Private") {
                NavigationLink { VaultView() } label: {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Private vault").foregroundStyle(Theme.ink)
                            Text("Encrypted, separate from everything else").font(.caption).foregroundStyle(Theme.inkSecondary)
                        }
                    } icon: {
                        Image(systemName: "lock.shield").foregroundStyle(Theme.primary)
                    }
                }
                .explains("Private vault", "Encrypted notes only you can open, kept separate from everything else.")
            }
            Section("Data") {
                link("Backup & restore", "externaldrive",
                     "Save everything to a file, or restore from one — with a preview first.", BackupView())
                link("Cloud", "icloud",
                     "Optional account, sharing with a helper, and syncing across devices.", CloudView())
            }
            Section("Help") {
                link("User manual", "book",
                     "How MomOS works, in plain language.", ManualView())
                link("Settings", "gearshape",
                     "Your household name, reminders, and Explain mode.", SettingsView())
            }
            Section {
                Text("MomOS keeps your household organized on this device first. Nothing is sent anywhere unless you set up cloud protection.")
                    .font(.caption).foregroundStyle(Theme.inkSecondary)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("More")
    }

    private func link<Destination: View>(_ title: String, _ icon: String, _ explanation: String, _ destination: @autoclosure @escaping () -> Destination) -> some View {
        NavigationLink { destination() } label: {
            Label(title, systemImage: icon).foregroundStyle(Theme.ink)
        }
        .explains(title, explanation)
    }
}

#Preview {
    NavigationStack { MoreView() }
        .modelContainer(PreviewData.container)
        .environment(ExplainMode())
}
