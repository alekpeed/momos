import Foundation

/// Plain, `Sendable` value types that cross from the Firebase layer (which runs
/// off the main actor) back to the UI. The Firebase SDK's own objects
/// (`User`, `DocumentSnapshot`, …) never leave `CloudBackend` — only these do.

struct CloudUser: Sendable, Equatable {
    let uid: String
    let email: String
}

struct HouseholdSummary: Sendable, Equatable, Identifiable {
    let id: String
    let name: String
    let ownerId: String
    /// "owner" | "helper" | "viewer"
    let myRole: String

    var isOwner: Bool { myRole == "owner" }
    var canEdit: Bool { myRole == "owner" || myRole == "helper" }
}

struct MemberSummary: Sendable, Equatable, Identifiable {
    /// Firebase auth uid.
    let id: String
    let role: String
    let status: String
    let email: String?
}

struct InviteSummary: Sendable, Equatable, Identifiable {
    /// The shareable code (also the document id).
    let id: String
    let role: String
    let expiresAt: Date
    let status: String

    var code: String { id }
    var isActive: Bool { status == "pending" && expiresAt > .now }
}

struct AuditEntry: Sendable, Equatable, Identifiable {
    let id: String
    let userId: String
    let action: String
    let detail: String
    let createdAt: Date
}

/// Roles a household member can hold. Owner is implicit (the creator); these are
/// the roles you can hand out with an invite.
enum CloudRole: String, CaseIterable, Sendable, Identifiable {
    case helper
    case viewer

    var id: String { rawValue }
    var title: String {
        switch self {
        case .helper: return "Helper — can add and change things"
        case .viewer: return "Viewer — can look, can't change"
        }
    }
}

enum CloudError: LocalizedError {
    case notConfigured
    case notSignedIn
    case inviteNotFound
    case inviteExpired
    case inviteUsed
    case emptyField(String)

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Cloud isn't set up on this build yet. Add GoogleService-Info.plist (see docs/firebase-setup.md)."
        case .notSignedIn:
            return "You need to be signed in first."
        case .inviteNotFound:
            return "That code didn't match any invitation."
        case .inviteExpired:
            return "That invitation has expired. Ask for a new code."
        case .inviteUsed:
            return "That invitation has already been used or was turned off."
        case .emptyField(let name):
            return "Please enter your \(name)."
        }
    }
}
