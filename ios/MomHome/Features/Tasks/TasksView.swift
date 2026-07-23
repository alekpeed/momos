import SwiftUI
import SwiftData

struct TasksView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \TaskRecord.createdAt, order: .reverse) private var tasks: [TaskRecord]
    @Query private var projects: [TaskProject]

    enum Filter: String, CaseIterable, Identifiable {
        case open = "Open", nextUp = "Next up", today = "Today", starred = "Starred"
        case quick = "Quick wins", help = "Help", all = "All"
        var id: String { rawValue }
    }
    @State private var filter: Filter = .open
    @State private var editingTask: TaskRecord?
    @State private var showingNew = false

    private var doneIds: Set<String> { Set(tasks.filter { $0.status == .done }.map(\.id)) }

    private func isBlocked(_ task: TaskRecord) -> Bool {
        task.dependencyIds.contains { !doneIds.contains($0) }
    }
    private func blockers(_ task: TaskRecord) -> [TaskRecord] {
        tasks.filter { task.dependencyIds.contains($0.id) && $0.status != .done }
    }

    private var filtered: [TaskRecord] {
        let cal = Calendar.current
        switch filter {
        case .open:    return tasks.filter { $0.status != .done }
        case .nextUp:  return tasks.filter { $0.status == .open && !isBlocked($0) }
        case .today:   return tasks.filter { t in t.status != .done && (t.dueDate.map { cal.isDateInToday($0) } ?? false) }
        case .starred: return tasks.filter { $0.starred && $0.status != .done }
        case .quick:   return tasks.filter { $0.status == .open && $0.effort.isQuick }
        case .help:    return tasks.filter { $0.needsHelp && $0.status != .done }
        case .all:     return tasks
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.lg) {
                HStack(spacing: Theme.Space.sm) {
                    NavigationLink { UnlockMapView() } label: { navPill("Task map", "point.3.connected.trianglepath.dotted") }
                        .buttonStyle(.plain)
                    NavigationLink { ProjectsView() } label: { navPill("Projects", "folder") }
                        .buttonStyle(.plain)
                }
                filterChips
                if filtered.isEmpty {
                    EmptyStateView(
                        systemImage: "checklist",
                        title: "Nothing here yet",
                        message: emptyMessage,
                        actionTitle: "Add a task"
                    ) { showingNew = true }
                } else {
                    ForEach(filtered) { task in
                        TaskCard(
                            task: task,
                            project: projects.first { $0.id == task.projectId },
                            blocked: isBlocked(task),
                            blockers: blockers(task),
                            toggleDone: { toggleDone(task) },
                            toggleStar: { task.starred.toggle(); save() }
                        )
                        .onTapGesture { editingTask = task }
                    }
                }
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Tasks")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showingNew = true } label: { Image(systemName: "plus") }
                    .accessibilityLabel("Add a task")
            }
        }
        .sheet(isPresented: $showingNew) {
            NavigationStack { TaskEditorView(task: nil) }
        }
        .sheet(item: $editingTask) { task in
            NavigationStack { TaskEditorView(task: task) }
        }
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Space.sm) {
                ForEach(Filter.allCases) { option in
                    let active = option == filter
                    Button {
                        withAnimation(.easeOut(duration: 0.15)) { filter = option }
                    } label: {
                        Text(option.rawValue)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(active ? .white : Theme.inkSecondary)
                            .padding(.horizontal, Theme.Space.lg)
                            .padding(.vertical, Theme.Space.sm)
                            .background(active ? Theme.primary : Theme.surfaceMuted, in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 2)
        }
    }

    private func navPill(_ title: String, _ icon: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon).font(.caption)
            Text(title).font(.subheadline.weight(.semibold))
        }
        .foregroundStyle(Theme.primary)
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.Space.sm + 2)
        .background(Theme.primary.opacity(0.10), in: RoundedRectangle(cornerRadius: Theme.controlRadius, style: .continuous))
    }

    private var emptyMessage: String {
        switch filter {
        case .quick: return "No quick wins right now. Add a small, low-effort task and it will show up here."
        case .help:  return "No tasks are waiting on a helper."
        default:     return "Add your first task to start organizing the day."
        }
    }

    private func toggleDone(_ task: TaskRecord) {
        task.status = task.status == .done ? .open : .done
        task.updatedAt = .now
        save()
    }
    private func save() { try? context.save() }
}

private struct TaskCard: View {
    let task: TaskRecord
    let project: TaskProject?
    let blocked: Bool
    let blockers: [TaskRecord]
    let toggleDone: () -> Void
    let toggleStar: () -> Void

    var body: some View {
        Card {
            HStack(alignment: .top, spacing: Theme.Space.md) {
                Button(action: toggleDone) {
                    Image(systemName: task.status == .done ? "checkmark.circle.fill" : "circle")
                        .font(.title2)
                        .foregroundStyle(task.status == .done ? Theme.good : Theme.primary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(task.status == .done ? "Mark \(task.title) not done" : "Mark \(task.title) done")

                VStack(alignment: .leading, spacing: Theme.Space.sm) {
                    Text(task.title)
                        .font(.body.weight(.medium))
                        .foregroundStyle(Theme.ink)
                        .strikethrough(task.status == .done, color: Theme.inkTertiary)
                        .fixedSize(horizontal: false, vertical: true)

                    if !task.detail.isEmpty {
                        Text(task.detail).font(.subheadline).foregroundStyle(Theme.inkSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    // Wrapping metadata row — nothing critical hidden behind ellipses.
                    FlowRow(spacing: Theme.Space.xs) {
                        if let due = task.dueDate {
                            StatusPill(text: due.formatted(.dateTime.month().day()), tone: .neutral, systemImage: "calendar")
                        }
                        StatusPill(text: task.effort.rawValue, tone: task.effort.isQuick ? .good : .neutral)
                        if let project { StatusPill(text: project.name, tone: .lavender, systemImage: "folder") }
                        if task.needsHelp { StatusPill(text: "Needs a hand", tone: .warning, systemImage: "hand.raised") }
                        if task.status == .waiting { StatusPill(text: "Waiting", tone: .warning) }
                        ForEach(task.tags, id: \.self) { tag in StatusPill(text: tag, tone: .neutral) }
                    }

                    if blocked {
                        Text("Blocked until: \(blockers.map(\.title).joined(separator: ", "))")
                            .font(.caption)
                            .foregroundStyle(Theme.warning)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 0)
                Button(action: toggleStar) {
                    Image(systemName: task.starred ? "star.fill" : "star")
                        .foregroundStyle(task.starred ? Theme.gold : Theme.inkTertiary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(task.starred ? "Unstar \(task.title)" : "Star \(task.title)")
            }
        }
    }
}

#Preview {
    NavigationStack { TasksView() }
        .modelContainer(PreviewData.container)
}
