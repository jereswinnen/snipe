import Foundation
import Observation

/// Global auth/session state. Holds whether we're signed in and kicks off
/// device registration when a token becomes available. Survives as long as
/// the app; injected via @Environment.
@Observable
final class Session {
    private(set) var isAuthenticated: Bool
    private(set) var registeredDeviceToken: String?

    /// The hex APNs token received from didRegisterForRemoteNotificationsWithDeviceToken.
    /// Set by AppDelegate once Apple hands it over; if we already have an
    /// auth token at that point, we register with the server immediately.
    var pendingAPNSToken: String? {
        didSet {
            guard let token = pendingAPNSToken, isAuthenticated else { return }
            Task { await registerPendingToken(token) }
        }
    }

    init() {
        self.isAuthenticated = TokenStore.load() != nil
    }

    func signIn(with token: String) async {
        TokenStore.save(token)
        isAuthenticated = true
        if let apns = pendingAPNSToken {
            await registerPendingToken(apns)
        }
    }

    func signOut() async {
        if let token = registeredDeviceToken {
            try? await APIClient.shared.unregisterDevice(apnsToken: token)
        }
        TokenStore.clear()
        registeredDeviceToken = nil
        isAuthenticated = false
    }

    private func registerPendingToken(_ token: String) async {
        do {
            _ = try await APIClient.shared.registerDevice(
                apnsToken: token,
                environment: .current
            )
            registeredDeviceToken = token
        } catch {
            // Non-fatal: app still works without push. Try again next login.
            print("device registration failed:", error)
        }
    }
}
