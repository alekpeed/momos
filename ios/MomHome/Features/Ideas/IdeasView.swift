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

    init(board: IdeaBoard) {
        self.board = board
        let id = board.id
        _cards = Query(filter: #Predicate<IdeaCard> { $0.boardId == id }, sort: \IdeaCard.createdAt, order: .reverse)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.md) {
                if cards.isEmpty {
                    EmptyStateView(systemImage: "square.on.square", title: "No ideas yet", message: "Add a card with a note, link, or photo.", actionTitle: "Add idea") { showingAdd = true }
                } else {
                    ForEach(cards) { card in
                        Card {
                            VStack(alignment: .leading, spacing: Theme.Space.sm) {
                                HStack {
                                    Text(card.title).font(.body.weight(.medium)).foregroundStyle(Theme.ink)
                                    Spacer()
                                    Button { card.favorite.toggle(); try? context.save() } label: {
                                        Image(systemName: card.favorite ? "heart.fill" : "heart").foregroundStyle(card.favorite ? Theme.clay : Theme.inkTertiary)
                                    }.buttonStyle(.plain)
                                }
                                if !card.note.isEmpty { Text(card.note).font(.subheadline).foregroundStyle(Theme.inkSecondary) }
                                HStack {
                                    StatusPill(text: card.status.rawValue, tone: .primary)
                                    if !card.link.isEmpty, let url = URL(string: card.link) {
                                        Link(destination: url) { StatusPill(text: "Open link", tone: .lavender, systemImage: "link") }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .padding(Theme.Space.lg)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle(board.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .primaryAction) { Button { showingAdd = true } label: { Image(systemName: "plus") }.accessibilityLabel("Add an idea") } }
        .sheet(isPresented: $showingAdd) { NavigationStack { CardEditorView(boardId: board.id) } }
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
