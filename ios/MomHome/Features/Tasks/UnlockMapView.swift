import SwiftUI
import SwiftData

/// The "Everything Map" — a readable dependency flowchart. It shows what's
/// ready, what's blocked, and which tasks unlock the most other work, so it's
/// clear where to start.
struct UnlockMapView: View {
    @Query(sort: \TaskRecord.createdAt, order: .reverse) private var tasks: [TaskRecord]

    private var doneIds: Set<String> { Set(tasks.filter { $0.status == .done }.map(\.id)) }
    private var active: [TaskRecord] { tasks.filter { $0.status != .done } }

    private func isBlocked(_ task: TaskRecord) -> Bool {
        task.dependencyIds.contains { !doneIds.contains($0) }
    }
    private var ready: [TaskRecord] { active.filter { !isBlocked($0) } }
    private var blocked: [TaskRecord] { active.filter { isBlocked($0) } }

    private struct Unlocker: Identifiable {
        let task: TaskRecord
        let unlocks: [TaskRecord]
        var id: String { task.id }
    }

    /// Active tasks each not-done task unlocks (i.e. tasks blocked by it).
    private var unlockers: [Unlocker] {
        active.compactMap { candidate in
            let unlocks = active.filter { $0.id != candidate.id && $0.dependencyIds.contains(candidate.id) }
            return unlocks.isEmpty ? nil : Unlocker(task: candidate, unlocks: unlocks)
        }
        .sorted { $0.unlocks.count > $1.unlocks.count }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.lg) {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: Theme.Space.md) {
                    summary("Active", active.count, .primary)
                    summary("Ready", ready.count, .good)
                    summary("Blocked", blocked.count, .warning)
                }

                if active.isEmpty {
                    EmptyStateView(systemImage: "point.3.connected.trianglepath.dotted", title: "Nothing active", message: "When you add tasks with prerequisites, this map shows what unlocks what.")
                }

                if !unlockers.isEmpty {
                    SectionHeader(title: "Start here", subtitle: "These unlock the most other tasks")
                    ForEach(unlockers) { row in
                        Card {
                            VStack(alignment: .leading, spacing: Theme.Space.sm) {
                                HStack {
                                    Text(row.task.title).font(.body.weight(.semibold)).foregroundStyle(Theme.ink)
                                    Spacer()
                                    StatusPill(text: "unlocks \(row.unlocks.count)", tone: .primary, systemImage: "arrow.up.forward")
                                }
                                ForEach(row.unlocks, id: \.id) { unlocked in
                                    HStack(spacing: 8) {
                                        Image(systemName: "arrow.turn.down.right").font(.caption).foregroundStyle(Theme.inkTertiary)
                                        Text(unlocked.title).font(.subheadline).foregroundStyle(Theme.inkSecondary)
                                    }
                                }
                            }
                        }
                    }
                }

                if !blocked.isEmpty {
                    SectionHeader(title: "Waiting on something")
                    ForEach(blocked, id: \.id) { task in
                        let blockers = tasks.filter { task.dependencyIds.contains($0.id) && $0.status != .done }
                        Card {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(task.title).font(.body.weight(.medium)).foregroundStyle(Theme.ink)
                                Text("Blocked until: \(blockers.map(\.title).joined(separator: ", "))")
                                    .font(.caption).foregroundStyle(Theme.warning)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Task map")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func summary(_ label: String, _ count: Int, _ tone: Tone) -> some View {
        Card(padding: Theme.Space.md) {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(count)")
                    .font(.system(.title, design: .serif).weight(.semibold))
                    .foregroundStyle(tone.ink)
                Text(label).font(.caption).foregroundStyle(Theme.inkSecondary)
            }
        }
    }
}

#Preview {
    NavigationStack { UnlockMapView() }
        .modelContainer(PreviewData.container)
}
