import SwiftUI

/// Top-level router. Shows login when there's no token, otherwise the
/// main browse flow. Also listens for deep links from push taps and
/// navigates to the indicated group.
struct RootView: View {
    @Environment(Session.self) private var session
    @State private var deepLinkGroupId: Int?

    var body: some View {
        Group {
            if session.isAuthenticated {
                GroupsListView(deepLinkGroupId: $deepLinkGroupId)
            } else {
                LoginView()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .snipeDidOpenURL)) { note in
            guard let url = note.userInfo?["url"] as? URL else { return }
            // Push payload open_url points at /groups/<id>. Extract that id.
            if let id = url.pathComponents.last.flatMap(Int.init) {
                deepLinkGroupId = id
            }
        }
    }
}
