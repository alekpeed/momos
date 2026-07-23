import Foundation
import SwiftUI

/// On-hand status for an inventory item. Mom-defined meaning stays intact;
/// these are only coarse buckets for the low-stock path.
enum QuantityStatus: String, Codable, CaseIterable, Identifiable {
    case plenty = "Plenty"
    case ok = "OK"
    case low = "Low"
    case out = "Out"
    var id: String { rawValue }

    var tone: Tone {
        switch self {
        case .plenty, .ok: return .good
        case .low:         return .warning
        case .out:         return .critical
        }
    }
    var needsAttention: Bool { self == .low || self == .out }
}

enum TaskStatus: String, Codable, CaseIterable, Identifiable {
    case open = "Open"
    case waiting = "Waiting"
    case done = "Done"
    var id: String { rawValue }

    var tone: Tone {
        switch self {
        case .open:    return .primary
        case .waiting: return .warning
        case .done:    return .good
        }
    }
}

enum Effort: String, Codable, CaseIterable, Identifiable {
    case quick = "Quick"
    case medium = "Medium"
    case big = "Big"
    var id: String { rawValue }
    /// A "quick win" is an open, low-effort task.
    var isQuick: Bool { self == .quick }
}

enum RepeatRule: String, Codable, CaseIterable, Identifiable {
    case never = "Never"
    case daily = "Daily"
    case weekly = "Weekly"
    case monthly = "Monthly"
    case yearly = "Yearly"
    var id: String { rawValue }
}

enum HelpUrgency: String, Codable, CaseIterable, Identifiable {
    case normal = "Normal"
    case urgent = "Urgent"
    var id: String { rawValue }
}

enum HelpStatus: String, Codable, CaseIterable, Identifiable {
    case open = "Open"
    case resolved = "Resolved"
    case cancelled = "Cancelled"
    var id: String { rawValue }
}

enum OrderStatus: String, Codable, CaseIterable, Identifiable {
    case needed = "Needed"
    case ordered = "Ordered"
    case received = "Received"
    var id: String { rawValue }

    var tone: Tone {
        switch self {
        case .needed:   return .warning
        case .ordered:  return .primary
        case .received: return .good
        }
    }
}

enum IdeaStatus: String, Codable, CaseIterable, Identifiable {
    case saved = "Saved"
    case considering = "Considering"
    case chosen = "Chosen"
    case archived = "Archived"
    var id: String { rawValue }
}

/// The five calm daily signals shown on Today.
enum TodaySignalKind: String, CaseIterable, Identifiable {
    case doIt = "Do"
    case buy = "Buy"
    case take = "Take"
    case watch = "Watch"
    case help = "Help"
    var id: String { rawValue }

    var systemImage: String {
        switch self {
        case .doIt:  return "checkmark.circle"
        case .buy:   return "cart"
        case .take:  return "pills"
        case .watch: return "calendar"
        case .help:  return "hand.raised"
        }
    }
    /// The category's color-code hue (Do purple, Buy sage, Take amber,
    /// Watch periwinkle, Help rose) — consistent everywhere it appears.
    var color: Color {
        switch self {
        case .doIt:  return Theme.catDo
        case .buy:   return Theme.catBuy
        case .take:  return Theme.catTake
        case .watch: return Theme.catWatch
        case .help:  return Theme.catHelp
        }
    }
}
