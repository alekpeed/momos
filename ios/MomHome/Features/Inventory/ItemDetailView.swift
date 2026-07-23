import SwiftUI
import SwiftData
import PhotosUI
import UIKit

struct ItemDetailView: View {
    @Environment(\.modelContext) private var context
    @Bindable var item: InventoryItem
    @Query private var locations: [StorageLocation]
    @Query private var bins: [StorageBin]
    @State private var showingEdit = false

    private var locationName: String? { locations.first { $0.id == item.locationId }?.name }
    private var binName: String? { bins.first { $0.id == item.binId }?.name }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.lg) {
                if let data = item.photo, let ui = UIImage(data: data) {
                    Image(uiImage: ui).resizable().scaledToFill()
                        .frame(maxWidth: .infinity, maxHeight: 220).clipped()
                        .clipShape(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
                }

                Card {
                    VStack(alignment: .leading, spacing: Theme.Space.md) {
                        HStack {
                            Text(item.name).font(.system(.title2, design: .serif).weight(.semibold)).foregroundStyle(Theme.ink)
                            Spacer()
                            StatusPill(text: item.quantityStatus.rawValue, tone: item.quantityStatus.tone)
                        }
                        detailRow("Category", item.category)
                        if let locationName { detailRow("Place", locationName) }
                        if let binName { detailRow("Bin", binName) }
                        detailRow("On hand", "\(item.quantity)")
                        detailRow("Warn at", "\(item.lowStockThreshold)")
                        if !item.preferredStore.isEmpty { detailRow("Preferred store", item.preferredStore) }
                    }
                }

                SectionHeader(title: "Quick actions")
                HStack(spacing: Theme.Space.md) {
                    Button { cycleStatus() } label: {
                        Label("Change status", systemImage: "arrow.triangle.2.circlepath").frame(maxWidth: .infinity)
                    }.buttonStyle(.bordered).tint(Theme.primary)
                    Button { addToOrder() } label: {
                        Label("Add to order", systemImage: "cart.badge.plus").frame(maxWidth: .infinity)
                    }.buttonStyle(.bordered).tint(Theme.clay)
                }

                if !item.replacementURL.isEmpty, let url = URL(string: item.replacementURL) {
                    Link(destination: url) { Label("Open saved replacement link", systemImage: "link").frame(maxWidth: .infinity) }
                        .buttonStyle(.bordered).tint(Theme.lavender)
                }
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Item")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .primaryAction) { Button("Edit") { showingEdit = true } } }
        .sheet(isPresented: $showingEdit) { NavigationStack { ItemEditorView(item: item) } }
    }

    private func detailRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.subheadline).foregroundStyle(Theme.inkSecondary)
            Spacer()
            Text(value).font(.subheadline.weight(.medium)).foregroundStyle(Theme.ink)
        }
    }

    private func cycleStatus() {
        let order: [QuantityStatus] = [.plenty, .ok, .low, .out]
        let idx = order.firstIndex(of: item.quantityStatus) ?? 0
        item.quantityStatus = order[(idx + 1) % order.count]
        item.updatedAt = .now
        try? context.save()
    }

    private func addToOrder() {
        context.insert(Order(name: item.name, itemId: item.id, store: item.preferredStore))
        try? context.save()
    }
}

/// Add or edit an inventory item, with a photo picker and place/bin selection.
struct ItemEditorView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \StorageLocation.name) private var locations: [StorageLocation]
    @Query(sort: \StorageBin.name) private var bins: [StorageBin]

    var item: InventoryItem? = nil

    @State private var name = ""
    @State private var category = "General"
    @State private var status: QuantityStatus = .ok
    @State private var quantity = 1
    @State private var threshold = 1
    @State private var preferredStore = ""
    @State private var replacementURL = ""
    @State private var locationId: String?
    @State private var binId: String?
    @State private var photoData: Data?
    @State private var pickerItem: PhotosPickerItem?

    private var isEditing: Bool { item != nil }

    var body: some View {
        Form {
            Section {
                TextField("Item name", text: $name)
                TextField("Category", text: $category)
            }
            Section("Photo") {
                if let photoData, let ui = UIImage(data: photoData) {
                    Image(uiImage: ui).resizable().scaledToFit().frame(maxHeight: 160)
                        .frame(maxWidth: .infinity)
                    Button("Remove photo", role: .destructive) { self.photoData = nil; pickerItem = nil }
                }
                PhotosPicker(selection: $pickerItem, matching: .images) {
                    Label(photoData == nil ? "Add photo" : "Change photo", systemImage: "camera")
                }
            }
            Section("On hand") {
                Picker("Status", selection: $status) { ForEach(QuantityStatus.allCases) { Text($0.rawValue).tag($0) } }
                Stepper("Quantity: \(quantity)", value: $quantity, in: 0...999)
                Stepper("Warn at: \(threshold)", value: $threshold, in: 0...99)
            }
            Section("Where") {
                Picker("Place", selection: $locationId) {
                    Text("None").tag(String?.none)
                    ForEach(locations) { Text($0.name).tag(String?.some($0.id)) }
                }
                Picker("Bin", selection: $binId) {
                    Text("None").tag(String?.none)
                    ForEach(binsForLocation) { Text($0.name).tag(String?.some($0.id)) }
                }
            }
            Section("Reordering") {
                TextField("Preferred store", text: $preferredStore)
                TextField("Replacement link (optional)", text: $replacementURL)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
            }
        }
        .navigationTitle(isEditing ? "Edit item" : "New item")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { save() }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .onAppear(perform: load)
        .onChange(of: pickerItem) { _, newItem in
            guard let newItem else { return }
            // Task started in this MainActor closure inherits MainActor isolation,
            // so assigning to @State is safe.
            Task {
                if let data = try? await newItem.loadTransferable(type: Data.self) {
                    photoData = data
                }
            }
        }
    }

    private var binsForLocation: [StorageBin] {
        guard let locationId else { return bins }
        return bins.filter { $0.locationId == locationId }
    }

    private func load() {
        guard let item else { return }
        name = item.name
        category = item.category
        status = item.quantityStatus
        quantity = item.quantity
        threshold = item.lowStockThreshold
        preferredStore = item.preferredStore
        replacementURL = item.replacementURL
        locationId = item.locationId
        binId = item.binId
        photoData = item.photo
    }

    private func save() {
        let target = item ?? InventoryItem(name: "")
        target.name = name.trimmingCharacters(in: .whitespaces)
        target.category = category
        target.quantityStatus = status
        target.quantity = quantity
        target.lowStockThreshold = threshold
        target.preferredStore = preferredStore
        target.replacementURL = replacementURL
        target.locationId = locationId
        target.binId = binId
        target.photo = photoData
        target.updatedAt = .now
        if item == nil { context.insert(target) }
        try? context.save()
        dismiss()
    }
}

#Preview {
    NavigationStack { ItemEditorView(item: nil) }
        .modelContainer(PreviewData.container)
}
