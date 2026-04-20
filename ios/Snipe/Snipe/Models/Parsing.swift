import Foundation

// MARK: - URL parsing

/// Some shop pages emit meta tags with leading/trailing whitespace inside
/// the attribute value. URL(string:) rejects those. Trimming first, then
/// URL-encoding any remaining illegal characters gives us a best-effort
/// parse without hiding real bugs.
nonisolated enum SnipeURL {
    static func from(_ raw: String) -> URL? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if let url = URL(string: trimmed) { return url }
        if let encoded = trimmed.addingPercentEncoding(
            withAllowedCharacters: .urlQueryAllowed
        ) {
            return URL(string: encoded)
        }
        return nil
    }
}

// MARK: - Date parsing

/// Shared ISO8601 parser with fractional-second support. The API emits
/// timestamps like `2026-04-20T09:50:00.000Z`; the default formatter
/// rejects the `.000`.
nonisolated enum DateParser {
    static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}
