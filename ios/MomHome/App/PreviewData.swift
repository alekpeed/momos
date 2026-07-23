import SwiftData
import SwiftUI

/// An in-memory, seeded container for SwiftUI previews.
@MainActor
enum PreviewData {
    static let container: ModelContainer = {
        let schema = Schema([
            Household.self, StorageLocation.self, StorageBin.self, InventoryItem.self,
            TaskProject.self, TaskRecord.self, CalendarEntry.self, Supplement.self,
            IdeaBoard.self, IdeaCard.self, HelperContact.self, HelpRequest.self,
            VaultRecord.self, AppSettings.self
        ])
        let container = try! ModelContainer(
            for: schema,
            configurations: ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
        )
        Seed.runIfNeeded(container.mainContext)
        return container
    }()
}
