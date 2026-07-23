import SwiftUI
import SwiftData

struct SupplementsView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Supplement.name) private var supplements: [Supplement]
    @State private var showingAdd = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.md) {
                Text("This is a personal reference tracker, not medical advice.")
                    .font(.caption).foregroundStyle(Theme.inkSecondary)
                if supplements.isEmpty {
                    EmptyStateView(systemImage: "pills", title: "No supplements tracked", message: "Add one to keep an eye on the remaining count.", actionTitle: "Add supplement") { showingAdd = true }
                } else {
                    ForEach(supplements) { s in
                        Card {
                            VStack(alignment: .leading, spacing: Theme.Space.sm) {
                                HStack {
                                    Text(s.name).font(.headline).foregroundStyle(Theme.ink)
                                    Spacer()
                                    StatusPill(text: "\(s.remainingCount) left", tone: s.isLow ? .warning : .good)
                                }
                                if !s.instructions.isEmpty {
                                    Text(s.instructions).font(.subheadline).foregroundStyle(Theme.inkSecondary)
                                }
                                HStack(spacing: Theme.Space.md) {
                                    Button("Log 1 taken") { logTaken(s) }
                                        .buttonStyle(.bordered).tint(Theme.primary)
                                    if s.isLow { StatusPill(text: "Running low", tone: .warning, systemImage: "exclamationmark.triangle") }
                                }
                            }
                        }
                    }
                }
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Supplements")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .primaryAction) { Button { showingAdd = true } label: { Image(systemName: "plus") } } }
        .sheet(isPresented: $showingAdd) { NavigationStack { SupplementEditorView() } }
    }

    private func logTaken(_ s: Supplement) {
        s.remainingCount = max(0, s.remainingCount - 1)
        s.lastTaken = .now
        try? context.save()
    }
}

struct SupplementEditorView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var instructions = ""
    @State private var remaining = 30
    @State private var threshold = 7

    var body: some View {
        Form {
            TextField("Name", text: $name)
            TextField("Reference instructions (as you write them)", text: $instructions, axis: .vertical)
            Stepper("Remaining: \(remaining)", value: $remaining, in: 0...500)
            Stepper("Warn at: \(threshold)", value: $threshold, in: 0...100)
        }
        .navigationTitle("New supplement")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    context.insert(Supplement(name: name.trimmingCharacters(in: .whitespaces), instructions: instructions, remainingCount: remaining, lowThreshold: threshold))
                    try? context.save(); dismiss()
                }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }
}

#Preview {
    NavigationStack { SupplementsView() }
        .modelContainer(PreviewData.container)
}
