import SwiftUI

/// The six primary destinations, aligned with the current app and the native
/// iOS handoff brief. Uses the modern `Tab` API and a per-tab `NavigationStack`.
struct RootView: View {
    enum Section: Hashable { case today, tasks, calendar, inventory, ideas, more }
    @Environment(\.modelContext) private var context
    @Environment(ExplainMode.self) private var explain
    @State private var selection: Section = .today
    @State private var showOnboarding = false

    var body: some View {
        @Bindable var explain = explain
        return TabView(selection: $selection) {
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
        .safeAreaInset(edge: .top) {
            if explain.isOn {
                ExplainBanner { explain.isOn = false }
            }
        }
        .overlay(alignment: .bottomTrailing) {
            if !explain.isOn {
                ExplainFloatingButton { explain.isOn = true }
            }
        }
        .sheet(item: $explain.current) { exp in
            ExplanationCard(explanation: exp) { explain.current = nil }
        }
        .onAppear {
            if !AppSettings.current(in: context).hasOnboarded { showOnboarding = true }
        }
        .fullScreenCover(isPresented: $showOnboarding) {
            OnboardingView(onDone: completeOnboarding)
        }
    }

    private func completeOnboarding() {
        AppSettings.current(in: context).hasOnboarded = true
        try? context.save()
        showOnboarding = false
    }
}

#Preview {
    RootView()
        .modelContainer(PreviewData.container)
        .environment(ExplainMode())
}
