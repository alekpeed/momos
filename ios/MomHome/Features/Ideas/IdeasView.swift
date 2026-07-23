import SwiftUI
import SwiftData

struct IdeasView: View {
    @Environment(\.modelContext) private var context
    @Query(filter: #Predicate<IdeaBoard> { !$0.archived }, sort: \IdeaBoard.createdAt, order: .reverse) private var boards: [IdeaBoard]
    @State private var showingAdd = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.md) {
                if boards.isEmpty {
                    EmptyStateView(systemImage: "lightbulb", title: "No boards yet", message: "Start a board to collect ideas for a room, project, or purchase.", actionTitle: "New board") { showingAdd = true }
                } else {
                    ForEach(boards) { board in
                        NavigationLink { BoardDetailView(board: board) } label: { BoardCard(board: board) }
                            .buttonStyle(.plain)
                            .explains("A board", "A collection of ideas about one thing. Tap to open it.")
                    }
                }
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Ideas")
        .toolbar { ToolbarItem(placement: .primaryAction) { Button { showingAdd = true } label: { Image(systemName: "plus") }.accessibilityLabel("New board") } }
        .sheet(isPresented: $showingAdd) {
            NavigationStack { BoardEditorView() }
        }
    }
}

private struct BoardCard: View {
    let board: IdeaBoard
    @Query private var cards: [IdeaCard]
    init(board: IdeaBoard) {
        self.board = board
        let id = board.id
        _cards = Query(filter: #Predicate<IdeaCard> { $0.boardId == id })
    }
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Space.sm) {
                HStack {
                    Text(board.name).font(.headline).foregroundStyle(Theme.ink)
                    Spacer()
                    Image(systemName: "chevron.right").font(.footnote).foregroundStyle(Theme.inkTertiary)
                }
                if !board.note.isEmpty {
                    Text(board.note).font(.subheadline).foregroundStyle(Theme.inkSecondary)
                }
                StatusPill(text: "\(cards.count) idea\(cards.count == 1 ? "" : "s")", tone: .lavender)
            }
        }
    }
}

struct BoardDetailView: View {
    @Environment(\.modelContext) private var context
    let board: IdeaBoard
    @Query private var cards: [IdeaCard]
    @State private var showingAdd = false
    @State private var search = ""
    @State private var sort: SortMode = .recent
    @State private var favoritesOnly = false
    @State private var showArchived = false

    enum SortMode: String, CaseIterable, Identifiable {
        case recent = "Recent", title = "A–Z", favorite = "Favorites"
        var id: String { rawValue }
    }

    init(board: IdeaBoard) {
        self.board = board
        let id = board.id
        _cards = Query(filter: #Predicate<IdeaCard> { $0.boardId == id }, sort: \IdeaCard.createdAt, order: .reverse)
    }

    private var favoriteCount: Int { cards.filter { $0.favorite && $0.status != .archived }.count }

    private var visible: [IdeaCard] {
        var list = showArchived ? cards.filter { $0.status == .archived } : cards.filter { $0.status != .archived }
        if favoritesOnly { list = list.filter(\.favorite) }
        if !search.isEmpty {
            list = list.filter { $0.title.localizedCaseInsensitiveContains(search) || $0.note.localizedCaseInsensitiveContains(search) }
        }
        switch sort {
        case .recent: return list
        case .title: return list.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        case .favorite: return list.sorted { ($0.favorite ? 0 : 1) < ($1.favorite ? 0 : 1) }
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.md) {
                if favoriteCount > 0 || favoritesOnly {
                    Button { favoritesOnly.toggle() } label: {
                        Label(favoritesOnly ? "Showing \(favoriteCount) favorites" : "Compare \(favoriteCount) favorites",
                              systemImage: favoritesOnly ? "heart.fill" : "heart")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(favoritesOnly ? .white : Theme.clay)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Theme.Space.sm + 2)
                            .background(favoritesOnly ? Theme.clay : Theme.clay.opacity(0.12), in: RoundedRectangle(cornerRadius: Theme.controlRadius, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .explains("Compare favorites", "Show only the ideas you've hearted, side by side.")
                }

                if visible.isEmpty {
                    EmptyStateView(
                        systemImage: showArchived ? "archivebox" : "square.on.square",
                        title: showArchived ? "No archived ideas" : "No ideas yet",
                        message: showArchived ? "Cards you archive show up here." : "Add a card with a note, link, or photo.",
                        actionTitle: showArchived ? nil : "Add idea"
                    ) { showingAdd = true }
                } else {
                    ForEach(visible) { card in
                        cardView(card)
                            .explains("An idea", "A note, link, or photo. Tap the heart to favorite it, or the ⋯ menu to turn it into a task or order.")
                    }
                }
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle(board.name)
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $search, prompt: "Search ideas")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Menu {
                    Picker("Sort", selection: $sort) { ForEach(SortMode.allCases) { Text($0.rawValue).tag($0) } }
                    Toggle("Favorites only", isOn: $favoritesOnly)
                    Toggle("Show archived", isOn: $showArchived)
                } label: { Image(systemName: "line.3.horizontal.decrease.circle") }
                .accessibilityLabel("Sort and filter")
            }
            ToolbarItem(placement: .primaryAction) {
                Button { showingAdd = true } label: { Image(systemName: "plus") }.accessibilityLabel("Add an idea")
            }
        }
        .sheet(isPresented: $showingAdd) { NavigationStack { CardEditorView(boardId: board.id) } }
    }

    private func cardView(_ card: IdeaCard) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Space.sm) {
                HStack {
                    Text(card.title).font(.body.weight(.medium)).foregroundStyle(Theme.ink)
                    Spacer()
                    Button { card.favorite.toggle(); try? context.save() } label: {
                        Image(systemName: card.favorite ? "heart.fill" : "heart")
                            .foregroundStyle(card.favorite ? Theme.clay : Theme.inkTertiary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(card.favorite ? "Unfavorite" : "Favorite")
                    Menu {
                        Section("Turn into") {
                            Button { convertToTask(card) } label: { Label("Task", systemImage: "checklist") }
                            Button { convertToOrder(card) } label: { Label("Order", systemImage: "cart") }
                            Button { convertToItem(card) } label: { Label("Inventory item", systemImage: "shippingbox") }
                            Button { convertToReminder(card) } label: { Label("Reminder", systemImage: "calendar") }
                        }
                        if card.status == .archived {
                            Button { card.status = .saved; try? context.save() } label: { Label("Restore", systemImage: "tray.and.arrow.up") }
                        } else {
                            Button { card.status = .archived; try? context.save() } label: { Label("Archive", systemImage: "archivebox") }
                        }
                        Button(role: .destructive) { context.delete(card); try? context.save() } label: { Label("Delete", systemImage: "trash") }
                    } label: {
                        Image(systemName: "ellipsis.circle").foregroundStyle(Theme.inkTertiary)
                    }
                    .accessibilityLabel("Idea actions")
                }
                if !card.note.isEmpty { Text(card.note).font(.subheadline).foregroundStyle(Theme.inkSecondary) }
                HStack {
                    StatusPill(text: card.status.rawValue, tone: card.status == .archived ? .neutral : .primary)
                    if !card.link.isEmpty, let url = URL(string: card.link) {
                        Link(destination: url) { StatusPill(text: "Open link", tone: .lavender, systemImage: "link") }
                    }
                }
            }
        }
    }

    // Conversions keep the card and create a linked record (mirrors the web engine).
    private func convertToTask(_ card: IdeaCard) {
        context.insert(TaskRecord(title: card.title, detail: card.note))
        try? context.save()
    }
    private func convertToOrder(_ card: IdeaCard) {
        context.insert(Order(name: card.title))
        try? context.save()
    }
    private func convertToItem(_ card: IdeaCard) {
        context.insert(InventoryItem(name: card.title))
        try? context.save()
    }
    private func convertToReminder(_ card: IdeaCard) {
        context.insert(CalendarEntry(title: card.title, date: .now, reminderEnabled: true))
        try? context.save()
    }
}

struct BoardEditorView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var note = ""
    var body: some View {
        Form {
            TextField("Board name", text: $name)
            TextField("Note (optional)", text: $note)
        }
        .navigationTitle("New board")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    context.insert(IdeaBoard(name: name.trimmingCharacters(in: .whitespaces), note: note))
                    try? context.save(); dismiss()
                }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }
}

struct CardEditorView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    let boardId: String
    @State private var title = ""
    @State private var note = ""
    @State private var link = ""
    @State private var status: IdeaStatus = .saved
    var body: some View {
        Form {
            Section { TextField("Idea title", text: $title); TextField("Note", text: $note, axis: .vertical) }
            Section("Link") { TextField("https://…", text: $link).textInputAutocapitalization(.never).autocorrectionDisabled() }
            Section { Picker("Status", selection: $status) { ForEach(IdeaStatus.allCases) { Text($0.rawValue).tag($0) } } }
        }
        .navigationTitle("New idea")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    context.insert(IdeaCard(boardId: boardId, title: title.trimmingCharacters(in: .whitespaces), note: note, link: link, status: status))
                    try? context.save(); dismiss()
                }.disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }
}

#Preview {
    NavigationStack { IdeasView() }
        .modelContainer(PreviewData.container)
}
