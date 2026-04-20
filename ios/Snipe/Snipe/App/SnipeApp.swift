import SwiftUI

@main
struct SnipeApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var session = Session()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .onAppear { appDelegate.session = session }
        }
    }
}
