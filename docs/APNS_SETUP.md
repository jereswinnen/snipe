# APNs setup for Snipe

One-time steps to wire push notifications through Apple → Railway →
registered devices. The server keeps brrr working in parallel; APNs is
purely additive.

---

## 1. Apple Developer portal

You need four values. Grab them in this order.

### App ID & Bundle ID

1. https://developer.apple.com/account → **Certificates, Identifiers & Profiles** → **Identifiers**.
2. Create (or reuse) an App ID for your iOS target. Bundle ID something
   like `be.jeremys.snipe`. Under **Capabilities**, tick **Push
   Notifications**.
3. **Bundle ID** is the one you just set — keep it for step 4.

### APNs Auth Key (`.p8`)

1. Same page → **Keys** (left sidebar) → **+**.
2. Name: "Snipe APNs". Tick **Apple Push Notifications service (APNs)**.
3. Continue → Register → **Download**. You get a file like
   `AuthKey_ABCD1234EF.p8`. **You can only download this once** — keep
   it somewhere safe (1Password, iCloud Drive, wherever).
4. Note the **Key ID** (the `ABCD1234EF` part).

### Team ID

Top-right of the Developer portal, next to your name. Ten characters,
something like `1A2B3C4D5E`.

---

## 2. Railway env vars

In your Railway service → **Variables** tab → add four:

| Name               | Value                                                              |
|--------------------|--------------------------------------------------------------------|
| `APNS_KEY_ID`      | The Key ID from step 1 (e.g. `ABCD1234EF`)                         |
| `APNS_TEAM_ID`     | The Team ID from step 1                                             |
| `APNS_BUNDLE_ID`   | The Bundle ID from step 1 (e.g. `be.jeremys.snipe`)                 |
| `APNS_KEY_P8`      | The **contents** of `AuthKey_XXX.p8`, including the BEGIN/END lines |

For `APNS_KEY_P8`, open the `.p8` in any text editor and paste the
whole thing. It's multi-line; Railway accepts that. The file should
look like:

```
-----BEGIN PRIVATE KEY-----
MIG...
...
-----END PRIVATE KEY-----
```

Deploy — the env vars pick up on the next run. Leaving any of the four
blank makes the APNs fan-out a no-op (brrr continues to work alone), so
you can half-ship this.

---

## 3. Xcode project

In your iOS target:

1. **Signing & Capabilities** → **+ Capability** → add **Push Notifications**.
2. (Recommended) Also add **Background Modes** → **Remote notifications**
   so silent/content-available payloads can wake the app.

### Request permission + register

Somewhere during first launch (usually in your App's `init` or a
`TaskInitializer` view modifier):

```swift
import UIKit
import UserNotifications

func requestPushPermission() async {
    let center = UNUserNotificationCenter.current()
    let granted = (try? await center.requestAuthorization(
        options: [.alert, .sound, .badge]
    )) ?? false
    guard granted else { return }
    await MainActor.run {
        UIApplication.shared.registerForRemoteNotifications()
    }
}
```

### Capture the device token and send it to Snipe

In `UIApplicationDelegate` (or an `@UIApplicationDelegateAdaptor`):

```swift
func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken tokenData: Data
) {
    let hexToken = tokenData.map { String(format: "%02x", $0) }.joined()
    Task {
        try? await SnipeAPI.shared.registerDevice(
            apnsToken: hexToken,
            bundleId: Bundle.main.bundleIdentifier ?? "",
            environment: .sandbox   // .production for TestFlight/App Store builds
        )
    }
}
```

Where `registerDevice` calls `POST /api/devices` per the API doc with
your Bearer token.

### Handle the payload

Custom keys (`open_url`, `image_url`) arrive in
`UNNotificationContent.userInfo`. The standard pattern:

```swift
extension AppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let info = response.notification.request.content.userInfo
        if let url = (info["open_url"] as? String).flatMap(URL.init(string:)) {
            // route to group detail or open in Safari
        }
    }
}
```

---

## 4. Determining `environment` at runtime

Device tokens from an Xcode-installed build go through the APNs sandbox
host; TestFlight and App Store builds go through production. Easiest
check:

```swift
enum APNSEnvironment: String, Codable {
    case sandbox, production

    static var current: Self {
        #if DEBUG
        return .sandbox
        #else
        return Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
            ? .sandbox
            : .production
        #endif
    }
}
```

Send this in the `POST /api/devices` body. If you get it wrong the
server will prune the token on Apple's `BadDeviceToken` response, so
you'll stop receiving pushes and need to re-register.

---

## 5. Smoke test

1. Log in on the iOS app — it registers a device.
2. On a desktop, hit a price-change path: in the app's **Stores** row
   on any group, tap the row → reload the server page → open the group
   detail → tap **Reload all** after a known price change. (Or just
   adjust a `lastTotalCost` in the DB manually for testing.)
3. Within a few seconds the device gets a push.

If nothing arrives, check Railway logs for `apns notify failed` entries.
The most common cause is env mismatch (`sandbox` token with
`production` host, or vice versa) — fix and re-register.

---

## 6. Keeping brrr

You don't have to pick. The server fires both channels on every
notification; disabling one is purely about which env vars you set.
To keep brrr only, leave the APNs vars blank. To use APNs only, unset
`BRRR_WEBHOOK_SECRET` (the brrr path will 500 per call, which is caught
and logged — add a "disable brrr" flag if that bothers you).
