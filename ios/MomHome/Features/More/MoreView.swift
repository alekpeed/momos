import SwiftUI
import SwiftData

struct MoreView: View {
    @Query private var settingsRows: [AppSettings]
    private var householdName: String { settingsRows.first?.householdName ?? "Our Home" }

    var body: some View {
        List {
            Section("Household") {
                row("Supplements", "pills", .gold) { SupplementsView() }
                row("Help & alerts", "hand.raised", .clay) { HelpView() }
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
                staticRow("Cloud protection", "icloud", "Local-first — cloud sync is a later step")
                staticRow("Backup & restore", "arrow.down.doc", "Export/import a full JSON backup")
                staticRow("User manual", "book", "How Mom Home works")
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

    private func row<Destination: View>(_ title: String, _ icon: String, _ tint: Color, @ViewBuilder destination: @escaping () -> Destination) -> some View {
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
