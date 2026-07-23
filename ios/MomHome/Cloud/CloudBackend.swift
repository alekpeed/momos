import Foundation
#if canImport(FirebaseAuth)
import FirebaseAuth
import FirebaseFirestore
#endif

/// The one place that talks to Firebase Auth + Firestore.
///
/// Every method is `nonisolated` and returns only `Sendable` value types, so the
/// non-`Sendable` Firebase objects never cross an actor boundary — that keeps the
/// whole thing clean under Swift 6 strict concurrency. Callers (the `@MainActor`
/// `CloudSession`) just `await` these and store the plain results.
///
/// Scope today: accounts, one household per person, invite codes, membership, and
/// the append-only audit log. Per-record data sync and photo upload are the next
/// increment and are intentionally not here yet.
enum CloudBackend {

    // MARK: - Guards

    private static func ensureConfigured() throws {
        guard FirebaseBootstrap.isConfigured else { throw CloudError.notConfigured }
    }

    #if canImport(FirebaseAuth)
    private static func requireUid() throws -> String {
        try ensureConfigured()
        guard let user = Auth.auth().currentUser else { throw CloudError.notSignedIn }
        return user.uid
    }

    private static var db: Firestore { Firestore.firestore() }
    #endif

    // MARK: - Auth

    static func currentUser() -> CloudUser? {
        #if canImport(FirebaseAuth)
        guard FirebaseBootstrap.isConfigured, let user = Auth.auth().currentUser else { return nil }
        return CloudUser(uid: user.uid, email: user.email ?? "")
        #else
        return nil
        #endif
    }

    static func signUp(email: String, password: String, name: String) async throws -> CloudUser {
        #if canImport(FirebaseAuth)
        try ensureConfigured()
        let result = try await Auth.auth().createUser(withEmail: email, password: password)
        let uid = result.user.uid
        let display = name.trimmingCharacters(in: .whitespacesAndNewlines)
        try await db.collection("users").document(uid).setData(
            ["name": display.isEmpty ? email : display], merge: true
        )
        return CloudUser(uid: uid, email: email)
        #else
        throw CloudError.notConfigured
        #endif
    }

    static func signIn(email: String, password: String) async throws -> CloudUser {
        #if canImport(FirebaseAuth)
        try ensureConfigured()
        let result = try await Auth.auth().signIn(withEmail: email, password: password)
        return CloudUser(uid: result.user.uid, email: result.user.email ?? email)
        #else
        throw CloudError.notConfigured
        #endif
    }

    static func signOut() throws {
        #if canImport(FirebaseAuth)
        try ensureConfigured()
        try Auth.auth().signOut()
        #else
        throw CloudError.notConfigured
        #endif
    }

    // MARK: - Households

    static func myHouseholds() async throws -> [HouseholdSummary] {
        #if canImport(FirebaseAuth)
        let uid = try requireUid()
        let userDoc = try await db.collection("users").document(uid).getDocument()
        let ids = (userDoc.data()?["householdIds"] as? [String]) ?? []
        var out: [HouseholdSummary] = []
        for hid in ids {
            let householdRef = db.collection("households").document(hid)
            let household = try await householdRef.getDocument()
            guard let data = household.data() else { continue }
            let member = try await householdRef.collection("members").document(uid).getDocument()
            out.append(HouseholdSummary(
                id: hid,
                name: data["name"] as? String ?? "Household",
                ownerId: data["ownerId"] as? String ?? "",
                myRole: member.data()?["role"] as? String ?? "viewer"
            ))
        }
        return out
        #else
        throw CloudError.notConfigured
        #endif
    }

    static func createHousehold(name: String) async throws -> HouseholdSummary {
        #if canImport(FirebaseAuth)
        let uid = try requireUid()
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { throw CloudError.emptyField("household name") }
        let ref = db.collection("households").document()
        let hid = ref.documentID
        try await ref.setData([
            "name": clean,
            "ownerId": uid,
            "createdAt": FieldValue.serverTimestamp()
        ])
        try await ref.collection("members").document(uid).setData([
            "role": "owner",
            "status": "active",
            "invitedBy": uid,
            "inviteToken": ""
        ])
        try await db.collection("users").document(uid).setData(
            ["householdIds": FieldValue.arrayUnion([hid])], merge: true
        )
        try await writeAudit(hid: hid, action: "create_household", detail: clean)
        return HouseholdSummary(id: hid, name: clean, ownerId: uid, myRole: "owner")
        #else
        throw CloudError.notConfigured
        #endif
    }

    // MARK: - Members

    static func listMembers(hid: String) async throws -> [MemberSummary] {
        #if canImport(FirebaseAuth)
        _ = try requireUid()
        let snap = try await db.collection("households").document(hid)
            .collection("members").getDocuments()
        return snap.documents.map { doc in
            MemberSummary(
                id: doc.documentID,
                role: doc.data()["role"] as? String ?? "viewer",
                status: doc.data()["status"] as? String ?? "",
                email: doc.data()["email"] as? String
            )
        }
        #else
        throw CloudError.notConfigured
        #endif
    }

    static func removeMember(hid: String, uid: String) async throws {
        #if canImport(FirebaseAuth)
        _ = try requireUid()
        try await db.collection("households").document(hid)
            .collection("members").document(uid).delete()
        try await writeAudit(hid: hid, action: "remove_member", detail: uid)
        #else
        throw CloudError.notConfigured
        #endif
    }

    // MARK: - Invites

    static func createInvite(hid: String, role: CloudRole, ttlDays: Int = 7) async throws -> InviteSummary {
        #if canImport(FirebaseAuth)
        let uid = try requireUid()
        let code = makeCode()
        let expires = Date().addingTimeInterval(Double(ttlDays) * 86_400)
        try await db.collection("households").document(hid)
            .collection("invites").document(code).setData([
                "code": code,
                "role": role.rawValue,
                "email": "",
                "status": "pending",
                "expiresAt": Timestamp(date: expires),
                "createdBy": uid,
                "createdAt": FieldValue.serverTimestamp()
            ])
        try await writeAudit(hid: hid, action: "create_invite", detail: role.rawValue)
        return InviteSummary(id: code, role: role.rawValue, expiresAt: expires, status: "pending")
        #else
        throw CloudError.notConfigured
        #endif
    }

    static func listInvites(hid: String) async throws -> [InviteSummary] {
        #if canImport(FirebaseAuth)
        _ = try requireUid()
        let snap = try await db.collection("households").document(hid)
            .collection("invites").getDocuments()
        return snap.documents.map { doc in
            InviteSummary(
                id: doc.documentID,
                role: doc.data()["role"] as? String ?? "viewer",
                expiresAt: (doc.data()["expiresAt"] as? Timestamp)?.dateValue() ?? .distantPast,
                status: doc.data()["status"] as? String ?? ""
            )
        }
        #else
        throw CloudError.notConfigured
        #endif
    }

    static func revokeInvite(hid: String, code: String) async throws {
        #if canImport(FirebaseAuth)
        _ = try requireUid()
        try await db.collection("households").document(hid)
            .collection("invites").document(code).setData(["status": "revoked"], merge: true)
        try await writeAudit(hid: hid, action: "revoke_invite", detail: code)
        #else
        throw CloudError.notConfigured
        #endif
    }

    /// Join a household by pasting an invite code. Finds the invite across all
    /// households, validates it, writes this user's membership, and records it.
    static func joinByCode(_ rawCode: String) async throws -> HouseholdSummary {
        #if canImport(FirebaseAuth)
        let uid = try requireUid()
        let code = rawCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard !code.isEmpty else { throw CloudError.emptyField("invite code") }

        let matches = try await db.collectionGroup("invites")
            .whereField("code", isEqualTo: code).limit(to: 1).getDocuments()
        guard let inviteDoc = matches.documents.first else { throw CloudError.inviteNotFound }
        let data = inviteDoc.data()
        let status = data["status"] as? String ?? ""
        let role = data["role"] as? String ?? "viewer"
        let expires = (data["expiresAt"] as? Timestamp)?.dateValue() ?? .distantPast
        guard status == "pending" else { throw CloudError.inviteUsed }
        guard expires > Date() else { throw CloudError.inviteExpired }
        guard let householdRef = inviteDoc.reference.parent.parent else { throw CloudError.inviteNotFound }
        let hid = householdRef.documentID

        try await householdRef.collection("members").document(uid).setData([
            "role": role,
            "status": "active",
            "invitedBy": data["createdBy"] as? String ?? "",
            "inviteToken": inviteDoc.documentID
        ])
        try await db.collection("users").document(uid).setData(
            ["householdIds": FieldValue.arrayUnion([hid])], merge: true
        )
        try await writeAudit(hid: hid, action: "join_household", detail: role)

        let household = try await householdRef.getDocument()
        return HouseholdSummary(
            id: hid,
            name: household.data()?["name"] as? String ?? "Household",
            ownerId: household.data()?["ownerId"] as? String ?? "",
            myRole: role
        )
        #else
        throw CloudError.notConfigured
        #endif
    }

    // MARK: - Audit log

    static func writeAudit(hid: String, action: String, detail: String) async throws {
        #if canImport(FirebaseAuth)
        guard let uid = Auth.auth().currentUser?.uid else { return }
        try await db.collection("households").document(hid)
            .collection("audit").addDocument(data: [
                "userId": uid,
                "action": action,
                "detail": detail,
                "createdAt": FieldValue.serverTimestamp()
            ])
        #endif
    }

    static func listAudit(hid: String, limit: Int = 100) async throws -> [AuditEntry] {
        #if canImport(FirebaseAuth)
        _ = try requireUid()
        let snap = try await db.collection("households").document(hid)
            .collection("audit")
            .order(by: "createdAt", descending: true)
            .limit(to: limit)
            .getDocuments()
        return snap.documents.map { doc in
            AuditEntry(
                id: doc.documentID,
                userId: doc.data()["userId"] as? String ?? "",
                action: doc.data()["action"] as? String ?? "",
                detail: doc.data()["detail"] as? String ?? "",
                createdAt: (doc.data()["createdAt"] as? Timestamp)?.dateValue() ?? .distantPast
            )
        }
        #else
        throw CloudError.notConfigured
        #endif
    }

    // MARK: - Helpers

    /// Human-friendly code: no 0/O/1/I to avoid confusion when read aloud.
    private static func makeCode(length: Int = 8) -> String {
        let alphabet = Array("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
        var generator = SystemRandomNumberGenerator()
        return String((0..<length).map { _ in
            alphabet[Int.random(in: 0..<alphabet.count, using: &generator)]
        })
    }
}
