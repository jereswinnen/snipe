import SwiftUI

struct GroupsListView: View {
    @Environment(Session.self) private var session
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.device) private var device
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
        // Reload when the app returns from background. Without this the view
        // stays mounted across suspend→resume and shows the pre-suspend
        // snapshot; .task only fires on first appearance.
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
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

            if let errorMessage {
                // Show the error inline so a silent fetch failure during a
                // refresh doesn't just leave stale tiles on screen.
                Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .padding(.horizontal)
                    .padding(.bottom, 8)
            }

            if isLoading && groups.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if groups.isEmpty && errorMessage == nil {
                ContentUnavailableView(
                    "Nothing tracked yet",
                    systemImage: "bag",
                    description: Text("Tap the plus to add your first product URL.")
                )
            } else {
                ScrollView {
                    let columns = GridLayouts.gridItems(for: device.sizeClassX)
                    let spacing = GridLayouts.spacing(for: device.sizeClassX)
                    LazyVGrid(columns: columns, spacing: spacing) {
                        ForEach(groups) { summary in
                            NavigationLink(value: summary.group.id) {
                                GroupCardView(summary: summary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, spacing)
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
