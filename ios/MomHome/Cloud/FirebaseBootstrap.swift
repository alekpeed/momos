import Foundation
#if canImport(FirebaseCore)
import FirebaseCore
#endif

/// Configures Firebase only when a real `GoogleService-Info.plist` is present.
///
/// MomOS is local-first: the whole app works with no Firebase at all. Cloud is an
/// opt-in layer. Until someone drops the config file in (see
/// `docs/firebase-setup.md`), `configureIfPossible()` is a no-op and every cloud
/// call refuses cleanly instead of crashing. This is why the repo can build and
/// run green without any secret committed.
enum FirebaseBootstrap {
    /// Call once, early, on the main thread.
    static func configureIfPossible() {
        #if canImport(FirebaseCore)
        guard FirebaseApp.app() == nil else { return }
        guard Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else {
            return
        }
        FirebaseApp.configure()
        #endif
    }

    /// True once a Firebase app instance exists (config present and configured).
    static var isConfigured: Bool {
        #if canImport(FirebaseCore)
        return FirebaseApp.app() != nil
        #else
        return false
        #endif
    }
}
