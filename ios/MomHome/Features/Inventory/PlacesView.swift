import SwiftUI
import SwiftData
import UIKit

/// Places (locations) and the bins inside them, with printable QR labels.
struct PlacesView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \StorageLocation.sortIndex) private var locations: [StorageLocation]
    @Query(sort: \StorageBin.name) private var bins: [StorageBin]
    @State private var showingAddLocation = false
    @State private var addBinForLocation: StorageLocation?
    @State private var showingScanner = false
    @State private var scannedBin: StorageBin?
    @State private var scanMiss = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.lg) {
                if locations.isEmpty {
                    EmptyStateView(systemImage: "map", title: "No places yet", message: "Add a room or area, then the bins inside it.", actionTitle: "Add a place") { showingAddLocation = true }
                } else {
                    ForEach(locations) { location in
                        VStack(alignment: .leading, spacing: Theme.Space.sm) {
                            HStack {
                                SectionHeader(title: location.name, subtitle: location.note.isEmpty ? nil : location.note)
                                Button { addBinForLocation = location } label: { Image(systemName: "plus.circle") }
                                    .tint(Theme.primary)
                            }
                            let locationBins = bins.filter { $0.locationId == location.id }
                            if locationBins.isEmpty {
                                Text("No bins here yet.").font(.caption).foregroundStyle(Theme.inkTertiary)
                            } else {
                                ForEach(locationBins) { bin in
                                    NavigationLink { BinLabelView(bin: bin) } label: { BinRow(bin: bin) }
                                        .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Places & bins")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if QRScannerView.isSupported {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showingScanner = true } label: { Image(systemName: "qrcode.viewfinder") }
                        .accessibilityLabel("Scan a bin QR")
                }
            }
            ToolbarItem(placement: .primaryAction) {
                Button { showingAddLocation = true } label: { Image(systemName: "plus") }
                    .accessibilityLabel("Add a place")
            }
        }
        .sheet(isPresented: $showingAddLocation) { NavigationStack { LocationEditor(nextIndex: locations.count) } }
        .sheet(item: $addBinForLocation) { location in NavigationStack { BinEditor(locationId: location.id) } }
        .sheet(isPresented: $showingScanner) { ScannerSheet(onCode: handleScan) }
        .navigationDestination(item: $scannedBin) { bin in BinLabelView(bin: bin) }
        .alert("Bin not found", isPresented: $scanMiss) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("That QR code doesn't match a bin in this household.")
        }
    }

    private func handleScan(_ code: String) {
        guard let comps = URLComponents(string: code),
              comps.scheme == "momhome", comps.host == "bin" else { scanMiss = true; return }
        let binCode = comps.path.replacingOccurrences(of: "/", with: "")
        if let bin = bins.first(where: { $0.containerCode.caseInsensitiveCompare(binCode) == .orderedSame }) {
            scannedBin = bin
        } else {
            scanMiss = true
        }
    }
}

private struct BinRow: View {
    let bin: StorageBin
    var body: some View {
        Card {
            HStack(spacing: Theme.Space.md) {
                Image(systemName: "shippingbox").foregroundStyle(Theme.primary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(bin.name).font(.body.weight(.medium)).foregroundStyle(Theme.ink)
                    Text(bin.containerCode).font(.caption).foregroundStyle(Theme.inkSecondary)
                }
                Spacer()
                Image(systemName: "qrcode").foregroundStyle(Theme.inkTertiary)
            }
        }
    }
}

/// A printable QR label for a bin.
struct BinLabelView: View {
    let bin: StorageBin
    private var link: String { QRCode.binLink(code: bin.containerCode) }

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.Space.lg) {
                Card {
                    VStack(spacing: Theme.Space.md) {
                        Text(bin.name).font(.system(.title2, design: .serif).weight(.semibold)).foregroundStyle(Theme.ink)
                        if let image = QRCode.image(for: link) {
                            Image(uiImage: image)
                                .interpolation(.none)
                                .resizable()
                                .scaledToFit()
                                .frame(maxWidth: 240)
                                .padding(Theme.Space.md)
                                .background(.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                        Text(bin.containerCode).font(.headline.monospaced()).foregroundStyle(Theme.inkSecondary)
                        Text("Scanning this label opens Mom Home to this bin.").font(.caption).foregroundStyle(Theme.inkTertiary).multilineTextAlignment(.center)
                    }
                }
                if let image = QRCode.image(for: link, scale: 16) {
                    ShareLink(item: Image(uiImage: image), preview: SharePreview("\(bin.name) QR label", image: Image(uiImage: image))) {
                        Label("Share / print label", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(QuietPrimaryButtonStyle())
                }
                Button { UIPasteboard.general.string = link } label: {
                    Label("Copy scan link", systemImage: "link")
                }
                .buttonStyle(.bordered)
                .tint(Theme.primary)
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Bin label")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct LocationEditor: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    let nextIndex: Int
    @State private var name = ""
    @State private var note = ""
    var body: some View {
        Form {
            TextField("Place name (e.g. Kitchen)", text: $name)
            TextField("Note (optional)", text: $note)
        }
        .navigationTitle("New place")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    context.insert(StorageLocation(name: name.trimmingCharacters(in: .whitespaces), note: note, sortIndex: nextIndex))
                    try? context.save(); dismiss()
                }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }
}

struct BinEditor: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    let locationId: String
    @State private var name = ""
    @State private var code = ""
    var body: some View {
        Form {
            TextField("Bin name", text: $name)
            TextField("Code (for the QR label)", text: $code)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
        }
        .navigationTitle("New bin")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    let finalCode = code.trimmingCharacters(in: .whitespaces).isEmpty
                        ? "BIN-\(Int.random(in: 1000...9999))"
                        : code.trimmingCharacters(in: .whitespaces)
                    context.insert(StorageBin(name: name.trimmingCharacters(in: .whitespaces), containerCode: finalCode, locationId: locationId))
                    try? context.save(); dismiss()
                }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }
}

#Preview {
    NavigationStack { PlacesView() }
        .modelContainer(PreviewData.container)
}
