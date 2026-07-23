import SwiftUI
import SwiftData

struct MoreView: View {
    @Query private var settingsRows: [AppSettings]

    var body: some View {
        List {
            Section {
                link("Search everything", "magnifyingglass", SearchView())
            }
            Section("Household") {
                link("Orders & purchases", "cart", OrdersView())
                link("Places & bins", "map", PlacesView())
                link("Low stock", "exclamationmark.triangle", LowStockView())
                link("Supplements", "pills", SupplementsView())
                link("Help & alerts", "hand.raised", HelpView())
            }
            Section("For you") {
                link("Calm", "leaf", CalmView())
                link("Energy journal", "waveform.path.ecg", EnergyJournalView())
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
            }
            Section("Data") {
                link("Backup & restore", "externaldrive", BackupView())
                staticRow("Cloud protection", "icloud", "Local-first — cloud sync is a later step")
            }
            Section("Help") {
                link("User manual", "book", ManualView())
                link("Settings", "gearshape", SettingsView())
            }
            Section {
                Text("Mom Home keeps your household organized on this device first. Nothing is sent anywhere unless you set up cloud protection.")
                    .font(.caption).foregroundStyle(Theme.inkSecondary)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("More")
    }

    private func link<Destination: View>(_ title: String, _ icon: String, _ destination: @autoclosure @escaping () -> Destination) -> some View {
        NavigationLink { destination() } label: {
            Label(title, systemImage: icon).foregroundStyle(Theme.ink)
        }
    }

    private func staticRow(_ title: String, _ icon: String, _ subtitle: String) -> some View {
        Label {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).foregroundStyle(Theme.ink)
                Text(subtitle).font(.caption).foregroundStyle(Theme.inkSecondary)
            }
        } icon: { Image(systemName: icon).foregroundStyle(Theme.inkSecondary) }
    }
}

#Preview {
    NavigationStack { MoreView() }
        .modelContainer(PreviewData.container)
}
