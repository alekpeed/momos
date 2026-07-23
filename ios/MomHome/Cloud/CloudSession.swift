import Foundation
import Observation

/// App-wide, main-actor view of the cloud: who's signed in and which household is
/// active. Held once at the root and shared through the environment so any screen
/// can read cloud state without touching Firebase directly.
@MainActor
@Observable
final class CloudSession {
    var currentUser: CloudUser?
    var households: [HouseholdSummary] = []
    var activeHouseholdId: String?
    var isBusy = false

    var isConfigured: Bool { FirebaseBootstrap.isConfigured }
    var isSignedIn: Bool { currentUser != nil }

    var activeHousehold: HouseholdSummary? {
        if let id = activeHouseholdId, let match = households.first(where: { $0.id == id }) {
            return match
        }
        return households.first
    }

    /// Called once at launch. Configures Firebase if a config file is present,
    /// then loads any existing session.
    func bootstrap() async {
        FirebaseBootstrap.configureIfPossible()
        currentUser = CloudBackend.currentUser()
        await refreshHouseholds()
    }

    func refreshHouseholds() async {
        guard isSignedIn else {
            households = []
            activeHouseholdId = nil
            return
        }
        do {
            households = try await CloudBackend.myHouseholds()
            if activeHouseholdId == nil || !households.contains(where: { $0.id == activeHouseholdId }) {
                activeHouseholdId = households.first?.id
            }
        } catch {
            households = []
        }
    }

    func setSignedIn(_ user: CloudUser) async {
        currentUser = user
        await refreshHouseholds()
    }

    func signOut() {
        try? CloudBackend.signOut()
        currentUser = nil
        households = []
        activeHouseholdId = nil
    }
}
