import Foundation

/// Calendar recurrence, ported from the web engine — including the fix so a
/// monthly event on the 29th–31st lands on the last day of shorter months
/// instead of silently disappearing.
enum Recurrence {

    static func entry(_ entry: CalendarEntry, occursOn day: Date, calendar: Calendar = .current) -> Bool {
        let start = calendar.startOfDay(for: entry.date)
        let candidate = calendar.startOfDay(for: day)
        if candidate < start { return false }
        if let until = entry.repeatUntil, candidate > calendar.startOfDay(for: until) { return false }

        switch entry.repeatRule {
        case .never:
            return candidate == start
        case .daily:
            return true
        case .weekly:
            let days = calendar.dateComponents([.day], from: start, to: candidate).day ?? 0
            return days % 7 == 0
        case .monthly:
            let startDay = calendar.component(.day, from: start)
            let candidateDay = calendar.component(.day, from: candidate)
            if candidateDay == startDay { return true }
            // An event on a day the month doesn't have occurs on the last day.
            let lastDay = calendar.range(of: .day, in: .month, for: candidate)?.count ?? candidateDay
            return startDay > lastDay && candidateDay == lastDay
        case .yearly:
            let s = calendar.dateComponents([.month, .day], from: start)
            let c = calendar.dateComponents([.month, .day], from: candidate)
            return s.month == c.month && s.day == c.day
        }
    }

    /// Occurrences from `start` forward, sorted, for agenda/upcoming views.
    static func upcoming(_ entries: [CalendarEntry], from start: Date, days: Int = 60, calendar: Calendar = .current) -> [(entry: CalendarEntry, date: Date)] {
        var results: [(CalendarEntry, Date)] = []
        let base = calendar.startOfDay(for: start)
        for offset in 0...days {
            guard let day = calendar.date(byAdding: .day, value: offset, to: base) else { continue }
            for entry in entries where Recurrence.entry(entry, occursOn: day, calendar: calendar) {
                results.append((entry, day))
            }
        }
        return results.sorted { lhs, rhs in
            if lhs.1 != rhs.1 { return lhs.1 < rhs.1 }
            return lhs.0.startTime < rhs.0.startTime
        }
    }
}
