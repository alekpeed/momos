import SwiftUI
import SwiftData
import UniformTypeIdentifiers

/// A document wrapper so the JSON backup exports through the native file sheet.
struct BackupDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws {
        data = configuration.file.regularFileContents ?? Data()
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}

struct BackupView: View {
    @Environment(\.modelContext) private var context

    @State private var exportDocument: BackupDocument?
    @State private var showingExporter = false
    @State private var showingImporter = false
    @State private var pending: BackupSnapshot?
    @State private var message = ""
    @State private var isError = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.lg) {
                Card {
                    VStack(alignment: .leading, spacing: Theme.Space.sm) {
                        Label("Local-first backups", systemImage: "externaldrive")
                            .font(.headline).foregroundStyle(Theme.ink)
                        Text("Save everything to a single JSON file you control, or restore from one. Private vault notes are included only as encrypted data.")
                            .font(.subheadline).foregroundStyle(Theme.inkSecondary)
                    }
                }

                Button { startExport() } label: {
                    Label("Download a backup", systemImage: "square.and.arrow.down").frame(maxWidth: .infinity)
                }
                .buttonStyle(QuietPrimaryButtonStyle())

                Button { showingImporter = true } label: {
                    Label("Restore from a backup", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(Theme.primary)

                if !message.isEmpty {
                    Text(message).font(.subheadline).foregroundStyle(isError ? Theme.critical : Theme.good)
                }
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Backup & restore")
        .navigationBarTitleDisplayMode(.inline)
        .fileExporter(isPresented: $showingExporter, document: exportDocument, contentType: .json, defaultFilename: exportFilename) { result in
            switch result {
            case .success: message = "Backup saved."; isError = false
            case .failure(let error): message = "Could not save: \(error.localizedDescription)"; isError = true
            }
        }
        .fileImporter(isPresented: $showingImporter, allowedContentTypes: [.json]) { result in
            handleImport(result)
        }
        .sheet(item: pendingBinding) { identified in
            NavigationStack {
                RestorePreview(
                    snapshot: identified.snapshot,
                    onConfirm: { confirmRestore(identified.snapshot) },
                    onCancel: { pending = nil }
                )
            }
        }
    }

    private let exportFilename = "momos-backup"

    // Bridge BackupSnapshot to an Identifiable sheet item.
    private var pendingBinding: Binding<IdentifiedSnapshot?> {
        Binding(
            get: { pending.map(IdentifiedSnapshot.init) },
            set: { if $0 == nil { pending = nil } }
        )
    }

    private func startExport() {
        do {
            let data = try BackupService.exportData(from: context)
            exportDocument = BackupDocument(data: data)
            showingExporter = true
        } catch {
            message = "Could not prepare the backup."; isError = true
        }
    }

    private func handleImport(_ result: Result<URL, Error>) {
        switch result {
        case .failure(let error):
            message = "Could not open the file: \(error.localizedDescription)"; isError = true
        case .success(let url):
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            do {
                let data = try Data(contentsOf: url)
                pending = try BackupService.decoder().decode(BackupSnapshot.self, from: data)
                message = ""
            } catch {
                message = "That file is not a valid MomOS backup."; isError = true
            }
        }
    }

    private func confirmRestore(_ snapshot: BackupSnapshot) {
        BackupService.restore(snapshot, into: context)
        pending = nil
        message = "Restored from backup."
        isError = false
    }
}

/// Small Identifiable box so a decoded snapshot can drive a `.sheet(item:)`.
private struct IdentifiedSnapshot: Identifiable {
    let id = UUID()
    let snapshot: BackupSnapshot
    init(_ snapshot: BackupSnapshot) { self.snapshot = snapshot }
}

struct RestorePreview: View {
    @Environment(\.dismiss) private var dismiss
    let snapshot: BackupSnapshot
    let onConfirm: () -> Void
    let onCancel: () -> Void

    private var counts: [(String, Int)] {
        // Built incrementally with an explicit type so the compiler doesn't have
        // to type-check one giant tuple-array literal (which times out).
        var rows: [(String, Int)] = []
        rows.append(("Items", snapshot.items.count))
        rows.append(("Places", snapshot.locations.count))
        rows.append(("Bins", snapshot.bins.count))
        rows.append(("Orders", snapshot.orders.count))
        rows.append(("Purchases", snapshot.purchases.count))
        rows.append(("Tasks", snapshot.tasks.count))
        rows.append(("Projects", snapshot.projects.count))
        rows.append(("Calendar", snapshot.calendar.count))
        rows.append(("Supplements", snapshot.supplements.count))
        rows.append(("Idea boards", snapshot.ideaBoards.count))
        rows.append(("Idea cards", snapshot.ideaCards.count))
        rows.append(("Helpers", snapshot.helperContacts.count))
        rows.append(("Help requests", snapshot.helpRequests.count))
        rows.append(("Vault notes", snapshot.vaultRecords.count))
        return rows.filter { $0.1 > 0 }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.lg) {
                Card {
                    VStack(alignment: .leading, spacing: Theme.Space.sm) {
                        Label("Review before restoring", systemImage: "exclamationmark.triangle")
                            .font(.headline).foregroundStyle(Theme.warning)
                        Text("Restoring replaces everything currently on this device with the backup below. This cannot be undone.")
                            .font(.subheadline).foregroundStyle(Theme.inkSecondary)
                        Text("From “\(snapshot.householdName)” · saved \(snapshot.exportedAt.formatted(.dateTime.month().day().year()))")
                            .font(.caption).foregroundStyle(Theme.inkTertiary)
                    }
                }
                Card {
                    VStack(spacing: Theme.Space.sm) {
                        ForEach(counts.indices, id: \.self) { index in
                            HStack {
                                Text(counts[index].0).font(.subheadline).foregroundStyle(Theme.ink)
                                Spacer()
                                Text("\(counts[index].1)").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.inkSecondary)
                                    .monospacedDigit()
                            }
                        }
                        if counts.isEmpty {
                            Text("This backup contains no records.").font(.subheadline).foregroundStyle(Theme.inkSecondary)
                        }
                    }
                }
                Button(role: .destructive) { onConfirm(); dismiss() } label: {
                    Label("Replace everything with this backup", systemImage: "arrow.down.circle").frame(maxWidth: .infinity)
                }
                .buttonStyle(QuietPrimaryButtonStyle())
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Restore preview")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { onCancel(); dismiss() } }
        }
    }
}

#Preview {
    NavigationStack { BackupView() }
        .modelContainer(PreviewData.container)
}
