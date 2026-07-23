import SwiftUI
import SwiftData

@main
struct MomHomeApp: App {
    let container: ModelContainer
    @State private var explain = ExplainMode()
    @State private var cloud = CloudSession()

    init() {
        let schema = Schema([
            Household.self,
            StorageLocation.self,
            StorageBin.self,
            InventoryItem.self,
            Order.self,
            Purchase.self,
            TaskProject.self,
            TaskRecord.self,
            CalendarEntry.self,
            Supplement.self,
            IdeaBoard.self,
            IdeaCard.self,
            HelperContact.self,
            HelpRequest.self,
            VaultRecord.self,
            EnergyEntry.self,
            AppSettings.self
        ])
        do {
            container = try ModelContainer(for: schema, configurations: ModelConfiguration(schema: schema, isStoredInMemoryOnly: false))
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .tint(Theme.primary)
                .environment(explain)
                .environment(cloud)
                .onAppear {
                    // onAppear runs on the MainActor, so it can touch mainContext directly.
                    Seed.runIfNeeded(container.mainContext)
                    Task { await NotificationService.shared.reschedule(from: container.mainContext) }
                    Task { await cloud.bootstrap() }
                }
        }
        .modelContainer(container)
    }
}
