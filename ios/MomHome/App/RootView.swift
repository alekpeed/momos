import SwiftUI

/// The six primary destinations, aligned with the current app and the native
/// iOS handoff brief. Uses the modern `Tab` API and a per-tab `NavigationStack`.
struct RootView: View {
    enum Section: Hashable { case today, tasks, calendar, inventory, ideas, more }
    @State private var selection: Section = .today

    var body: some View {
        TabView(selection: $selection) {
            Tab("Today", systemImage: "sun.max", value: .today) {
                NavigationStack { TodayView() }
            }
            Tab("Tasks", systemImage: "checklist", value: .tasks) {
                NavigationStack { TasksView() }
            }
            Tab("Calendar", systemImage: "calendar", value: .calendar) {
                NavigationStack { CalendarView() }
            }
            Tab("Inventory", systemImage: "shippingbox", value: .inventory) {
                NavigationStack { InventoryView() }
            }
            Tab("Ideas", systemImage: "lightbulb", value: .ideas) {
                NavigationStack { IdeasView() }
            }
            Tab("More", systemImage: "ellipsis.circle", value: .more) {
                NavigationStack { MoreView() }
            }
        }
    }
}

#Preview {
    RootView()
        .modelContainer(PreviewData.container)
}
