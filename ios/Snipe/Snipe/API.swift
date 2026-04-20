import Foundation

// MARK: - Errors

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

// MARK: - Token store

/// Thin Keychain wrapper. Only one token is ever stored (single-user app),
/// keyed by bundle id.
enum TokenStore {
    private static var service: String { Bundle.main.bundleIdentifier ?? "snipe" }
    private static let account = "session"

    static func load() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var ref: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &ref)
        guard status == errSecSuccess,
              let data = ref as? Data,
              let token = String(data: data, encoding: .utf8) else { return nil }
        return token
    }

    static func save(_ token: String) {
        let data = Data(token.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let attrs: [String: Any] = [kSecValueData as String: data]
        let status = SecItemUpdate(query as CFDictionary, attrs as CFDictionary)
        if status == errSecItemNotFound {
            var addQuery = query
            addQuery[kSecValueData as String] = data
            SecItemAdd(addQuery as CFDictionary, nil)
        }
    }

    static func clear() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - Client

/// HTTP client aimed at the Snipe JSON API. Injects the bearer token and
/// surfaces the typed error envelope. One shared instance per app.
final class APIClient: @unchecked Sendable {
    static let shared = APIClient()

    private let baseURL: URL
    private let urlSession: URLSession

    init(baseURL: URL = Config.apiBaseURL, urlSession: URLSession = .shared) {
        self.baseURL = baseURL
        self.urlSession = urlSession
    }

    // MARK: - Auth

    struct LoginResponse: Decodable, Sendable {
        let ok: Bool
        let token: String
    }

    func login(password: String) async throws -> String {
        let res: LoginResponse = try await send(
            method: "POST",
            path: "/api/auth/login",
            body: ["password": password],
            authenticated: false
        )
        return res.token
    }

    // MARK: - Groups

    struct GroupsResponse: Decodable, Sendable { let groups: [GroupSummary] }

    func listGroups(medium: Medium? = nil) async throws -> [GroupSummary] {
        var components = URLComponents()
        components.path = "/api/groups"
        if let medium { components.queryItems = [URLQueryItem(name: "m", value: medium.rawValue)] }
        let res: GroupsResponse = try await send(method: "GET", path: components.url!.absoluteString)
        return res.groups
    }

    struct CreateGroupBody: Encodable { let url: String; let targetPrice: Double? }
    struct CreateGroupResponse: Decodable, Sendable { let group: ProductGroup; let listing: Listing }

    func createGroup(url: String, targetPrice: Double? = nil) async throws -> CreateGroupResponse {
        try await send(
            method: "POST",
            path: "/api/groups",
            body: CreateGroupBody(url: url, targetPrice: targetPrice)
        )
    }

    func groupDetail(id: Int) async throws -> GroupDetail {
        try await send(method: "GET", path: "/api/groups/\(id)")
    }

    struct UpdateGroupBody: Encodable {
        let title: String?
        let imageUrl: String?
        let targetPrice: Double??
    }

    func updateGroup(id: Int, targetPrice: Double?) async throws {
        // Using a manual dictionary so we can distinguish "omit" from "null".
        var body: [String: Any?] = [:]
        if let targetPrice { body["targetPrice"] = targetPrice }
        else { body["targetPrice"] = NSNull() }
        let _: EmptyOk = try await send(
            method: "PATCH",
            path: "/api/groups/\(id)",
            jsonObject: body as [AnyHashable: Any]
        )
    }

    func updateGroup(id: Int, title: String) async throws {
        let _: EmptyOk = try await send(
            method: "PATCH",
            path: "/api/groups/\(id)",
            body: ["title": title]
        )
    }

    func deleteGroup(id: Int) async throws {
        let _: EmptyOk = try await send(method: "DELETE", path: "/api/groups/\(id)")
    }

    struct AttachListingBody: Encodable { let url: String }
    struct AttachListingResponse: Decodable, Sendable { let listing: Listing }

    func addListing(groupId: Int, url: String) async throws -> Listing {
        let res: AttachListingResponse = try await send(
            method: "POST",
            path: "/api/groups/\(groupId)/listings",
            body: AttachListingBody(url: url)
        )
        return res.listing
    }

    func trend(groupId: Int, days: Int = 90) async throws -> GroupTrend {
        try await send(method: "GET", path: "/api/groups/\(groupId)/trend?days=\(days)")
    }

    // MARK: - Listings

    struct DeleteListingResponse: Decodable, Sendable {
        let ok: Bool
        let deletedGroup: Bool
    }

    @discardableResult
    func deleteListing(id: Int) async throws -> Bool {
        let res: DeleteListingResponse = try await send(
            method: "DELETE",
            path: "/api/listings/\(id)"
        )
        return res.deletedGroup
    }

    func checkListing(id: Int) async throws -> CheckOutcome {
        try await send(method: "POST", path: "/api/listings/\(id)/check")
    }

    func listingHistory(id: Int, days: Int = 90) async throws -> ListingHistory {
        try await send(method: "GET", path: "/api/listings/\(id)/history?days=\(days)")
    }

    // MARK: - Devices

    struct RegisterDeviceBody: Encodable {
        let apnsToken: String
        let bundleId: String
        let environment: String
    }

    struct RegisterDeviceResponse: Decodable, Sendable { let device: Device }

    func registerDevice(apnsToken: String, environment: APNSEnvironment) async throws -> Device {
        let bundle = Bundle.main.bundleIdentifier ?? "be.jeremys.snipe"
        let res: RegisterDeviceResponse = try await send(
            method: "POST",
            path: "/api/devices",
            body: RegisterDeviceBody(
                apnsToken: apnsToken,
                bundleId: bundle,
                environment: environment.rawValue
            )
        )
        return res.device
    }

    func unregisterDevice(apnsToken: String) async throws {
        let _: EmptyOk = try await send(method: "DELETE", path: "/api/devices/\(apnsToken)")
    }

    // MARK: - Request plumbing

    private struct EmptyOk: Decodable, Sendable { let ok: Bool? }

    private func send<Response: Decodable>(
        method: String,
        path: String,
        authenticated: Bool = true
    ) async throws -> Response {
        try await perform(method: method, path: path, bodyData: nil, authenticated: authenticated)
    }

    private func send<Body: Encodable, Response: Decodable>(
        method: String,
        path: String,
        body: Body,
        authenticated: Bool = true
    ) async throws -> Response {
        let data = try JSONEncoder().encode(body)
        return try await perform(method: method, path: path, bodyData: data, authenticated: authenticated)
    }

    private func send<Response: Decodable>(
        method: String,
        path: String,
        jsonObject: [AnyHashable: Any],
        authenticated: Bool = true
    ) async throws -> Response {
        let data = try JSONSerialization.data(withJSONObject: jsonObject, options: [])
        return try await perform(method: method, path: path, bodyData: data, authenticated: authenticated)
    }

    private func perform<Response: Decodable>(
        method: String,
        path: String,
        bodyData: Data?,
        authenticated: Bool
    ) async throws -> Response {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw NetworkError.malformedResponse
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        if let bodyData {
            request.httpBody = bodyData
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if authenticated, let token = TokenStore.load() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await urlSession.data(for: request)
        } catch {
            throw NetworkError.transport(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw NetworkError.malformedResponse
        }

        if http.statusCode == 401 {
            throw NetworkError.unauthorized
        }

        if !(200..<300).contains(http.statusCode) {
            let apiError = (try? JSONDecoder().decode(APIError.self, from: data))
                ?? APIError(error: "unknown", message: "HTTP \(http.statusCode)")
            throw NetworkError.api(apiError, status: http.statusCode)
        }

        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw NetworkError.decoding(error)
        }
    }
}
