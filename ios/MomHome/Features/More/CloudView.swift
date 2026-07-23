import SwiftUI
import UIKit

/// The "Cloud" screen under More. Accounts, one household, and shared access with
/// a helper. Everything here is optional — MomOS works fully without it. Data
/// sync and photo upload are the next increment; this screen says so plainly
/// rather than implying more than is wired.
struct CloudView: View {
    @Environment(CloudSession.self) private var session: CloudSession?

    var body: some View {
        Group {
            if let session {
                content(session)
            } else {
                ScreenScaffold(title: "Cloud") {
                    Text("Cloud isn't available in this preview.")
                        .foregroundStyle(Theme.inkSecondary)
                }
            }
        }
    }

    @ViewBuilder
    private func content(_ session: CloudSession) -> some View {
        if !session.isConfigured {
            ScreenScaffold(title: "Cloud") { notConfiguredCard }
        } else if !session.isSignedIn {
            ScreenScaffold(title: "Cloud") { AuthCard() }
        } else {
            SignedInView(session: session)
        }
    }

    private var notConfiguredCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Space.md) {
                Label("Cloud isn't turned on yet", systemImage: "icloud.slash")
                    .font(.headline).foregroundStyle(Theme.ink)
                Text("MomOS is working fully on this phone right now. Cloud adds an account, syncing across devices, and letting a helper share the household.")
                    .foregroundStyle(Theme.inkSecondary)
                Text("To switch it on, the app needs its Firebase config file added to the project. The steps are in docs/firebase-setup.md.")
                    .font(.callout).foregroundStyle(Theme.inkSecondary)
            }
        }
        .explains("Cloud", "Optional online backup and sharing. It's off until the Firebase setup is finished.")
    }
}

// MARK: - Sign in / create account

private struct AuthCard: View {
    @Environment(CloudSession.self) private var session: CloudSession?
    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var errorMessage: String?
    @State private var isBusy = false

    enum Mode: String, CaseIterable { case signIn = "Sign in", createAccount = "Create account" }

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Space.md) {
                Picker("", selection: $mode) {
                    ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .explains("Sign in or create account", "Switch between signing into an existing account and making a new one.")

                if mode == .createAccount {
                    field("Your name", text: $name, icon: "person")
                }
                field("Email", text: $email, icon: "envelope", keyboard: .emailAddress)
                secureField("Password", text: $password)

                if let errorMessage {
                    Text(errorMessage).font(.callout).foregroundStyle(Theme.critical)
                }

                Button {
                    submit()
                } label: {
                    HStack {
                        if isBusy { ProgressView().tint(.white) }
                        Text(mode.rawValue)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(QuietPrimaryButtonStyle())
                .disabled(isBusy)
                .explains(mode.rawValue, "Sends your email and password to your private cloud account. Nothing is shared with anyone.")
            }
        }
    }

    private func submit() {
        guard let session else { return }
        errorMessage = nil
        isBusy = true
        Task {
            do {
                let user: CloudUser
                switch mode {
                case .signIn:
                    user = try await CloudBackend.signIn(email: email, password: password)
                case .createAccount:
                    user = try await CloudBackend.signUp(email: email, password: password, name: name)
                }
                await session.setSignedIn(user)
            } catch {
                errorMessage = error.localizedDescription
            }
            isBusy = false
        }
    }

    private func field(_ title: String, text: Binding<String>, icon: String, keyboard: UIKeyboardType = .default) -> some View {
        HStack {
            Image(systemName: icon).foregroundStyle(Theme.inkSecondary).frame(width: 22)
            TextField(title, text: text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(keyboard)
        }
        .padding(Theme.Space.md)
        .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: Theme.controlRadius))
    }

    private func secureField(_ title: String, text: Binding<String>) -> some View {
        HStack {
            Image(systemName: "lock").foregroundStyle(Theme.inkSecondary).frame(width: 22)
            SecureField(title, text: text)
        }
        .padding(Theme.Space.md)
        .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: Theme.controlRadius))
    }
}

// MARK: - Signed in

private struct SignedInView: View {
    let session: CloudSession
    @State private var members: [MemberSummary] = []
    @State private var invites: [InviteSummary] = []
    @State private var audit: [AuditEntry] = []
    @State private var newHouseholdName = ""
    @State private var joinCode = ""
    @State private var inviteRole: CloudRole = .helper
    @State private var errorMessage: String?
    @State private var isBusy = false

    var body: some View {
        ScreenScaffold(title: "Cloud") {
            accountCard
            householdCard
            if let household = session.activeHousehold {
                sharingCard(household)
                membersCard
                activityCard
            }
            footerNote
            if let errorMessage {
                Text(errorMessage).font(.callout).foregroundStyle(Theme.critical)
            }
        }
        .task(id: session.activeHouseholdId) { await reload() }
    }

    // MARK: Account

    private var accountCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Space.sm) {
                Label("Signed in", systemImage: "person.crop.circle").font(.headline).foregroundStyle(Theme.ink)
                Text(session.currentUser?.email ?? "").foregroundStyle(Theme.inkSecondary)
                Button(role: .destructive) {
                    session.signOut()
                } label: {
                    Text("Sign out")
                }
                .explains("Sign out", "Signs this account out on this phone. Your data on the phone stays put.")
            }
        }
    }

    // MARK: Household

    @ViewBuilder
    private var householdCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Space.md) {
                Label("Household", systemImage: "house").font(.headline).foregroundStyle(Theme.ink)
                if let household = session.activeHousehold {
                    HStack {
                        Text(household.name).foregroundStyle(Theme.ink)
                        Spacer()
                        roleBadge(household.myRole)
                    }
                    if session.households.count > 1 {
                        Picker("Active household", selection: Binding(
                            get: { session.activeHouseholdId ?? household.id },
                            set: { session.activeHouseholdId = $0 }
                        )) {
                            ForEach(session.households) { Text($0.name).tag($0.id as String?) }
                        }
                    }
                } else {
                    Text("Create a household to sync it and share it with a helper.")
                        .foregroundStyle(Theme.inkSecondary)
                    TextField("Household name", text: $newHouseholdName)
                        .padding(Theme.Space.md)
                        .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: Theme.controlRadius))
                    Button {
                        run { _ = try await CloudBackend.createHousehold(name: newHouseholdName)
                              await session.refreshHouseholds(); newHouseholdName = "" }
                    } label: {
                        Text("Create household").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(QuietPrimaryButtonStyle())
                    .disabled(isBusy)
                    .explains("Create household", "Makes a shared household in the cloud. You become its owner.")
                }
            }
        }
    }

    // MARK: Sharing

    private func sharingCard(_ household: HouseholdSummary) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Space.md) {
                Label("Shared access", systemImage: "person.2").font(.headline).foregroundStyle(Theme.ink)

                // Anyone can join another household with a code.
                Text("Have a code from someone else? Enter it to join their household.")
                    .font(.callout).foregroundStyle(Theme.inkSecondary)
                HStack {
                    TextField("Invite code", text: $joinCode)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .padding(Theme.Space.md)
                        .background(Theme.surfaceMuted, in: RoundedRectangle(cornerRadius: Theme.controlRadius))
                    Button("Join") {
                        run { _ = try await CloudBackend.joinByCode(joinCode)
                              await session.refreshHouseholds(); joinCode = ""; await reload() }
                    }
                    .disabled(isBusy || joinCode.isEmpty)
                }
                .explains("Join with a code", "Type a code a family member gave you to share their household.")

                if household.isOwner {
                    Divider().overlay(Theme.hairline)
                    Text("Invite a helper").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.ink)
                    Picker("Role", selection: $inviteRole) {
                        ForEach(CloudRole.allCases) { Text($0.title).tag($0) }
                    }
                    .pickerStyle(.inline)
                    Button {
                        run { _ = try await CloudBackend.createInvite(hid: household.id, role: inviteRole)
                              invites = try await CloudBackend.listInvites(hid: household.id) }
                    } label: {
                        Text("Create invite code").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(QuietPrimaryButtonStyle())
                    .disabled(isBusy)
                    .explains("Create invite code", "Makes a one-week code you can text to a helper so they can join.")

                    ForEach(invites.filter { $0.isActive }) { invite in
                        inviteRow(invite, hid: household.id)
                    }
                }
            }
        }
    }

    private func inviteRow(_ invite: InviteSummary, hid: String) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(invite.code).font(.system(.body, design: .monospaced)).foregroundStyle(Theme.ink)
                Text("\(invite.role.capitalized) · expires \(invite.expiresAt.formatted(date: .abbreviated, time: .omitted))")
                    .font(.caption).foregroundStyle(Theme.inkSecondary)
            }
            Spacer()
            Button {
                run { try await CloudBackend.revokeInvite(hid: hid, code: invite.code)
                      invites = try await CloudBackend.listInvites(hid: hid) }
            } label: {
                Image(systemName: "trash").foregroundStyle(Theme.critical)
            }
            .accessibilityLabel("Turn off invite \(invite.code)")
        }
        .padding(.vertical, 4)
    }

    // MARK: Members

    private var membersCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Space.sm) {
                Label("People", systemImage: "person.3").font(.headline).foregroundStyle(Theme.ink)
                if members.isEmpty {
                    Text("Just you, for now.").foregroundStyle(Theme.inkSecondary)
                } else {
                    ForEach(members) { member in
                        HStack {
                            Text(member.email ?? String(member.id.prefix(6)))
                                .foregroundStyle(Theme.ink)
                            Spacer()
                            roleBadge(member.role)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
    }

    // MARK: Activity

    private var activityCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Space.sm) {
                Label("Recent activity", systemImage: "list.bullet.rectangle").font(.headline).foregroundStyle(Theme.ink)
                if audit.isEmpty {
                    Text("Nothing yet.").foregroundStyle(Theme.inkSecondary)
                } else {
                    ForEach(audit) { entry in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(actionLabel(entry.action)).foregroundStyle(Theme.ink)
                            Text(entry.createdAt.formatted(date: .abbreviated, time: .shortened))
                                .font(.caption).foregroundStyle(Theme.inkSecondary)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .explains("Recent activity", "A running log of cloud actions — who created, joined, or shared, and when.")
    }

    private var footerNote: some View {
        Text("Right now cloud handles your account, this household, and sharing. Syncing your items and photos to the cloud is the next step being built.")
            .font(.caption).foregroundStyle(Theme.inkSecondary)
    }

    // MARK: Helpers

    private func roleBadge(_ role: String) -> some View {
        Text(role.capitalized)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10).padding(.vertical, 4)
            .background(Theme.surfaceMuted, in: Capsule())
            .foregroundStyle(Theme.inkSecondary)
    }

    private func actionLabel(_ action: String) -> String {
        switch action {
        case "create_household": return "Created the household"
        case "join_household": return "Someone joined"
        case "create_invite": return "Made an invite code"
        case "revoke_invite": return "Turned off an invite"
        case "remove_member": return "Removed a person"
        default: return action.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    private func reload() async {
        guard let household = session.activeHousehold else {
            members = []; invites = []; audit = []
            return
        }
        do {
            members = try await CloudBackend.listMembers(hid: household.id)
            audit = try await CloudBackend.listAudit(hid: household.id)
            if household.isOwner {
                invites = try await CloudBackend.listInvites(hid: household.id)
            } else {
                invites = []
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func run(_ work: @escaping () async throws -> Void) {
        errorMessage = nil
        isBusy = true
        Task {
            do { try await work() } catch { errorMessage = error.localizedDescription }
            isBusy = false
        }
    }
}

#Preview {
    NavigationStack { CloudView() }
        .environment(CloudSession())
        .environment(ExplainMode())
}
