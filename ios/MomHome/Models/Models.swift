import Foundation
import SwiftData

// Cross-entity references use stored String ids (mirroring the local-first web
// model) rather than SwiftData relationships, so the household engine stays
// easy to import/export and reason about.

@Model
final class Household {
    @Attribute(.unique) var id: String
    var name: String
    var createdAt: Date

    init(id: String = UUID().uuidString, name: String, createdAt: Date = .now) {
        self.id = id
        self.name = name
        self.createdAt = createdAt
    }
}

@Model
final class StorageLocation {
    @Attribute(.unique) var id: String
    var name: String
    var note: String
    var sortIndex: Int

    init(id: String = UUID().uuidString, name: String, note: String = "", sortIndex: Int = 0) {
        self.id = id
        self.name = name
        self.note = note
        self.sortIndex = sortIndex
    }
}

@Model
final class StorageBin {
    @Attribute(.unique) var id: String
    var name: String
    var containerCode: String
    var locationId: String?
    var note: String

    init(id: String = UUID().uuidString, name: String, containerCode: String, locationId: String? = nil, note: String = "") {
        self.id = id
        self.name = name
        self.containerCode = containerCode
        self.locationId = locationId
        self.note = note
    }
}

@Model
final class InventoryItem {
    @Attribute(.unique) var id: String
    var name: String
    var category: String
    var quantityStatus: QuantityStatus
    var locationId: String?
    var binId: String?
    var lowStockThreshold: Int
    var quantity: Int
    var preferredStore: String
    var replacementURL: String
    @Attribute(.externalStorage) var photo: Data?
    var updatedAt: Date

    init(
        id: String = UUID().uuidString,
        name: String,
        category: String = "General",
        quantityStatus: QuantityStatus = .ok,
        locationId: String? = nil,
        binId: String? = nil,
        lowStockThreshold: Int = 1,
        quantity: Int = 1,
        preferredStore: String = "",
        replacementURL: String = "",
        photo: Data? = nil,
        updatedAt: Date = .now
    ) {
        self.id = id
        self.name = name
        self.category = category
        self.quantityStatus = quantityStatus
        self.locationId = locationId
        self.binId = binId
        self.lowStockThreshold = lowStockThreshold
        self.quantity = quantity
        self.preferredStore = preferredStore
        self.replacementURL = replacementURL
        self.photo = photo
        self.updatedAt = updatedAt
    }
}

@Model
final class Order {
    @Attribute(.unique) var id: String
    var name: String
    var itemId: String?
    var status: OrderStatus
    var quantity: Int
    var store: String
    var expectedDate: Date?
    var createdAt: Date
    var updatedAt: Date

    init(
        id: String = UUID().uuidString,
        name: String,
        itemId: String? = nil,
        status: OrderStatus = .needed,
        quantity: Int = 1,
        store: String = "",
        expectedDate: Date? = nil,
        createdAt: Date = .now,
        updatedAt: Date = .now
    ) {
        self.id = id
        self.name = name
        self.itemId = itemId
        self.status = status
        self.quantity = quantity
        self.store = store
        self.expectedDate = expectedDate
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

@Model
final class Purchase {
    @Attribute(.unique) var id: String
    var productName: String
    var itemId: String?
    var storeName: String
    var totalPrice: String
    var purchasedAt: Date
    var notes: String
    var receiptText: String

    init(
        id: String = UUID().uuidString,
        productName: String,
        itemId: String? = nil,
        storeName: String = "",
        totalPrice: String = "",
        purchasedAt: Date = .now,
        notes: String = "",
        receiptText: String = ""
    ) {
        self.id = id
        self.productName = productName
        self.itemId = itemId
        self.storeName = storeName
        self.totalPrice = totalPrice
        self.purchasedAt = purchasedAt
        self.notes = notes
        self.receiptText = receiptText
    }
}

@Model
final class TaskProject {
    @Attribute(.unique) var id: String
    var name: String
    var note: String
    var colorHex: String

    init(id: String = UUID().uuidString, name: String, note: String = "", colorHex: String = "4C7A6B") {
        self.id = id
        self.name = name
        self.note = note
        self.colorHex = colorHex
    }
}

@Model
final class TaskRecord {
    @Attribute(.unique) var id: String
    var title: String
    var detail: String
    var status: TaskStatus
    var effort: Effort
    var starred: Bool
    var needsHelp: Bool
    var dueDate: Date?
    var projectId: String?
    /// Ids of tasks that must be done before this one (blocked-by).
    var dependencyIds: [String]
    var tags: [String]
    var createdAt: Date
    var updatedAt: Date

    init(
        id: String = UUID().uuidString,
        title: String,
        detail: String = "",
        status: TaskStatus = .open,
        effort: Effort = .medium,
        starred: Bool = false,
        needsHelp: Bool = false,
        dueDate: Date? = nil,
        projectId: String? = nil,
        dependencyIds: [String] = [],
        tags: [String] = [],
        createdAt: Date = .now,
        updatedAt: Date = .now
    ) {
        self.id = id
        self.title = title
        self.detail = detail
        self.status = status
        self.effort = effort
        self.starred = starred
        self.needsHelp = needsHelp
        self.dueDate = dueDate
        self.projectId = projectId
        self.dependencyIds = dependencyIds
        self.tags = tags
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

@Model
final class CalendarEntry {
    @Attribute(.unique) var id: String
    var title: String
    var date: Date
    var allDay: Bool
    var startTime: String
    var endTime: String
    var repeatRule: RepeatRule
    var repeatUntil: Date?
    var colorHex: String
    var linkedTaskId: String?
    var reminderEnabled: Bool

    init(
        id: String = UUID().uuidString,
        title: String,
        date: Date,
        allDay: Bool = true,
        startTime: String = "",
        endTime: String = "",
        repeatRule: RepeatRule = .never,
        repeatUntil: Date? = nil,
        colorHex: String = "37685F",
        linkedTaskId: String? = nil,
        reminderEnabled: Bool = false
    ) {
        self.id = id
        self.title = title
        self.date = date
        self.allDay = allDay
        self.startTime = startTime
        self.endTime = endTime
        self.repeatRule = repeatRule
        self.repeatUntil = repeatUntil
        self.colorHex = colorHex
        self.linkedTaskId = linkedTaskId
        self.reminderEnabled = reminderEnabled
    }
}

@Model
final class Supplement {
    @Attribute(.unique) var id: String
    var name: String
    var instructions: String
    var remainingCount: Int
    var lowThreshold: Int
    var lastTaken: Date?

    init(
        id: String = UUID().uuidString,
        name: String,
        instructions: String = "",
        remainingCount: Int = 30,
        lowThreshold: Int = 7,
        lastTaken: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.instructions = instructions
        self.remainingCount = remainingCount
        self.lowThreshold = lowThreshold
        self.lastTaken = lastTaken
    }
    var isLow: Bool { remainingCount <= lowThreshold }
}

@Model
final class IdeaBoard {
    @Attribute(.unique) var id: String
    var name: String
    var note: String
    var archived: Bool
    var createdAt: Date

    init(id: String = UUID().uuidString, name: String, note: String = "", archived: Bool = false, createdAt: Date = .now) {
        self.id = id
        self.name = name
        self.note = note
        self.archived = archived
        self.createdAt = createdAt
    }
}

@Model
final class IdeaCard {
    @Attribute(.unique) var id: String
    var boardId: String
    var title: String
    var note: String
    var link: String
    var status: IdeaStatus
    var favorite: Bool
    @Attribute(.externalStorage) var photo: Data?
    var createdAt: Date

    init(
        id: String = UUID().uuidString,
        boardId: String,
        title: String,
        note: String = "",
        link: String = "",
        status: IdeaStatus = .saved,
        favorite: Bool = false,
        photo: Data? = nil,
        createdAt: Date = .now
    ) {
        self.id = id
        self.boardId = boardId
        self.title = title
        self.note = note
        self.link = link
        self.status = status
        self.favorite = favorite
        self.photo = photo
        self.createdAt = createdAt
    }
}

@Model
final class HelperContact {
    @Attribute(.unique) var id: String
    var name: String
    var phone: String
    var email: String
    var relationship: String

    init(id: String = UUID().uuidString, name: String, phone: String = "", email: String = "", relationship: String = "") {
        self.id = id
        self.name = name
        self.phone = phone
        self.email = email
        self.relationship = relationship
    }
}

@Model
final class HelpRequest {
    @Attribute(.unique) var id: String
    var title: String
    var detail: String
    var urgency: HelpUrgency
    var status: HelpStatus
    var contactId: String?
    var createdAt: Date
    var updatedAt: Date

    init(
        id: String = UUID().uuidString,
        title: String,
        detail: String = "",
        urgency: HelpUrgency = .normal,
        status: HelpStatus = .open,
        contactId: String? = nil,
        createdAt: Date = .now,
        updatedAt: Date = .now
    ) {
        self.id = id
        self.title = title
        self.detail = detail
        self.urgency = urgency
        self.status = status
        self.contactId = contactId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// A private, client-side encrypted note. Only ciphertext + the parameters
/// needed to decrypt are persisted — never the plaintext. Excluded by design
/// from helper handoff, summaries, and reports.
@Model
final class VaultRecord {
    @Attribute(.unique) var id: String
    var title: String
    /// AES-GCM combined box (nonce + ciphertext + tag).
    var ciphertext: Data
    /// Per-record random salt for PBKDF2 key derivation.
    var salt: Data
    var createdAt: Date
    var updatedAt: Date

    init(id: String = UUID().uuidString, title: String, ciphertext: Data, salt: Data, createdAt: Date = .now, updatedAt: Date = .now) {
        self.id = id
        self.title = title
        self.ciphertext = ciphertext
        self.salt = salt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

@Model
final class AppSettings {
    @Attribute(.unique) var id: String
    var householdName: String
    var seeded: Bool
    var defaultNagIntervalMinutes: Int
    var helperAlertDisclaimerAccepted: Bool

    init(
        id: String = "settings",
        householdName: String = "Our Home",
        seeded: Bool = false,
        defaultNagIntervalMinutes: Int = 15,
        helperAlertDisclaimerAccepted: Bool = false
    ) {
        self.id = id
        self.householdName = householdName
        self.seeded = seeded
        self.defaultNagIntervalMinutes = defaultNagIntervalMinutes
        self.helperAlertDisclaimerAccepted = helperAlertDisclaimerAccepted
    }
}
