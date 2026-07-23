import SwiftUI
import SwiftData
import UserNotifications

struct SettingsView: View {
    @Environment(\.modelContext) private var context
    @Environment(ExplainMode.self) private var explain
    @Query private var settingsRows: [AppSettings]
    @State private var reminderStatus: UNAuthorizationStatus = .notDetermined

    private var settings: AppSettings? { settingsRows.first }

    var body: some View {
        Form {
            Section("Guided help") {
                Toggle("Explain mode", isOn: Binding(get: { explain.isOn }, set: { explain.isOn = $0 }))
                Text("When this is on, tapping anything shows what it does — and nothing happens. A safe way to explore.")
                    .font(.caption).foregroundStyle(Theme.inkSecondary)
            }
            Section("Household") {
                if let settings {
                    TextField("Household name", text: Binding(
                        get: { settings.householdName },
                        set: { settings.householdName = $0; try? context.save() }
                    ))
                }
            }
            Section("Reminders") {
                switch reminderStatus {
                case .authorized, .provisional, .ephemeral:
                    Label("Reminders are on", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(Theme.good)
                case .denied:
                    Text("Reminders are turned off in iOS Settings. Enable notifications for Mom Home to get them.")
                        .font(.subheadline).foregroundStyle(Theme.inkSecondary)
                default:
                    Button("Turn on reminders") { Task { await enableReminders() } }
                        .tint(Theme.primary)
                }
                if let settings {
                    Stepper("Reminder nag interval: \(settings.defaultNagIntervalMinutes) min",
                            value: Binding(
                                get: { settings.defaultNagIntervalMinutes },
                                set: { settings.defaultNagIntervalMinutes = $0; try? context.save() }
                            ),
                            in: 5...120, step: 5)
                }
                Text("Reminders fire on the day a task is due or an event is set, from this device.")
                    .font(.caption).foregroundStyle(Theme.inkSecondary)
            }
            Section("About") {
                LabeledContent("App", value: "Mom Home")
                LabeledContent("Version", value: "0.1.0")
                Text("Local-first household command center. Your data stays on this device unless you set up cloud protection.")
                    .font(.caption).foregroundStyle(Theme.inkSecondary)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .task { await refreshStatus() }
    }

    private func refreshStatus() async {
        reminderStatus = await NotificationService.shared.authorizationStatus()
    }

    private func enableReminders() async {
        _ = await NotificationService.shared.requestAuthorization()
        await NotificationService.shared.reschedule(from: context)
        await refreshStatus()
    }
}

struct ManualView: View {
    private struct Entry: Identifiable { let id = UUID(); let q: String; let a: String }
    private let entries: [Entry] = [
        .init(q: "What is Today for?", a: "Today is your calm starting point. It shows a few signals — what to do, buy, take, watch, and any help needed — plus quick wins and today's agenda."),
        .init(q: "How do tasks work?", a: "Add tasks with an effort size, star the important ones, and mark quick wins. A task can be blocked by another; Mom Home shows what needs to finish first."),
        .init(q: "How do I keep track of what I have?", a: "Inventory holds your items with a place, bin, photo, and on-hand status. When something runs low, it shows up on Today and in Low stock."),
        .init(q: "What are bins and QR labels?", a: "Group items into bins inside a place. Each bin has a QR label you can print — scanning it opens Mom Home to that bin."),
        .init(q: "How do I ask for help?", a: "Help & alerts lets you send a request to a helper by copy, text, or email. Urgent requests are still just messages — this is never 911."),
        .init(q: "Is my backup safe?", a: "Back up everything to a single JSON file you control. Restoring always shows a preview first and never replaces data silently."),
        .init(q: "What is the private vault?", a: "A place for private notes, encrypted on this device. It's kept separate from helpers, summaries, and reports. If you forget the passphrase, the notes cannot be recovered.")
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.md) {
                ForEach(entries) { entry in
                    Card {
                        VStack(alignment: .leading, spacing: Theme.Space.xs) {
                            Text(entry.q).font(.headline).foregroundStyle(Theme.ink)
                            Text(entry.a).font(.subheadline).foregroundStyle(Theme.inkSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("User manual")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationStack { SettingsView() }
        .modelContainer(PreviewData.container)
        .environment(ExplainMode())
}
