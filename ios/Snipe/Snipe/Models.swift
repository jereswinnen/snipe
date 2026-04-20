import Foundation

// MARK: - Enums

enum Medium: String, Codable, CaseIterable, Sendable {
    case digital
    case physical
}

enum Shop: String, Codable, Hashable, Sendable {
    case bol, coolblue, allyourgames, nedgame, nintendo, dreamland

    /// Opaque fallback for shops we don't know yet. Keeps decoding resilient
    /// if the server adds a shop before the app is updated.
    static func parse(_ raw: String) -> Shop? { Shop(rawValue: raw) }
}

enum APNSEnvironment: String, Codable, Sendable {
    case sandbox
    case production

    /// Debug (Xcode-run) builds register under sandbox APNs; everything
    /// else goes to production. TestFlight and App Store builds both use
    /// the production APNs host since iOS 14.
    static var current: Self {
        #if DEBUG
        return .sandbox
        #else
        return .production
        #endif
    }
}

// MARK: - DTOs

/// One product across stores. Owns title, image, target price.
struct ProductGroup: nonisolated Codable, Identifiable, Hashable, Sendable {
    let id: Int
    let title: String
    let imageUrl: String?
    let targetPrice: String?
    let createdAt: String
    let updatedAt: String

    var targetPriceDecimal: Decimal? { targetPrice.flatMap { Decimal(string: $0) } }
    var imageURL: URL? { imageUrl.flatMap { SnipeURL.from($0) } }
}

/// One URL tracked on one shop. Belongs to a group.
struct Listing: nonisolated Codable, Identifiable, Hashable, Sendable {
    let id: Int
    let groupId: Int?
    let url: String
    let shop: String
    let medium: String
    let name: String
    let imageUrl: String?
    let soldByBol: Bool?
    let lastPrice: String
    let lastTotalCost: String
    let lastRegularPrice: String?
    let lastSaleEndsAt: String?
    let saleEndNotifiedFor: String?
    let lastCheckedAt: String?
    let lastError: String?
    let createdAt: String
    let updatedAt: String

    var storeURL: URL? { SnipeURL.from(url) }
    var imageURL: URL? { imageUrl.flatMap { SnipeURL.from($0) } }
    var mediumValue: Medium? { Medium(rawValue: medium) }
    var shopValue: Shop? { Shop.parse(shop) }

    var lastTotalCostDecimal: Decimal { Decimal(string: lastTotalCost) ?? 0 }
    var lastRegularPriceDecimal: Decimal? { lastRegularPrice.flatMap { Decimal(string: $0) } }

    var lastSaleEndsAtDate: Date? {
        lastSaleEndsAt.flatMap { DateParser.iso.date(from: $0) }
    }

    var lastCheckedAtDate: Date? {
        lastCheckedAt.flatMap { DateParser.iso.date(from: $0) }
    }

    /// True when the listing currently shows a discount that hasn't expired.
    var isOnSale: Bool {
        guard let end = lastSaleEndsAtDate, lastRegularPriceDecimal != nil else {
            return false
        }
        return end > .now
    }
}

/// Homepage row: group + its cheapest listing + every shop that's tracked.
struct GroupSummary: nonisolated Codable, Identifiable, Hashable, Sendable {
    let group: ProductGroup
    let cheapest: Listing
    let shops: [String]

    var id: Int { group.id }
}

/// Full group detail payload.
struct GroupDetail: nonisolated Codable, Sendable {
    let group: ProductGroup
    let listings: [Listing]
}

/// Single point on a trend or history chart.
struct TrendPoint: nonisolated Codable, Hashable, Sendable {
    let checkedAt: String
    let value: Double

    var date: Date? { DateParser.iso.date(from: checkedAt) }
}

/// One listing's trend series within a group.
struct TrendSeries: nonisolated Codable, Hashable, Sendable, Identifiable {
    let shop: String
    let listingId: Int
    let points: [TrendPoint]

    var id: Int { listingId }
    var shopValue: Shop? { Shop.parse(shop) }
}

/// Response from GET /api/groups/[id]/trend.
struct GroupTrend: nonisolated Codable, Sendable {
    let days: Int
    let series: [TrendSeries]
    let cheapestOverTime: [TrendPoint]
}

/// One history row for a single listing.
struct PricePoint: nonisolated Codable, Hashable, Sendable {
    let checkedAt: String
    let price: Double
    let totalCost: Double

    var date: Date? { DateParser.iso.date(from: checkedAt) }
}

/// Response from GET /api/listings/[id]/history.
struct ListingHistory: nonisolated Codable, Sendable {
    let days: Int
    let points: [PricePoint]
}

/// Outcome of POST /api/listings/[id]/check.
struct CheckOutcome: nonisolated Codable, Sendable {
    let ok: Bool
    let changed: Bool?
    let price: Double?
    let totalCost: Double?
    let error: String?
}

/// Device row returned from POST /api/devices.
struct Device: nonisolated Codable, Identifiable, Sendable {
    let id: Int
    let apnsToken: String
    let bundleId: String
    let environment: String
    let createdAt: String
    let lastSeenAt: String
}

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
