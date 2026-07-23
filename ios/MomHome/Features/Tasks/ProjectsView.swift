import SwiftUI
import SwiftData

struct ProjectsView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \TaskProject.name) private var projects: [TaskProject]
    @Query private var tasks: [TaskRecord]
    @State private var editing: TaskProject?
    @State private var showingNew = false

    private func counts(_ project: TaskProject) -> (open: Int, total: Int) {
        let mine = tasks.filter { $0.projectId == project.id }
        return (mine.filter { $0.status != .done }.count, mine.count)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.md) {
                if projects.isEmpty {
                    EmptyStateView(systemImage: "folder", title: "No projects yet", message: "Group related tasks into a project to see them together.", actionTitle: "New project") { showingNew = true }
                } else {
                    ForEach(projects) { project in
                        Card {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(project.name).font(.headline).foregroundStyle(Theme.ink)
                                    if !project.note.isEmpty {
                                        Text(project.note).font(.subheadline).foregroundStyle(Theme.inkSecondary)
                                    }
                                }
                                Spacer()
                                let c = counts(project)
                                StatusPill(text: "\(c.open) open · \(c.total)", tone: c.open == 0 ? .good : .primary)
                            }
                        }
                        .onTapGesture { editing = project }
                        .contextMenu {
                            Button { editing = project } label: { Label("Edit", systemImage: "pencil") }
                            Button(role: .destructive) { delete(project) } label: { Label("Delete", systemImage: "trash") }
                        }
                    }
                }
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Projects")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showingNew = true } label: { Image(systemName: "plus") }
                    .accessibilityLabel("New project")
            }
        }
        .sheet(isPresented: $showingNew) { NavigationStack { ProjectEditor(project: nil) } }
        .sheet(item: $editing) { project in NavigationStack { ProjectEditor(project: project) } }
    }

    /// Deleting a project unassigns its tasks (mirrors the web engine) — it never
    /// deletes the tasks themselves.
    private func delete(_ project: TaskProject) {
        for task in tasks where task.projectId == project.id {
            task.projectId = nil
            task.updatedAt = .now
        }
        context.delete(project)
        try? context.save()
    }
}

struct ProjectEditor: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    let project: TaskProject?
    @State private var name = ""
    @State private var note = ""

    var body: some View {
        Form {
            TextField("Project name", text: $name)
            TextField("Note (optional)", text: $note, axis: .vertical)
        }
        .navigationTitle(project == nil ? "New project" : "Edit project")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { save() }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .onAppear {
            if let project { name = project.name; note = project.note }
        }
    }

    private func save() {
        let target = project ?? TaskProject(name: "")
        target.name = name.trimmingCharacters(in: .whitespaces)
        target.note = note
        if project == nil { context.insert(target) }
        try? context.save()
        dismiss()
    }
}

#Preview {
    NavigationStack { ProjectsView() }
        .modelContainer(PreviewData.container)
}
