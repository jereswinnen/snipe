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
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.snipeBackground)
                .navigationTitle("Snipe")
                .toolbarTitleDisplayMode(.inlineLarge)
                .toolbar { toolbar }
                .navigationDestination(for: Int.self) { groupId in
                    GroupDetailView(groupId: groupId)
                }
        }
        .task(id: filter) { await load() }
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
                if let errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)
                        .padding(.bottom, 8)
                }

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
            // SwiftUI cancels the .refreshable Task as soon as the
            // pull-to-refresh gesture ends, often before the network call
            // finishes — surfacing as NSURLErrorCancelled (-999). Detach
            // the work so it survives the gesture and the grid actually
            // refreshes; we still await so the spinner stays up for the
            // real duration.
            .refreshable {
                await Task.detached { @MainActor in
                    await load()
                }.value
            }
        }
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button {
                showAddSheet = true
            } label: {
                Image(systemName: "plus")
            }

            Menu {
                Picker("Filter", selection: $filter) {
                    Label("All", systemImage: "square.grid.2x2").tag(Medium?.none)
                    Label("Digital", systemImage: "arrow.down.circle").tag(Medium?.some(.digital))
                    Label("Physical", systemImage: "shippingbox").tag(Medium?.some(.physical))
                }

                Section {
                    Button(role: .destructive) {
                        Task { await session.signOut() }
                    } label: {
                        Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            } label: {
                Image(systemName: "ellipsis")
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
        } catch let NetworkError.transport(err as NSError)
            where err.code == NSURLErrorCancelled
        {
            // Pull-to-refresh torn down before the request finished — not a
            // user-visible error.
        } catch is CancellationError {
            // Same story for cooperative Swift Task cancellation.
        } catch {
            errorMessage = (error as? NetworkError)?.description ?? error.localizedDescription
        }
    }
}
