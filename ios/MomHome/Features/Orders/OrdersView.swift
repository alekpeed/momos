import SwiftUI
import SwiftData

struct OrdersView: View {
    enum Segment: String, CaseIterable, Identifiable { case orders = "To order", purchases = "Purchases"; var id: String { rawValue } }
    @State private var segment: Segment = .orders

    var body: some View {
        VStack(spacing: 0) {
            Picker("View", selection: $segment) {
                ForEach(Segment.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding(Theme.Space.lg)

            switch segment {
            case .orders:    OrdersList()
            case .purchases: PurchasesList()
            }
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Orders")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct OrdersList: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Order.createdAt, order: .reverse) private var orders: [Order]
    @State private var showingAdd = false
    @State private var filter: OrderStatus?

    private var filtered: [Order] {
        guard let filter else { return orders }
        return orders.filter { $0.status == filter }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.md) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Theme.Space.sm) {
                        chip("All", active: filter == nil) { filter = nil }
                        ForEach(OrderStatus.allCases) { s in chip(s.rawValue, active: filter == s) { filter = s } }
                    }
                }
                if filtered.isEmpty {
                    EmptyStateView(systemImage: "cart", title: "Nothing to order", message: "Add things you need to buy.", actionTitle: "Add order") { showingAdd = true }
                } else {
                    ForEach(filtered) { order in
                        Card {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(order.name).font(.body.weight(.medium)).foregroundStyle(Theme.ink)
                                    HStack(spacing: Theme.Space.sm) {
                                        if order.quantity > 1 { Text("×\(order.quantity)").font(.caption).foregroundStyle(Theme.inkSecondary) }
                                        if !order.store.isEmpty { Text(order.store).font(.caption).foregroundStyle(Theme.inkSecondary) }
                                        if let date = order.expectedDate {
                                            Label(date.formatted(.dateTime.month().day()), systemImage: "shippingbox")
                                                .font(.caption).foregroundStyle(Theme.inkSecondary)
                                        }
                                    }
                                }
                                Spacer()
                                Menu {
                                    ForEach(OrderStatus.allCases) { s in
                                        Button(s.rawValue) { order.status = s; order.updatedAt = .now; try? context.save() }
                                    }
                                } label: { StatusPill(text: order.status.rawValue, tone: order.status.tone) }
                            }
                        }
                    }
                }
            }
            .padding(Theme.Space.lg)
        }
        .toolbar { ToolbarItem(placement: .primaryAction) { Button { showingAdd = true } label: { Image(systemName: "plus") }.accessibilityLabel("Add an order") } }
        .sheet(isPresented: $showingAdd) { NavigationStack { OrderEditor() } }
    }

    private func chip(_ title: String, active: Bool, _ tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            Text(title).font(.subheadline.weight(.semibold))
                .foregroundStyle(active ? .white : Theme.inkSecondary)
                .padding(.horizontal, Theme.Space.lg).padding(.vertical, Theme.Space.sm)
                .background(active ? Theme.primary : Theme.surfaceMuted, in: Capsule())
        }.buttonStyle(.plain)
    }
}

private struct PurchasesList: View {
    @Query(sort: \Purchase.purchasedAt, order: .reverse) private var purchases: [Purchase]
    @State private var showingAdd = false
    @State private var showingImport = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.md) {
                if purchases.isEmpty {
                    EmptyStateView(systemImage: "bag", title: "No purchases yet", message: "Record what you've bought to keep a history.", actionTitle: "Add purchase") { showingAdd = true }
                } else {
                    ForEach(purchases) { p in
                        Card {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(p.productName).font(.body.weight(.medium)).foregroundStyle(Theme.ink)
                                    Text([p.storeName, p.purchasedAt.formatted(.dateTime.month().day().year())].filter { !$0.isEmpty }.joined(separator: " · "))
                                        .font(.caption).foregroundStyle(Theme.inkSecondary)
                                }
                                Spacer()
                                if !p.totalPrice.isEmpty { Text("$\(p.totalPrice)").font(.body.weight(.semibold)).foregroundStyle(Theme.ink) }
                            }
                        }
                    }
                }
            }
            .padding(Theme.Space.lg)
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { showingImport = true } label: { Image(systemName: "text.viewfinder") }
                    .accessibilityLabel("Import from receipt")
            }
            ToolbarItem(placement: .primaryAction) {
                Button { showingAdd = true } label: { Image(systemName: "plus") }.accessibilityLabel("Add a purchase")
            }
        }
        .sheet(isPresented: $showingAdd) { NavigationStack { PurchaseEditor() } }
        .sheet(isPresented: $showingImport) { ReceiptImportView() }
    }
}

struct OrderEditor: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var quantity = 1
    @State private var store = ""
    @State private var status: OrderStatus = .needed
    @State private var hasDate = false
    @State private var expected = Date.now

    var body: some View {
        Form {
            Section { TextField("What to order", text: $name); Stepper("Quantity: \(quantity)", value: $quantity, in: 1...99) }
            Section {
                TextField("Store (optional)", text: $store)
                Picker("Status", selection: $status) { ForEach(OrderStatus.allCases) { Text($0.rawValue).tag($0) } }
                Toggle("Expected delivery", isOn: $hasDate.animation())
                if hasDate { DatePicker("On", selection: $expected, displayedComponents: .date) }
            }
        }
        .navigationTitle("New order")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    context.insert(Order(name: name.trimmingCharacters(in: .whitespaces), status: status, quantity: quantity, store: store, expectedDate: hasDate ? expected : nil))
                    try? context.save(); dismiss()
                }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }
}

struct PurchaseEditor: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var store: String
    @State private var price: String
    @State private var date: Date

    init(name: String = "", store: String = "", price: String = "", date: Date = .now) {
        _name = State(initialValue: name)
        _store = State(initialValue: store)
        _price = State(initialValue: price)
        _date = State(initialValue: date)
    }

    var body: some View {
        Form {
            TextField("Product", text: $name)
            TextField("Store", text: $store)
            TextField("Total price", text: $price).keyboardType(.decimalPad)
            DatePicker("Purchased", selection: $date, displayedComponents: .date)
        }
        .navigationTitle("New purchase")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    context.insert(Purchase(productName: name.trimmingCharacters(in: .whitespaces), storeName: store, totalPrice: price, purchasedAt: date))
                    try? context.save(); dismiss()
                }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }
}

#Preview {
    NavigationStack { OrdersView() }
        .modelContainer(PreviewData.container)
}
