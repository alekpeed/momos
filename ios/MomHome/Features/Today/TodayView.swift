import SwiftUI
import SwiftData

/// The calm daily front door. Shows a few signals, quick wins, today's agenda,
/// a low-stock nudge, and one obvious Add action — never a dense dashboard.
struct TodayView: View {
    @Environment(\.modelContext) private var context
    @Query private var tasks: [TaskRecord]
    @Query private var items: [InventoryItem]
    @Query private var supplements: [Supplement]
    @Query private var calendarEntries: [CalendarEntry]
    @Query private var helpRequests: [HelpRequest]
    @Query private var settingsRows: [AppSettings]

    @State private var showingAddTask = false

    private var householdName: String { settingsRows.first?.householdName ?? "Our Home" }

    private var today: Date { Calendar.current.startOfDay(for: .now) }

    private var doCount: Int {
        tasks.filter { $0.status == .open && ($0.starred || isDueToday($0)) }.count
    }
    private var buyItems: [InventoryItem] { items.filter { $0.quantityStatus.needsAttention } }
    private var takeCount: Int { supplements.filter { !takenToday($0) }.count }
    private var todaysEvents: [CalendarEntry] {
        calendarEntries.filter { Recurrence.entry($0, occursOn: today) }
    }
    private var helpCount: Int { helpRequests.filter { $0.status == .open }.count + tasks.filter { $0.needsHelp && $0.status != .done }.count }
    private var quickWins: [TaskRecord] {
        tasks.filter { $0.status == .open && $0.effort.isQuick }.prefix(4).map { $0 }
    }

    var body: some View {
        ScreenScaffold(title: "Today") {
            Text(todayLine)
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)

            signalsGrid

            if !quickWins.isEmpty {
                SectionHeader(title: "Quick wins", subtitle: "Small things, done fast")
                VStack(spacing: Theme.Space.sm) {
                    ForEach(quickWins) { task in
                        QuickWinRow(task: task) { complete(task) }
                    }
                }
            }

            SectionHeader(title: "Today's agenda")
            Card {
                if todaysEvents.isEmpty {
                    Text("Nothing scheduled today.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.inkSecondary)
                } else {
                    VStack(alignment: .leading, spacing: Theme.Space.md) {
                        ForEach(todaysEvents) { event in
                            HStack(spacing: Theme.Space.md) {
                                Circle().fill(Theme.primary).frame(width: 8, height: 8)
                                Text(event.title).font(.body).foregroundStyle(Theme.ink)
                                Spacer()
                                Text(event.allDay ? "All day" : event.startTime)
                                    .font(.caption).foregroundStyle(Theme.inkSecondary)
                            }
                        }
                    }
                }
            }

            if !buyItems.isEmpty {
                NavigationLink {
                    LowStockView()
                } label: {
                    Card {
                        HStack(spacing: Theme.Space.md) {
                            Image(systemName: "cart.badge.plus")
                                .font(.title3).foregroundStyle(Theme.clay)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(buyItems.count) item\(buyItems.count == 1 ? "" : "s") to restock")
                                    .font(.headline).foregroundStyle(Theme.ink)
                                Text(buyItems.prefix(3).map(\.name).joined(separator: ", "))
                                    .font(.caption).foregroundStyle(Theme.inkSecondary).lineLimit(1)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.footnote).foregroundStyle(Theme.inkTertiary)
                        }
                    }
                }
                .buttonStyle(.plain)
            }

            Button {
                showingAddTask = true
            } label: {
                Label("Add a task", systemImage: "plus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(QuietPrimaryButtonStyle())
            .padding(.top, Theme.Space.sm)
        }
        .navigationTitle(householdName)
        .sheet(isPresented: $showingAddTask) {
            NavigationStack { TaskEditorView(task: nil) }
        }
    }

    private var signalsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Theme.Space.md) {
            SignalTile(kind: .doIt, count: doCount, caption: "to do")
            SignalTile(kind: .buy, count: buyItems.count, caption: "to buy")
            SignalTile(kind: .take, count: takeCount, caption: "to take")
            SignalTile(kind: .watch, count: todaysEvents.count, caption: "today")
            if helpCount > 0 {
                SignalTile(kind: .help, count: helpCount, caption: "needs a hand")
            }
        }
    }

    private var todayLine: String {
        today.formatted(.dateTime.weekday(.wide).month(.wide).day())
    }

    private func isDueToday(_ task: TaskRecord) -> Bool {
        guard let due = task.dueDate else { return false }
        return Calendar.current.isDate(due, inSameDayAs: today)
    }
    private func takenToday(_ s: Supplement) -> Bool {
        guard let last = s.lastTaken else { return false }
        return Calendar.current.isDate(last, inSameDayAs: today)
    }
    private func complete(_ task: TaskRecord) {
        task.status = .done
        task.updatedAt = .now
        try? context.save()
    }
}

private struct SignalTile: View {
    let kind: TodaySignalKind
    let count: Int
    let caption: String

    var body: some View {
        Card(padding: Theme.Space.lg) {
            VStack(alignment: .leading, spacing: Theme.Space.sm) {
                Image(systemName: kind.systemImage)
                    .font(.title3)
                    .foregroundStyle(kind.tone.ink)
                Text("\(count)")
                    .font(.system(.largeTitle, design: .serif).weight(.semibold))
                    .foregroundStyle(Theme.ink)
                    .contentTransition(.numericText())
                Text("\(kind.rawValue) · \(caption)")
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)
            }
        }
    }
}

private struct QuickWinRow: View {
    let task: TaskRecord
    let complete: () -> Void

    var body: some View {
        HStack(spacing: Theme.Space.md) {
            Button(action: complete) {
                Image(systemName: "circle")
                    .font(.title3)
                    .foregroundStyle(Theme.primary)
            }
            .buttonStyle(.plain)
            Text(task.title).font(.body).foregroundStyle(Theme.ink)
            Spacer()
            if task.starred { Image(systemName: "star.fill").font(.caption).foregroundStyle(Theme.gold) }
        }
        .padding(.horizontal, Theme.Space.lg)
        .padding(.vertical, Theme.Space.md)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.controlRadius, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Theme.controlRadius, style: .continuous).strokeBorder(Theme.hairline, lineWidth: 1))
    }
}

#Preview {
    NavigationStack { TodayView() }
        .modelContainer(PreviewData.container)
}
