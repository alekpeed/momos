import SwiftUI
import SwiftData

@main
struct MomHomeApp: App {
    let container: ModelContainer

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
                .onAppear {
                    // onAppear runs on the MainActor, so it can touch mainContext directly.
                    Seed.runIfNeeded(container.mainContext)
                }
        }
        .modelContainer(container)
    }
}
