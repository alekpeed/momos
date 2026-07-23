import SwiftUI
import SwiftData

struct EnergyJournalView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \EnergyEntry.date, order: .reverse) private var entries: [EnergyEntry]
    @State private var showingAdd = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.md) {
                Text("A quiet, private note to yourself about how the day feels. Nobody else sees it.")
                    .font(.caption).foregroundStyle(Theme.inkSecondary)

                if entries.isEmpty {
                    EmptyStateView(systemImage: "waveform.path.ecg", title: "No entries yet", message: "Jot down how your energy is today.", actionTitle: "Log energy") { showingAdd = true }
                } else {
                    ForEach(entries) { entry in
                        Card {
                            VStack(alignment: .leading, spacing: Theme.Space.sm) {
                                HStack {
                                    EnergyDots(level: entry.level)
                                    Spacer()
                                    Text(entry.date.formatted(.dateTime.weekday().month().day()))
                                        .font(.caption).foregroundStyle(Theme.inkSecondary)
                                }
                                if !entry.note.isEmpty {
                                    Text(entry.note).font(.subheadline).foregroundStyle(Theme.ink)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                        .contextMenu {
                            Button(role: .destructive) { context.delete(entry); try? context.save() } label: { Label("Delete", systemImage: "trash") }
                        }
                    }
                }
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Energy journal")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showingAdd = true } label: { Image(systemName: "plus") }
                    .accessibilityLabel("Log energy")
            }
        }
        .sheet(isPresented: $showingAdd) { NavigationStack { EnergyEditor() } }
    }
}

struct EnergyDots: View {
    let level: Int
    var body: some View {
        HStack(spacing: 5) {
            ForEach(1...5, id: \.self) { i in
                Circle()
                    .fill(i <= level ? Theme.primary : Theme.surfaceMuted)
                    .frame(width: 12, height: 12)
            }
        }
        .accessibilityLabel("Energy \(level) of 5")
    }
}

struct EnergyEditor: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var level = 3
    @State private var note = ""

    private let labels = [1: "Drained", 2: "Low", 3: "Okay", 4: "Good", 5: "Great"]

    var body: some View {
        Form {
            Section("How's your energy?") {
                Picker("Level", selection: $level) {
                    ForEach(1...5, id: \.self) { i in Text(labels[i] ?? "\(i)").tag(i) }
                }
                .pickerStyle(.segmented)
                EnergyDots(level: level).frame(maxWidth: .infinity)
            }
            Section("Note (optional)") {
                TextField("Anything you want to remember", text: $note, axis: .vertical)
                    .lineLimit(3...6)
            }
        }
        .navigationTitle("Log energy")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    context.insert(EnergyEntry(level: level, note: note))
                    try? context.save(); dismiss()
                }
            }
        }
    }
}

#Preview {
    NavigationStack { EnergyJournalView() }
        .modelContainer(PreviewData.container)
}
