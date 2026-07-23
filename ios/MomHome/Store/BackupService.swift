import Foundation
import SwiftData

/// A full, portable JSON snapshot of the household. Mirrors the web app's
/// export/import so backups stay a first-class, local-first feature.
///
/// Vault records are included as ciphertext + salt only — never plaintext — so
/// a backup is safe to move between devices without exposing private notes.
struct BackupSnapshot: Codable {
    var version = 2
    var exportedAt = Date.now
    var householdName = "Our Home"

    var items: [ItemDTO] = []
    var locations: [LocationDTO] = []
    var bins: [BinDTO] = []
    var orders: [OrderDTO] = []
    var purchases: [PurchaseDTO] = []
    var projects: [ProjectDTO] = []
    var tasks: [TaskDTO] = []
    var calendar: [CalendarDTO] = []
    var supplements: [SupplementDTO] = []
    var ideaBoards: [BoardDTO] = []
    var ideaCards: [CardDTO] = []
    var helperContacts: [ContactDTO] = []
    var helpRequests: [RequestDTO] = []
    var vaultRecords: [VaultDTO] = []
    var energyEntries: [EnergyDTO] = []

    struct ItemDTO: Codable { var id, name, category, quantityStatus: String; var locationId, binId: String?; var lowStockThreshold, quantity: Int; var preferredStore, replacementURL: String; var photo: Data? }
    struct LocationDTO: Codable { var id, name, note: String; var sortIndex: Int }
    struct BinDTO: Codable { var id, name, containerCode: String; var locationId: String?; var note: String }
    struct OrderDTO: Codable { var id, name: String; var itemId: String?; var status: String; var quantity: Int; var store: String; var expectedDate: Date? }
    struct PurchaseDTO: Codable { var id, productName: String; var itemId: String?; var storeName, totalPrice: String; var purchasedAt: Date; var notes, receiptText: String }
    struct ProjectDTO: Codable { var id, name, note, colorHex: String }
    struct TaskDTO: Codable { var id, title, detail, status, effort: String; var starred, needsHelp: Bool; var dueDate: Date?; var projectId: String?; var dependencyIds, tags: [String] }
    struct CalendarDTO: Codable { var id, title: String; var date: Date; var allDay: Bool; var startTime, endTime, repeatRule: String; var repeatUntil: Date?; var colorHex: String; var linkedTaskId: String?; var reminderEnabled: Bool }
    struct SupplementDTO: Codable { var id, name, instructions: String; var remainingCount, lowThreshold: Int; var lastTaken: Date? }
    struct BoardDTO: Codable { var id, name, note: String; var archived: Bool }
    struct CardDTO: Codable { var id, boardId, title, note, link, status: String; var favorite: Bool; var photo: Data? }
    struct ContactDTO: Codable { var id, name, phone, email, relationship: String }
    struct RequestDTO: Codable { var id, title, detail, urgency, status: String; var contactId: String? }
    struct VaultDTO: Codable { var id, title: String; var ciphertext, salt: Data }
    struct EnergyDTO: Codable { var id: String; var date: Date; var level: Int; var note: String }
}

@MainActor
enum BackupService {

    static func encoder() -> JSONEncoder {
        let e = JSONEncoder()
        e.outputFormatting = [.prettyPrinted, .sortedKeys]
        e.dateEncodingStrategy = .iso8601
        return e
    }
    static func decoder() -> JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }

    // MARK: Export

    static func snapshot(from context: ModelContext) -> BackupSnapshot {
        var snap = BackupSnapshot()
        snap.householdName = AppSettings.current(in: context).householdName
        snap.items = fetch(context).map { (i: InventoryItem) in BackupSnapshot.ItemDTO(id: i.id, name: i.name, category: i.category, quantityStatus: i.quantityStatus.rawValue, locationId: i.locationId, binId: i.binId, lowStockThreshold: i.lowStockThreshold, quantity: i.quantity, preferredStore: i.preferredStore, replacementURL: i.replacementURL, photo: i.photo) }
        snap.locations = fetch(context).map { (l: StorageLocation) in .init(id: l.id, name: l.name, note: l.note, sortIndex: l.sortIndex) }
        snap.bins = fetch(context).map { (b: StorageBin) in .init(id: b.id, name: b.name, containerCode: b.containerCode, locationId: b.locationId, note: b.note) }
        snap.orders = fetch(context).map { (o: Order) in .init(id: o.id, name: o.name, itemId: o.itemId, status: o.status.rawValue, quantity: o.quantity, store: o.store, expectedDate: o.expectedDate) }
        snap.purchases = fetch(context).map { (p: Purchase) in .init(id: p.id, productName: p.productName, itemId: p.itemId, storeName: p.storeName, totalPrice: p.totalPrice, purchasedAt: p.purchasedAt, notes: p.notes, receiptText: p.receiptText) }
        snap.projects = fetch(context).map { (p: TaskProject) in .init(id: p.id, name: p.name, note: p.note, colorHex: p.colorHex) }
        snap.tasks = fetch(context).map { (t: TaskRecord) in .init(id: t.id, title: t.title, detail: t.detail, status: t.status.rawValue, effort: t.effort.rawValue, starred: t.starred, needsHelp: t.needsHelp, dueDate: t.dueDate, projectId: t.projectId, dependencyIds: t.dependencyIds, tags: t.tags) }
        snap.calendar = fetch(context).map { (c: CalendarEntry) in .init(id: c.id, title: c.title, date: c.date, allDay: c.allDay, startTime: c.startTime, endTime: c.endTime, repeatRule: c.repeatRule.rawValue, repeatUntil: c.repeatUntil, colorHex: c.colorHex, linkedTaskId: c.linkedTaskId, reminderEnabled: c.reminderEnabled) }
        snap.supplements = fetch(context).map { (s: Supplement) in .init(id: s.id, name: s.name, instructions: s.instructions, remainingCount: s.remainingCount, lowThreshold: s.lowThreshold, lastTaken: s.lastTaken) }
        snap.ideaBoards = fetch(context).map { (b: IdeaBoard) in .init(id: b.id, name: b.name, note: b.note, archived: b.archived) }
        snap.ideaCards = fetch(context).map { (c: IdeaCard) in .init(id: c.id, boardId: c.boardId, title: c.title, note: c.note, link: c.link, status: c.status.rawValue, favorite: c.favorite, photo: c.photo) }
        snap.helperContacts = fetch(context).map { (c: HelperContact) in .init(id: c.id, name: c.name, phone: c.phone, email: c.email, relationship: c.relationship) }
        snap.helpRequests = fetch(context).map { (r: HelpRequest) in .init(id: r.id, title: r.title, detail: r.detail, urgency: r.urgency.rawValue, status: r.status.rawValue, contactId: r.contactId) }
        snap.vaultRecords = fetch(context).map { (v: VaultRecord) in .init(id: v.id, title: v.title, ciphertext: v.ciphertext, salt: v.salt) }
        snap.energyEntries = fetch(context).map { (e: EnergyEntry) in .init(id: e.id, date: e.date, level: e.level, note: e.note) }
        return snap
    }

    static func exportData(from context: ModelContext) throws -> Data {
        try encoder().encode(snapshot(from: context))
    }

    // MARK: Import

    /// Replaces all local data with the snapshot. The caller shows a preview first.
    static func restore(_ snap: BackupSnapshot, into context: ModelContext) {
        wipe(context)
        AppSettings.current(in: context).householdName = snap.householdName
        snap.locations.forEach { context.insert(StorageLocation(id: $0.id, name: $0.name, note: $0.note, sortIndex: $0.sortIndex)) }
        snap.bins.forEach { context.insert(StorageBin(id: $0.id, name: $0.name, containerCode: $0.containerCode, locationId: $0.locationId, note: $0.note)) }
        snap.items.forEach { context.insert(InventoryItem(id: $0.id, name: $0.name, category: $0.category, quantityStatus: QuantityStatus(rawValue: $0.quantityStatus) ?? .ok, locationId: $0.locationId, binId: $0.binId, lowStockThreshold: $0.lowStockThreshold, quantity: $0.quantity, preferredStore: $0.preferredStore, replacementURL: $0.replacementURL, photo: $0.photo)) }
        snap.orders.forEach { context.insert(Order(id: $0.id, name: $0.name, itemId: $0.itemId, status: OrderStatus(rawValue: $0.status) ?? .needed, quantity: $0.quantity, store: $0.store, expectedDate: $0.expectedDate)) }
        snap.purchases.forEach { context.insert(Purchase(id: $0.id, productName: $0.productName, itemId: $0.itemId, storeName: $0.storeName, totalPrice: $0.totalPrice, purchasedAt: $0.purchasedAt, notes: $0.notes, receiptText: $0.receiptText)) }
        snap.projects.forEach { context.insert(TaskProject(id: $0.id, name: $0.name, note: $0.note, colorHex: $0.colorHex)) }
        snap.tasks.forEach { context.insert(TaskRecord(id: $0.id, title: $0.title, detail: $0.detail, status: TaskStatus(rawValue: $0.status) ?? .open, effort: Effort(rawValue: $0.effort) ?? .medium, starred: $0.starred, needsHelp: $0.needsHelp, dueDate: $0.dueDate, projectId: $0.projectId, dependencyIds: $0.dependencyIds, tags: $0.tags)) }
        snap.calendar.forEach { context.insert(CalendarEntry(id: $0.id, title: $0.title, date: $0.date, allDay: $0.allDay, startTime: $0.startTime, endTime: $0.endTime, repeatRule: RepeatRule(rawValue: $0.repeatRule) ?? .never, repeatUntil: $0.repeatUntil, colorHex: $0.colorHex, linkedTaskId: $0.linkedTaskId, reminderEnabled: $0.reminderEnabled)) }
        snap.supplements.forEach { context.insert(Supplement(id: $0.id, name: $0.name, instructions: $0.instructions, remainingCount: $0.remainingCount, lowThreshold: $0.lowThreshold, lastTaken: $0.lastTaken)) }
        snap.ideaBoards.forEach { context.insert(IdeaBoard(id: $0.id, name: $0.name, note: $0.note, archived: $0.archived)) }
        snap.ideaCards.forEach { context.insert(IdeaCard(id: $0.id, boardId: $0.boardId, title: $0.title, note: $0.note, link: $0.link, status: IdeaStatus(rawValue: $0.status) ?? .saved, favorite: $0.favorite, photo: $0.photo)) }
        snap.helperContacts.forEach { context.insert(HelperContact(id: $0.id, name: $0.name, phone: $0.phone, email: $0.email, relationship: $0.relationship)) }
        snap.helpRequests.forEach { context.insert(HelpRequest(id: $0.id, title: $0.title, detail: $0.detail, urgency: HelpUrgency(rawValue: $0.urgency) ?? .normal, status: HelpStatus(rawValue: $0.status) ?? .open, contactId: $0.contactId)) }
        snap.vaultRecords.forEach { context.insert(VaultRecord(id: $0.id, title: $0.title, ciphertext: $0.ciphertext, salt: $0.salt)) }
        snap.energyEntries.forEach { context.insert(EnergyEntry(id: $0.id, date: $0.date, level: $0.level, note: $0.note)) }
        try? context.save()
    }

    // MARK: Helpers

    private static func fetch<T: PersistentModel>(_ context: ModelContext) -> [T] {
        (try? context.fetch(FetchDescriptor<T>())) ?? []
    }

    private static func wipe(_ context: ModelContext) {
        for item: InventoryItem in fetch(context) { context.delete(item) }
        for x: StorageLocation in fetch(context) { context.delete(x) }
        for x: StorageBin in fetch(context) { context.delete(x) }
        for x: Order in fetch(context) { context.delete(x) }
        for x: Purchase in fetch(context) { context.delete(x) }
        for x: TaskProject in fetch(context) { context.delete(x) }
        for x: TaskRecord in fetch(context) { context.delete(x) }
        for x: CalendarEntry in fetch(context) { context.delete(x) }
        for x: Supplement in fetch(context) { context.delete(x) }
        for x: IdeaBoard in fetch(context) { context.delete(x) }
        for x: IdeaCard in fetch(context) { context.delete(x) }
        for x: HelperContact in fetch(context) { context.delete(x) }
        for x: HelpRequest in fetch(context) { context.delete(x) }
        for x: VaultRecord in fetch(context) { context.delete(x) }
        for x: EnergyEntry in fetch(context) { context.delete(x) }
    }
}
