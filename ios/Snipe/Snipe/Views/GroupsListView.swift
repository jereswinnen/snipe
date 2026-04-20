import SwiftUI

struct GroupsListView: View {
    @Environment(Session.self) private var session
    @Binding var deepLinkGroupId: Int?

    @State private var groups: [GroupSummary] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var filter: Medium?
    @State private var showAddSheet = false
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            content
                .navigationTitle("Snipe")
                .toolbar { toolbar }
                .navigationDestination(for: Int.self) { groupId in
                    GroupDetailView(groupId: groupId)
                }
        }
        .task { await load() }
        .task(id: filter) { await load() }
        .refreshable { await load() }
        .sheet(isPresented: $showAddSheet) {
            AddURLSheet(mode: .createGroup) {
                Task { await load() }
            }
        }
        .onChange(of: deepLinkGroupId) { _, newValue in
            if let id = newValue {
                path.append(id)
                deepLinkGroupId = nil
            }
        }
        // NavigationStack keeps the list view mounted while a detail view is
        // pushed; `.task` won't re-fire on pop. Reload when the stack returns
        // to root so actions taken in detail (reload, add store, delete) show
        // up in the grid immediately.
        .onChange(of: path.count) { _, newCount in
            if newCount == 0 {
                Task { await load() }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        VStack(spacing: 0) {
            FilterChips(active: $filter)
                .padding(.horizontal)
                .padding(.bottom, 8)

            if isLoading && groups.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage, groups.isEmpty {
                ContentUnavailableView(
                    "Couldn't load",
                    systemImage: "wifi.exclamationmark",
                    description: Text(errorMessage)
                )
            } else if groups.isEmpty {
                ContentUnavailableView(
                    "Nothing tracked yet",
                    systemImage: "bag",
                    description: Text("Tap the plus to add your first product URL.")
                )
            } else {
                ScrollView {
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 170), spacing: 8)],
                        spacing: 8
                    ) {
                        ForEach(groups) { summary in
                            NavigationLink(value: summary.group.id) {
                                GroupCardView(summary: summary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 24)
                }
            }
        }
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                showAddSheet = true
            } label: {
                Image(systemName: "plus")
            }
        }
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button(role: .destructive) {
                    Task { await session.signOut() }
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            groups = try await APIClient.shared.listGroups(medium: filter)
            errorMessage = nil
        } catch NetworkError.unauthorized {
            await session.signOut()
        } catch {
            errorMessage = (error as? NetworkError)?.description ?? error.localizedDescription
        }
    }
}

/// Segmented filter: All / Digital / Physical. Keeps URL-param parity with
/// the web app.
struct FilterChips: View {
    @Binding var active: Medium?

    var body: some View {
        Picker("Medium", selection: $active) {
            Text("All").tag(Medium?.none)
            Text("Digital").tag(Medium?.some(.digital))
            Text("Physical").tag(Medium?.some(.physical))
        }
        .pickerStyle(.segmented)
    }
}
