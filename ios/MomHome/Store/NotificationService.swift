import Foundation
import SwiftData
import UserNotifications

/// Local (on-device) reminder scheduling. No push server, no entitlement —
/// just `UNUserNotificationCenter`. Reminders are rebuilt from the current data
/// whenever it changes, so there are never stale or duplicate notifications.
@MainActor
final class NotificationService {
    static let shared = NotificationService()
    private let center = UNUserNotificationCenter.current()

    private init() {}

    /// Ask permission. Returns whether reminders are allowed.
    func requestAuthorization() async -> Bool {
        do {
            return try await center.requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            return false
        }
    }

    func authorizationStatus() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    /// Clears all pending reminders and re-schedules from the current data.
    /// Safe to call often; it only schedules when permission is granted.
    func reschedule(from context: ModelContext) async {
        guard await authorizationStatus() == .authorized else { return }
        center.removeAllPendingNotificationRequests()

        let calendar = Calendar.current
        let now = Date.now
        let horizon = calendar.date(byAdding: .day, value: 45, to: now) ?? now
        var requests: [UNNotificationRequest] = []

        // Calendar entries flagged for a reminder → next occurrence at 9am (or start time).
        let entries = (try? context.fetch(FetchDescriptor<CalendarEntry>())) ?? []
        for entry in entries where entry.reminderEnabled {
            for occurrence in Recurrence.upcoming([entry], from: now, days: 45) {
                guard let fireDate = fireDate(for: occurrence.date, startTime: entry.allDay ? "" : entry.startTime, calendar: calendar),
                      fireDate > now, fireDate <= horizon else { continue }
                requests.append(makeRequest(
                    id: "cal-\(entry.id)",
                    title: entry.title,
                    body: entry.allDay ? "Today on your calendar." : "At \(entry.startTime).",
                    fireDate: fireDate, calendar: calendar))
                break // only the next occurrence
            }
        }

        // Open tasks with a due date → 9am that day.
        let tasks = (try? context.fetch(FetchDescriptor<TaskRecord>())) ?? []
        for task in tasks where task.status != .done {
            guard let due = task.dueDate,
                  let fireDate = fireDate(for: due, startTime: "", calendar: calendar),
                  fireDate > now, fireDate <= horizon else { continue }
            requests.append(makeRequest(
                id: "task-\(task.id)",
                title: "Task due: \(task.title)",
                body: task.needsHelp ? "You marked this as needing a hand." : "A gentle reminder.",
                fireDate: fireDate, calendar: calendar))
        }

        for request in requests {
            try? await center.add(request)
        }
    }

    func cancelAll() {
        center.removeAllPendingNotificationRequests()
    }

    // MARK: - Helpers

    private func fireDate(for day: Date, startTime: String, calendar: Calendar) -> Date? {
        var components = calendar.dateComponents([.year, .month, .day], from: day)
        if let (h, m) = parseTime(startTime) {
            components.hour = h; components.minute = m
        } else {
            components.hour = 9; components.minute = 0
        }
        return calendar.date(from: components)
    }

    private func parseTime(_ text: String) -> (Int, Int)? {
        let parts = text.split(separator: ":")
        guard parts.count == 2, let h = Int(parts[0]), let m = Int(parts[1]) else { return nil }
        return (h, m)
    }

    private func makeRequest(id: String, title: String, body: String, fireDate: Date, calendar: Calendar) -> UNNotificationRequest {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let comps = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
        return UNNotificationRequest(identifier: id, content: content, trigger: trigger)
    }
}
