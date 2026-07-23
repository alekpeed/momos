import SwiftUI
import SwiftData

/// The private, encrypted vault. Passphrase lives only in memory for the
/// session; only ciphertext is stored. Kept visually and conceptually separate
/// from helper/AI/report flows, and never casually accessible.
struct VaultView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \VaultRecord.updatedAt, order: .reverse) private var records: [VaultRecord]

    @State private var sessionPassphrase: String?
    @State private var passphraseField = ""
    @State private var errorMessage = ""
    @State private var revealed: [String: String] = [:]
    @State private var showingAdd = false

    private var isUnlocked: Bool { sessionPassphrase != nil }

    var body: some View {
        Group {
            if isUnlocked {
                unlockedList
            } else {
                lockedGate
            }
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Private vault")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isUnlocked {
                ToolbarItem(placement: .primaryAction) {
                    Button { showingAdd = true } label: { Image(systemName: "plus") }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button { lock() } label: { Label("Lock", systemImage: "lock.fill") }
                }
            }
        }
        .sheet(isPresented: $showingAdd) {
            NavigationStack {
                VaultNoteEditor { title, body in addNote(title: title, body: body) }
            }
        }
    }

    // MARK: Locked

    private var lockedGate: some View {
        ScrollView {
            VStack(spacing: Theme.Space.lg) {
                Image(systemName: "lock.shield")
                    .font(.system(size: 44, weight: .light))
                    .foregroundStyle(Theme.primary)
                    .padding(.top, Theme.Space.xxl)
                Text("This vault is private")
                    .font(.system(.title2, design: .serif).weight(.semibold))
                    .foregroundStyle(Theme.ink)
                Text("Notes here are encrypted on this device. They are never shared with helpers, summaries, or reports.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.inkSecondary)
                    .multilineTextAlignment(.center)

                Card {
                    VStack(alignment: .leading, spacing: Theme.Space.md) {
                        Text(records.isEmpty ? "Choose a passphrase" : "Enter your passphrase")
                            .font(.headline).foregroundStyle(Theme.ink)
                        SecureField("Passphrase (at least 8 characters)", text: $passphraseField)
                            .textFieldStyle(.roundedBorder)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        if !errorMessage.isEmpty {
                            Text(errorMessage).font(.caption).foregroundStyle(Theme.critical)
                        }
                        Button(records.isEmpty ? "Create vault" : "Unlock") { unlock() }
                            .buttonStyle(QuietPrimaryButtonStyle())
                            .frame(maxWidth: .infinity)
                            .disabled(passphraseField.count < 8)
                        Label("If you forget this passphrase, these notes cannot be recovered. There is no backdoor.", systemImage: "exclamationmark.triangle")
                            .font(.caption)
                            .foregroundStyle(Theme.warning)
                    }
                }
            }
            .padding(Theme.Space.lg)
        }
    }

    // MARK: Unlocked

    private var unlockedList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.lg) {
                if records.isEmpty {
                    EmptyStateView(
                        systemImage: "lock.doc",
                        title: "Vault unlocked",
                        message: "Add a private note. It will be encrypted before it is saved.",
                        actionTitle: "Add a note"
                    ) { showingAdd = true }
                } else {
                    ForEach(records) { record in
                        Card {
                            VStack(alignment: .leading, spacing: Theme.Space.sm) {
                                HStack {
                                    Text(record.title.isEmpty ? "Untitled note" : record.title)
                                        .font(.headline).foregroundStyle(Theme.ink)
                                    Spacer()
                                    StatusPill(text: "Encrypted", tone: .primary, systemImage: "lock.fill")
                                }
                                if let text = revealed[record.id] {
                                    Text(text)
                                        .font(.body).foregroundStyle(Theme.ink)
                                        .fixedSize(horizontal: false, vertical: true)
                                    Button("Hide") { revealed[record.id] = nil }
                                        .font(.subheadline).tint(Theme.primary)
                                } else {
                                    Text("••••••••••••")
                                        .font(.body).foregroundStyle(Theme.inkTertiary)
                                    Button("Reveal") { reveal(record) }
                                        .font(.subheadline).tint(Theme.primary)
                                }
                                Text("Updated \(record.updatedAt.formatted(.dateTime.month().day().hour().minute()))")
                                    .font(.caption).foregroundStyle(Theme.inkTertiary)
                            }
                        }
                        .contextMenu {
                            Button(role: .destructive) { delete(record) } label: { Label("Delete", systemImage: "trash") }
                        }
                    }
                }
            }
            .padding(Theme.Space.lg)
        }
    }

    // MARK: Actions

    private func unlock() {
        errorMessage = ""
        let candidate = passphraseField
        if let newest = records.first {
            // Validate against an existing record so a wrong passphrase is caught up front.
            do {
                _ = try VaultCrypto.decrypt(ciphertext: newest.ciphertext, salt: newest.salt, passphrase: candidate)
            } catch {
                errorMessage = "That passphrase does not match this vault."
                return
            }
        }
        sessionPassphrase = candidate
        passphraseField = ""
    }

    private func lock() {
        sessionPassphrase = nil
        revealed = [:]
        passphraseField = ""
    }

    private func reveal(_ record: VaultRecord) {
        guard let passphrase = sessionPassphrase else { return }
        do {
            revealed[record.id] = try VaultCrypto.decrypt(ciphertext: record.ciphertext, salt: record.salt, passphrase: passphrase)
        } catch {
            errorMessage = "Could not open this note."
        }
    }

    private func addNote(title: String, body: String) {
        guard let passphrase = sessionPassphrase else { return }
        do {
            let sealed = try VaultCrypto.encrypt(body, passphrase: passphrase)
            let record = VaultRecord(title: title, ciphertext: sealed.ciphertext, salt: sealed.salt)
            context.insert(record)
            try? context.save()
        } catch {
            errorMessage = "Could not save this note."
        }
    }

    private func delete(_ record: VaultRecord) {
        revealed[record.id] = nil
        context.delete(record)
        try? context.save()
    }
}

private struct VaultNoteEditor: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var noteBody = ""
    let onSave: (String, String) -> Void

    var body: some View {
        Form {
            Section("Label") {
                TextField("Note name (kept as a plain label)", text: $title)
            }
            Section("Private contents") {
                TextField("This text is encrypted before saving", text: $noteBody, axis: .vertical)
                    .lineLimit(4...12)
            }
        }
        .navigationTitle("New private note")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { onSave(title.trimmingCharacters(in: .whitespaces), noteBody); dismiss() }
                    .disabled(noteBody.isEmpty)
            }
        }
    }
}

#Preview {
    NavigationStack { VaultView() }
        .modelContainer(PreviewData.container)
}
