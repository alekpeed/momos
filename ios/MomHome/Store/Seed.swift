import Foundation
import SwiftData

/// Seeds a gentle starter household the first time the app launches, so every
/// screen shows real, recognizable content instead of empty scaffolding.
@MainActor
enum Seed {
    static func runIfNeeded(_ context: ModelContext) {
        let settings = AppSettings.current(in: context)
        guard !settings.seeded else { return }

        let kitchen = StorageLocation(name: "Kitchen", note: "Pantry and cabinets", sortIndex: 0)
        let bath = StorageLocation(name: "Bathroom", note: "Medicine cabinet", sortIndex: 1)
        context.insert(kitchen)
        context.insert(bath)

        let pantryBin = StorageBin(name: "Pantry basket", containerCode: "BIN-PANTRY", locationId: kitchen.id)
        context.insert(pantryBin)

        context.insert(InventoryItem(name: "Paper towels", category: "Household", quantityStatus: .low, locationId: kitchen.id, binId: pantryBin.id, lowStockThreshold: 2, quantity: 1, preferredStore: "Costco"))
        context.insert(InventoryItem(name: "Coffee", category: "Kitchen", quantityStatus: .ok, locationId: kitchen.id, quantity: 2))
        context.insert(InventoryItem(name: "Hand soap", category: "Bathroom", quantityStatus: .out, locationId: bath.id, lowStockThreshold: 1, quantity: 0))

        let garden = TaskProject(name: "Spring garden", note: "Get the beds ready")
        context.insert(garden)

        let clearBeds = TaskRecord(title: "Clear the garden beds", effort: .medium, projectId: garden.id)
        context.insert(clearBeds)
        context.insert(TaskRecord(title: "Plant tomatoes", detail: "After the beds are clear", effort: .medium, projectId: garden.id, dependencyIds: [clearBeds.id]))
        context.insert(TaskRecord(title: "Call the pharmacy", status: .open, effort: .quick, starred: true, dueDate: .now))
        context.insert(TaskRecord(title: "Water the plants", effort: .quick))
        context.insert(TaskRecord(title: "Ask about the leaky faucet", effort: .medium, needsHelp: true))

        context.insert(CalendarEntry(title: "Trash night", date: .now, allDay: true, repeatRule: .weekly, reminderEnabled: true))
        context.insert(CalendarEntry(title: "Book club", date: Calendar.current.date(byAdding: .day, value: 3, to: .now) ?? .now, allDay: false, startTime: "18:30", endTime: "20:00"))

        context.insert(Order(name: "Paper towels", status: .needed, quantity: 2, store: "Costco"))
        context.insert(Order(name: "Furnace filter", status: .ordered, store: "Home Depot", expectedDate: Calendar.current.date(byAdding: .day, value: 2, to: .now)))
        context.insert(Purchase(productName: "Coffee beans", storeName: "Trader Joe's", totalPrice: "12.99", purchasedAt: Calendar.current.date(byAdding: .day, value: -5, to: .now) ?? .now))

        context.insert(Supplement(name: "Vitamin D", instructions: "1 in the morning with food", remainingCount: 12, lowThreshold: 7))
        context.insert(Supplement(name: "Fish oil", instructions: "1 with dinner", remainingCount: 40, lowThreshold: 10))

        let board = IdeaBoard(name: "Living room refresh", note: "Cozy and calm")
        context.insert(board)
        context.insert(IdeaCard(boardId: board.id, title: "Warm floor lamp", note: "Soft light for reading", link: "", status: .considering, favorite: true))
        context.insert(IdeaCard(boardId: board.id, title: "Wool throw blanket", status: .saved))

        context.insert(HelperContact(name: "Sam", phone: "(555) 201-8830", email: "sam@example.com", relationship: "Son"))

        context.insert(EnergyEntry(level: 4, note: "A short morning walk helped."))

        settings.householdName = "Our Home"
        settings.seeded = true
        try? context.save()
    }
}

extension AppSettings {
    /// Returns the single settings row, creating it if missing.
    @MainActor
    static func current(in context: ModelContext) -> AppSettings {
        let descriptor = FetchDescriptor<AppSettings>()
        if let existing = try? context.fetch(descriptor).first {
            return existing
        }
        let created = AppSettings()
        context.insert(created)
        return created
    }
}
