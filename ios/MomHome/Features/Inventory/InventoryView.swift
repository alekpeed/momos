import SwiftUI
import SwiftData
import UIKit

struct InventoryView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \InventoryItem.name) private var items: [InventoryItem]
    @Query private var locations: [StorageLocation]
    @State private var search = ""
    @State private var showingAdd = false

    private var filtered: [InventoryItem] {
        guard !search.isEmpty else { return items }
        return items.filter { $0.name.localizedCaseInsensitiveContains(search) || $0.category.localizedCaseInsensitiveContains(search) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.md) {
                if items.isEmpty {
                    EmptyStateView(systemImage: "shippingbox", title: "No items yet", message: "Add the things you keep track of at home.", actionTitle: "Add an item") { showingAdd = true }
                } else {
                    ForEach(filtered) { item in
                        NavigationLink { ItemDetailView(item: item) } label: {
                            Card {
                                HStack(spacing: Theme.Space.md) {
                                    itemThumb(item)
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(item.name).font(.body.weight(.medium)).foregroundStyle(Theme.ink)
                                        Text(locationName(item.locationId) ?? item.category)
                                            .font(.caption).foregroundStyle(Theme.inkSecondary)
                                    }
                                    Spacer()
                                    StatusPill(text: item.quantityStatus.rawValue, tone: item.quantityStatus.tone)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button { cycle(item) } label: { Label("Change status", systemImage: "arrow.triangle.2.circlepath") }
                        }
                    }
                }
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Inventory")
        .searchable(text: $search, prompt: "Search items")
        .toolbar {
            ToolbarItem(placement: .primaryAction) { Button { showingAdd = true } label: { Image(systemName: "plus") } }
        }
        .sheet(isPresented: $showingAdd) {
            NavigationStack { ItemEditorView() }
        }
    }

    @ViewBuilder private func itemThumb(_ item: InventoryItem) -> some View {
        if let data = item.photo, let ui = UIImage(data: data) {
            Image(uiImage: ui).resizable().scaledToFill()
                .frame(width: 46, height: 46).clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        } else {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Theme.surfaceMuted).frame(width: 46, height: 46)
                .overlay(Image(systemName: "shippingbox").foregroundStyle(Theme.inkTertiary))
        }
    }

    private func locationName(_ id: String?) -> String? {
        guard let id else { return nil }
        return locations.first { $0.id == id }?.name
    }

    private func cycle(_ item: InventoryItem) {
        let order: [QuantityStatus] = [.plenty, .ok, .low, .out]
        let idx = order.firstIndex(of: item.quantityStatus) ?? 0
        item.quantityStatus = order[(idx + 1) % order.count]
        item.updatedAt = .now
        try? context.save()
    }
}

/// The low-stock path, linked from Today.
struct LowStockView: View {
    @Query(sort: \InventoryItem.name) private var items: [InventoryItem]
    private var lowItems: [InventoryItem] { items.filter { $0.quantityStatus.needsAttention } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.md) {
                if lowItems.isEmpty {
                    EmptyStateView(systemImage: "checkmark.seal", title: "All stocked up", message: "Nothing is marked low or out right now.")
                } else {
                    ForEach(lowItems) { item in
                        Card {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(item.name).font(.body.weight(.medium)).foregroundStyle(Theme.ink)
                                    if !item.preferredStore.isEmpty {
                                        Text("Usually from \(item.preferredStore)").font(.caption).foregroundStyle(Theme.inkSecondary)
                                    }
                                }
                                Spacer()
                                StatusPill(text: item.quantityStatus.rawValue, tone: item.quantityStatus.tone)
                            }
                        }
                    }
                }
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Low stock")
    }
}

#Preview {
    NavigationStack { InventoryView() }
        .modelContainer(PreviewData.container)
}
