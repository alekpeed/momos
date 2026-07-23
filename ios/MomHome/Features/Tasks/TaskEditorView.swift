import SwiftUI
import SwiftData

/// Add or edit a task. A nil `task` means "new".
struct TaskEditorView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \TaskRecord.createdAt, order: .reverse) private var allTasks: [TaskRecord]
    @Query private var projects: [TaskProject]

    let task: TaskRecord?

    @State private var title = ""
    @State private var detail = ""
    @State private var status: TaskStatus = .open
    @State private var effort: Effort = .medium
    @State private var starred = false
    @State private var needsHelp = false
    @State private var hasDueDate = false
    @State private var dueDate = Date.now
    @State private var projectId: String?
    @State private var dependencyIds: Set<String> = []
    @State private var tagText = ""

    private var isEditing: Bool { task != nil }

    var body: some View {
        Form {
            Section {
                TextField("What needs doing?", text: $title, axis: .vertical)
                    .font(.body)
                TextField("Notes (optional)", text: $detail, axis: .vertical)
                    .foregroundStyle(Theme.inkSecondary)
            }

            Section("Details") {
                Picker("Status", selection: $status) {
                    ForEach(TaskStatus.allCases) { Text($0.rawValue).tag($0) }
                }
                Picker("Effort", selection: $effort) {
                    ForEach(Effort.allCases) { Text($0.rawValue).tag($0) }
                }
                Toggle("Starred", isOn: $starred)
                Toggle("Needs a helper", isOn: $needsHelp)
            }

            Section("When") {
                Toggle("Has a due date", isOn: $hasDueDate.animation())
                if hasDueDate {
                    DatePicker("Due", selection: $dueDate, displayedComponents: .date)
                }
            }

            Section("Project") {
                Picker("Project", selection: $projectId) {
                    Text("None").tag(String?.none)
                    ForEach(projects) { p in Text(p.name).tag(String?.some(p.id)) }
                }
            }

            if !dependencyOptions.isEmpty {
                Section("Blocked by") {
                    ForEach(dependencyOptions) { option in
                        Button {
                            toggleDependency(option.id)
                        } label: {
                            HStack {
                                Text(option.title).foregroundStyle(Theme.ink)
                                Spacer()
                                if dependencyIds.contains(option.id) {
                                    Image(systemName: "checkmark").foregroundStyle(Theme.primary)
                                }
                            }
                        }
                    }
                }
            }

            Section("Tags") {
                TextField("Comma-separated tags", text: $tagText)
            }
        }
        .navigationTitle(isEditing ? "Edit task" : "New task")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { save() }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .onAppear(perform: load)
    }

    private var dependencyOptions: [TaskRecord] {
        allTasks.filter { $0.id != task?.id }
    }

    private func toggleDependency(_ id: String) {
        if dependencyIds.contains(id) { dependencyIds.remove(id) } else { dependencyIds.insert(id) }
    }

    private func load() {
        guard let task else { return }
        title = task.title
        detail = task.detail
        status = task.status
        effort = task.effort
        starred = task.starred
        needsHelp = task.needsHelp
        if let due = task.dueDate { hasDueDate = true; dueDate = due }
        projectId = task.projectId
        dependencyIds = Set(task.dependencyIds)
        tagText = task.tags.joined(separator: ", ")
    }

    private func save() {
        let tags = tagText.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        let target = task ?? TaskRecord(title: "")
        target.title = title.trimmingCharacters(in: .whitespaces)
        target.detail = detail
        target.status = status
        target.effort = effort
        target.starred = starred
        target.needsHelp = needsHelp
        target.dueDate = hasDueDate ? dueDate : nil
        target.projectId = projectId
        target.dependencyIds = Array(dependencyIds)
        target.tags = tags
        target.updatedAt = .now
        if task == nil { context.insert(target) }
        try? context.save()
        dismiss()
    }
}

#Preview {
    NavigationStack { TaskEditorView(task: nil) }
        .modelContainer(PreviewData.container)
}
