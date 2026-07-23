import SwiftUI
import SwiftData

struct CalendarView: View {
    @Environment(\.modelContext) private var context
    @Query private var entries: [CalendarEntry]
    @State private var selectedDay: Date = Calendar.current.startOfDay(for: .now)
    @State private var showingAdd = false

    private var upcoming: [(entry: CalendarEntry, date: Date)] {
        Array(Recurrence.upcoming(entries, from: .now, days: 45).prefix(8))
    }
    private var agenda: [CalendarEntry] {
        entries.filter { Recurrence.entry($0, occursOn: selectedDay) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.lg) {
                DatePicker("Day", selection: $selectedDay, displayedComponents: .date)
                    .datePickerStyle(.graphical)
                    .tint(Theme.primary)
                    .padding(Theme.Space.sm)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))

                SectionHeader(title: "On \(selectedDay.formatted(.dateTime.month().day()))")
                if agenda.isEmpty {
                    Card { Text("Nothing on this day.").font(.subheadline).foregroundStyle(Theme.inkSecondary) }
                } else {
                    ForEach(agenda) { entry in eventRow(entry) }
                }

                SectionHeader(title: "Coming up")
                if upcoming.isEmpty {
                    Card { Text("No upcoming events.").font(.subheadline).foregroundStyle(Theme.inkSecondary) }
                } else {
                    ForEach(upcoming.indices, id: \.self) { index in
                        let item = upcoming[index]
                        Button { selectedDay = item.date } label: {
                            Card {
                                HStack {
                                    Text(item.entry.title).font(.body).foregroundStyle(Theme.ink)
                                    Spacer()
                                    Text(item.date.formatted(.dateTime.weekday().month().day()))
                                        .font(.caption).foregroundStyle(Theme.inkSecondary)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Calendar")
        .toolbar {
            ToolbarItem(placement: .primaryAction) { Button { showingAdd = true } label: { Image(systemName: "plus") } }
        }
        .sheet(isPresented: $showingAdd) {
            NavigationStack { EventEditorView(defaultDate: selectedDay) }
        }
    }

    private func eventRow(_ entry: CalendarEntry) -> some View {
        Card {
            HStack(spacing: Theme.Space.md) {
                Circle().fill(Theme.primary).frame(width: 8, height: 8)
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.title).font(.body.weight(.medium)).foregroundStyle(Theme.ink)
                    Text(entry.allDay ? "All day" : [entry.startTime, entry.endTime].filter { !$0.isEmpty }.joined(separator: " – "))
                        .font(.caption).foregroundStyle(Theme.inkSecondary)
                }
                Spacer()
                if entry.repeatRule != .never { StatusPill(text: entry.repeatRule.rawValue, tone: .lavender) }
                if entry.reminderEnabled { Image(systemName: "bell.fill").font(.caption).foregroundStyle(Theme.gold) }
            }
        }
        .contextMenu {
            Button(role: .destructive) { context.delete(entry); try? context.save() } label: { Label("Delete", systemImage: "trash") }
        }
    }
}

struct EventEditorView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    let defaultDate: Date

    @State private var title = ""
    @State private var date = Date.now
    @State private var allDay = true
    @State private var startTime = "09:00"
    @State private var repeatRule: RepeatRule = .never
    @State private var reminder = false

    var body: some View {
        Form {
            Section { TextField("Event title", text: $title) }
            Section("When") {
                DatePicker("Date", selection: $date, displayedComponents: .date)
                Toggle("All day", isOn: $allDay.animation())
                if !allDay { TextField("Start time (HH:MM)", text: $startTime) }
                Picker("Repeats", selection: $repeatRule) {
                    ForEach(RepeatRule.allCases) { Text($0.rawValue).tag($0) }
                }
                Toggle("Remind me", isOn: $reminder)
            }
        }
        .navigationTitle("New event")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { date = defaultDate }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    let entry = CalendarEntry(title: title.trimmingCharacters(in: .whitespaces), date: date, allDay: allDay, startTime: allDay ? "" : startTime, repeatRule: repeatRule, reminderEnabled: reminder)
                    context.insert(entry)
                    try? context.save()
                    dismiss()
                }
                .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }
}

#Preview {
    NavigationStack { CalendarView() }
        .modelContainer(PreviewData.container)
}
