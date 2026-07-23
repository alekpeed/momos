import SwiftUI
import SwiftData
import UIKit

struct HelpView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \HelpRequest.createdAt, order: .reverse) private var requests: [HelpRequest]
    @Query private var contacts: [HelperContact]
    @State private var showingNewRequest = false
    @State private var showingNewContact = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.lg) {
                // Clear, always-visible boundary: this is not emergency dispatch.
                Card {
                    Label {
                        Text("This is not 911 or Emergency SOS. It sends a message to the helpers you choose.")
                            .font(.caption).foregroundStyle(Theme.inkSecondary)
                    } icon: {
                        Image(systemName: "info.circle").foregroundStyle(Theme.primary)
                    }
                }

                SectionHeader(title: "Help requests")
                if requests.isEmpty {
                    Card { Text("No open requests.").font(.subheadline).foregroundStyle(Theme.inkSecondary) }
                } else {
                    ForEach(requests) { request in
                        HelpRequestCard(request: request, contact: contacts.first { $0.id == request.contactId }) {
                            request.status = .resolved; request.updatedAt = .now; try? context.save()
                        }
                        .explains("A help request", "Copy it, send it as a text or email, or mark it resolved. This is never 911.")
                    }
                }
                Button { showingNewRequest = true } label: { Label("Ask for help", systemImage: "hand.raised").frame(maxWidth: .infinity) }
                    .buttonStyle(QuietPrimaryButtonStyle())
                    .explains("Ask for help", "Write what you need and send it to a helper by text or email — already worded for you.")

                SectionHeader(title: "Helper contacts")
                if contacts.isEmpty {
                    Card { Text("Add the people who can help.").font(.subheadline).foregroundStyle(Theme.inkSecondary) }
                } else {
                    ForEach(contacts) { c in
                        Card {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(c.name).font(.body.weight(.medium)).foregroundStyle(Theme.ink)
                                    Text([c.relationship, c.phone].filter { !$0.isEmpty }.joined(separator: " · "))
                                        .font(.caption).foregroundStyle(Theme.inkSecondary)
                                }
                                Spacer()
                            }
                        }
                        .explains("A helper", "Someone who can help. Their phone and email are used when you send a request.")
                    }
                }
                Button { showingNewContact = true } label: { Label("Add a helper", systemImage: "person.badge.plus") }
                    .buttonStyle(.bordered).tint(Theme.primary)
                    .explains("Add a helper", "Save someone (like a son or neighbor) so you can reach them in one tap.")
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Help & alerts")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingNewRequest) { NavigationStack { HelpRequestEditor(contacts: contacts) } }
        .sheet(isPresented: $showingNewContact) { NavigationStack { HelperContactEditor() } }
    }
}

private struct HelpRequestCard: View {
    let request: HelpRequest
    let contact: HelperContact?
    let resolve: () -> Void

    private var messageBody: String {
        var parts = [request.title]
        if !request.detail.isEmpty { parts.append(request.detail) }
        if request.urgency == .urgent { parts.insert("Please help when you can — this is a little urgent (not an emergency).", at: 0) }
        return parts.joined(separator: "\n")
    }
    private var smsURL: URL? {
        // Strip phone formatting so the sms: URI is valid, and use the standard body param.
        let phone = (contact?.phone ?? "").filter { $0.isNumber || $0 == "+" }
        let body = messageBody.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return URL(string: "sms:\(phone)?body=\(body)")
    }
    private var mailURL: URL? {
        let to = contact?.email ?? ""
        let subject = request.title.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let body = messageBody.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return URL(string: "mailto:\(to)?subject=\(subject)&body=\(body)")
    }

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Space.sm) {
                HStack {
                    Text(request.title).font(.body.weight(.medium)).foregroundStyle(Theme.ink)
                    Spacer()
                    if request.urgency == .urgent { StatusPill(text: "Urgent", tone: .critical) }
                    StatusPill(text: request.status.rawValue, tone: request.status == .open ? .primary : .good)
                }
                if !request.detail.isEmpty { Text(request.detail).font(.subheadline).foregroundStyle(Theme.inkSecondary) }
                if let contact { Text("To \(contact.name)").font(.caption).foregroundStyle(Theme.inkTertiary) }
                if request.status == .open {
                    FlowRow(spacing: Theme.Space.sm) {
                        Button { UIPasteboard.general.string = messageBody } label: { StatusPill(text: "Copy", tone: .neutral, systemImage: "doc.on.doc") }
                        if let smsURL { Link(destination: smsURL) { StatusPill(text: "Text", tone: .primary, systemImage: "message") } }
                        if let mailURL { Link(destination: mailURL) { StatusPill(text: "Email", tone: .lavender, systemImage: "envelope") } }
                        Button(action: resolve) { StatusPill(text: "Resolve", tone: .good, systemImage: "checkmark") }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

struct HelpRequestEditor: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    let contacts: [HelperContact]
    @State private var title = ""
    @State private var detail = ""
    @State private var urgency: HelpUrgency = .normal
    @State private var contactId: String?

    var body: some View {
        Form {
            Section { TextField("What do you need help with?", text: $title, axis: .vertical) }
            Section { TextField("Details (optional)", text: $detail, axis: .vertical) }
            Section {
                Picker("Urgency", selection: $urgency) { ForEach(HelpUrgency.allCases) { Text($0.rawValue).tag($0) } }
                if urgency == .urgent {
                    Text("Urgent still sends a normal message to your helpers. It is not 911.")
                        .font(.caption).foregroundStyle(Theme.warning)
                }
            }
            Section("Send to") {
                Picker("Helper", selection: $contactId) {
                    Text("Choose later").tag(String?.none)
                    ForEach(contacts) { Text($0.name).tag(String?.some($0.id)) }
                }
            }
        }
        .navigationTitle("Ask for help")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    context.insert(HelpRequest(title: title.trimmingCharacters(in: .whitespaces), detail: detail, urgency: urgency, contactId: contactId))
                    try? context.save(); dismiss()
                }.disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }
}

struct HelperContactEditor: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var relationship = ""
    var body: some View {
        Form {
            TextField("Name", text: $name)
            TextField("Phone", text: $phone).keyboardType(.phonePad)
            TextField("Email", text: $email).textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.emailAddress)
            TextField("Relationship (e.g. Son)", text: $relationship)
        }
        .navigationTitle("New helper")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    context.insert(HelperContact(name: name.trimmingCharacters(in: .whitespaces), phone: phone, email: email, relationship: relationship))
                    try? context.save(); dismiss()
                }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }
}

#Preview {
    NavigationStack { HelpView() }
        .modelContainer(PreviewData.container)
}
