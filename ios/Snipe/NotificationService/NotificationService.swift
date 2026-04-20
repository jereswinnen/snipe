import UserNotifications
import UniformTypeIdentifiers

/// Notification Service Extension. APNs alerts arrive here first when the
/// payload sets `mutable-content: 1`; we have ~30 s of wall time to mutate
/// the content before delivery. Snipe uses this to download the product
/// image referenced by the custom `image_url` key and attach it as a
/// notification attachment so the banner shows a thumbnail.
///
/// Failure path: if the download errors, times out, or there's no
/// `image_url`, we deliver the original text-only content. We never block
/// the banner on the image.
final class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttempt: UNMutableNotificationContent?
    private var downloadTask: Task<Void, Never>?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        let content = (request.content.mutableCopy() as? UNMutableNotificationContent)
            ?? UNMutableNotificationContent()
        self.bestAttempt = content

        guard
            let urlString = request.content.userInfo["image_url"] as? String,
            let url = URL(string: urlString)
        else {
            contentHandler(content)
            return
        }

        downloadTask = Task { [weak self] in
            if let attachment = await Self.downloadAttachment(from: url) {
                content.attachments = [attachment]
            }
            self?.deliver()
        }
    }

    override func serviceExtensionTimeWillExpire() {
        // System is about to terminate the extension. Cancel the in-flight
        // download and deliver whatever we have — never let the banner drop.
        downloadTask?.cancel()
        deliver()
    }

    private func deliver() {
        guard let handler = contentHandler, let content = bestAttempt else { return }
        contentHandler = nil
        handler(content)
    }

    private static func downloadAttachment(from url: URL) async -> UNNotificationAttachment? {
        do {
            let (tempURL, response) = try await URLSession.shared.download(from: url)

            // Pick a sensible extension: prefer the URL's, fall back to the
            // server's MIME type. UNNotificationAttachment infers content
            // type from the filename suffix; if it can't, the attachment is
            // rejected and the banner falls back to text-only.
            let ext = preferredExtension(for: url, response: response) ?? "jpg"
            let destination = URL(fileURLWithPath: NSTemporaryDirectory())
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension(ext)
            try FileManager.default.moveItem(at: tempURL, to: destination)

            return try UNNotificationAttachment(
                identifier: "image",
                url: destination,
                options: nil
            )
        } catch {
            return nil
        }
    }

    private static func preferredExtension(
        for url: URL,
        response: URLResponse
    ) -> String? {
        let pathExt = url.pathExtension.lowercased()
        if !pathExt.isEmpty, ["jpg", "jpeg", "png", "gif", "webp", "heic"].contains(pathExt) {
            return pathExt == "jpeg" ? "jpg" : pathExt
        }
        if
            let mime = response.mimeType,
            let type = UTType(mimeType: mime),
            let ext = type.preferredFilenameExtension
        {
            return ext
        }
        return nil
    }
}
