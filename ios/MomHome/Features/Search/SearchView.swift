import SwiftUI
import SwiftData

/// Search across the whole household — tasks, inventory, ideas, purchases, orders.
struct SearchView: View {
    @Query private var tasks: [TaskRecord]
    @Query private var items: [InventoryItem]
    @Query private var ideaCards: [IdeaCard]
    @Query private var boards: [IdeaBoard]
    @Query private var purchases: [Purchase]
    @Query private var orders: [Order]
    @State private var query = ""

    private func hit(_ text: String) -> Bool {
        !query.isEmpty && text.localizedCaseInsensitiveContains(query)
    }

    private var mTasks: [TaskRecord] { tasks.filter { hit($0.title) || hit($0.detail) } }
    private var mItems: [InventoryItem] { items.filter { hit($0.name) || hit($0.category) } }
    private var mIdeas: [IdeaCard] { ideaCards.filter { hit($0.title) || hit($0.note) } }
    private var mPurchases: [Purchase] { purchases.filter { hit($0.productName) || hit($0.storeName) } }
    private var mOrders: [Order] { orders.filter { hit($0.name) || hit($0.store) } }

    private var anyResults: Bool {
        !mTasks.isEmpty || !mItems.isEmpty || !mIdeas.isEmpty || !mPurchases.isEmpty || !mOrders.isEmpty
    }

    var body: some View {
        List {
            if query.isEmpty {
                Text("Search across tasks, inventory, ideas, purchases, and orders.")
                    .font(.subheadline).foregroundStyle(Theme.inkSecondary)
                    .listRowBackground(Color.clear)
            } else if !anyResults {
                Text("No matches for “\(query)”.")
                    .font(.subheadline).foregroundStyle(Theme.inkSecondary)
                    .listRowBackground(Color.clear)
            } else {
                if !mTasks.isEmpty {
                    Section("Tasks") {
                        ForEach(mTasks) { row($0.title, subtitle: $0.status.rawValue, icon: "checklist") }
                    }
                }
                if !mItems.isEmpty {
                    Section("Inventory") {
                        ForEach(mItems) { item in
                            NavigationLink { ItemDetailView(item: item) } label: {
                                rowLabel(item.name, subtitle: item.quantityStatus.rawValue, icon: "shippingbox")
                            }
                        }
                    }
                }
                if !mIdeas.isEmpty {
                    Section("Ideas") {
                        ForEach(mIdeas) { card in
                            if let board = boards.first(where: { $0.id == card.boardId }) {
                                NavigationLink { BoardDetailView(board: board) } label: {
                                    rowLabel(card.title, subtitle: board.name, icon: "lightbulb")
                                }
                            } else {
                                rowLabel(card.title, subtitle: "Idea", icon: "lightbulb")
                            }
                        }
                    }
                }
                if !mPurchases.isEmpty {
                    Section("Purchases") {
                        ForEach(mPurchases) { row($0.productName, subtitle: $0.storeName, icon: "bag") }
                    }
                }
                if !mOrders.isEmpty {
                    Section("Orders") {
                        ForEach(mOrders) { row($0.name, subtitle: $0.status.rawValue, icon: "cart") }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Search")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search everything")
    }

    private func row(_ title: String, subtitle: String, icon: String) -> some View {
        rowLabel(title, subtitle: subtitle, icon: icon)
    }

    private func rowLabel(_ title: String, subtitle: String, icon: String) -> some View {
        Label {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).foregroundStyle(Theme.ink)
                if !subtitle.isEmpty {
                    Text(subtitle).font(.caption).foregroundStyle(Theme.inkSecondary)
                }
            }
        } icon: {
            Image(systemName: icon).foregroundStyle(Theme.primary)
        }
    }
}

#Preview {
    NavigationStack { SearchView() }
        .modelContainer(PreviewData.container)
}
