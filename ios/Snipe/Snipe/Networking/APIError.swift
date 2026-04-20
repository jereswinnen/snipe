import Foundation

/// Matches the server's stable error envelope (see docs/API.md).
struct APIError: Error, Decodable, Sendable {
    let error: String
    let message: String?

    /// Convenience for surfacing a user-facing string regardless of code.
    var userMessage: String {
        if let message, !message.isEmpty { return message }
        switch error {
        case "duplicate_url": return "This URL is already tracked."
        case "unsupported_shop": return "Unsupported shop."
        case "scrape_failed": return "Couldn't read the shop page."
        case "unauthorized": return "Please sign in again."
        case "group_not_found": return "Group not found."
        case "not_found": return "Not found."
        default: return "Something went wrong."
        }
    }
}

enum NetworkError: Error, CustomStringConvertible {
    case unauthorized
    case api(APIError, status: Int)
    case decoding(Error)
    case transport(Error)
    case malformedResponse

    var description: String {
        switch self {
        case .unauthorized: return "Unauthorized"
        case .api(let e, let status): return "API \(status): \(e.error) — \(e.userMessage)"
        case .decoding(let e): return "Decoding failed: \(e)"
        case .transport(let e): return "Network error: \(e.localizedDescription)"
        case .malformedResponse: return "Malformed response"
        }
    }
}
