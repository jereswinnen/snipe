import UIKit
import UserNotifications

/// Bridges Apple's `UIApplicationDelegate` (only way to receive the APNs
/// device token) to the SwiftUI world. Holds a weak reference to the
/// Session so we can forward the token when it arrives.
final class AppDelegate: NSObject, UIApplicationDelegate {
    weak var session: Session?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Task {
            let granted = try? await UNUserNotificationCenter.current().requestAuthorization(
                options: [.alert, .sound, .badge]
            )
            if granted == true {
                await MainActor.run { application.registerForRemoteNotifications() }
            }
        }
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken tokenData: Data
    ) {
        let hex = tokenData.map { String(format: "%02x", $0) }.joined()
        session?.pendingAPNSToken = hex
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("APNs registration failed:", error)
    }
}

extension AppDelegate: UNUserNotificationCenterDelegate {
    /// Show alerts even while the app is in the foreground — matches the
    /// Snipe UX where a price drop during active use is still worth
    /// surfacing.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }

    /// Handle the tap on a notification. `open_url` in the payload (set by
    /// the server) points at the group detail page; we extract the group
    /// id and post a deep-link notification the SwiftUI root listens for.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let info = response.notification.request.content.userInfo
        guard let urlString = info["open_url"] as? String,
              let url = URL(string: urlString) else { return }
        await MainActor.run {
            NotificationCenter.default.post(
                name: .snipeDidOpenURL,
                object: nil,
                userInfo: ["url": url]
            )
        }
    }
}

extension Notification.Name {
    static let snipeDidOpenURL = Notification.Name("SnipeDidOpenURL")
}
