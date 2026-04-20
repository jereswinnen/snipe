import Foundation
import Testing
@testable import Snipe

@Suite("Model decoding")
struct ModelDecodingTests {
    @Test func listingDecodesFullPayload() throws {
        let json = """
        {
          "id": 45,
          "groupId": 12,
          "url": "https://www.nintendo.com/nl-be/Games/x.html",
          "shop": "nintendo",
          "medium": "digital",
          "name": "Sonic Frontiers",
          "imageUrl": null,
          "soldByBol": null,
          "lastPrice": "17.99",
          "lastTotalCost": "17.99",
          "lastRegularPrice": "59.99",
          "lastSaleEndsAt": "2026-04-29T21:59:59.000Z",
          "saleEndNotifiedFor": null,
          "lastCheckedAt": "2026-04-20T09:50:00.000Z",
          "lastError": null,
          "createdAt": "2026-03-01T10:00:00.000Z",
          "updatedAt": "2026-04-20T09:50:00.000Z"
        }
        """.data(using: .utf8)!

        let listing = try JSONDecoder().decode(Listing.self, from: json)
        #expect(listing.shop == "nintendo")
        #expect(listing.mediumValue == .digital)
        #expect(listing.lastTotalCostDecimal == Decimal(string: "17.99"))
        #expect(listing.lastRegularPriceDecimal == Decimal(string: "59.99"))
        #expect(listing.isOnSale)
        #expect(listing.storeURL != nil)
    }

    @Test func listingWithoutSaleIsNotOnSale() throws {
        let json = """
        {
          "id": 1, "groupId": 1, "url": "https://a.com/x", "shop": "bol",
          "medium": "physical", "name": "x", "imageUrl": null,
          "soldByBol": true, "lastPrice": "19.99", "lastTotalCost": "19.99",
          "lastRegularPrice": null, "lastSaleEndsAt": null,
          "saleEndNotifiedFor": null, "lastCheckedAt": null,
          "lastError": null,
          "createdAt": "2026-04-20T09:50:00.000Z",
          "updatedAt": "2026-04-20T09:50:00.000Z"
        }
        """.data(using: .utf8)!

        let listing = try JSONDecoder().decode(Listing.self, from: json)
        #expect(!listing.isOnSale)
    }

    @Test func groupSummaryDecodesWithShops() throws {
        let json = """
        {
          "group": {
            "id": 12, "title": "Sonic Frontiers", "imageUrl": null,
            "targetPrice": "25.00",
            "createdAt": "2026-03-01T10:00:00.000Z",
            "updatedAt": "2026-04-20T09:50:00.000Z"
          },
          "cheapest": {
            "id": 45, "groupId": 12, "url": "https://x.com/y",
            "shop": "nintendo", "medium": "digital", "name": "Sonic",
            "imageUrl": null, "soldByBol": null,
            "lastPrice": "17.99", "lastTotalCost": "17.99",
            "lastRegularPrice": null, "lastSaleEndsAt": null,
            "saleEndNotifiedFor": null, "lastCheckedAt": null,
            "lastError": null,
            "createdAt": "2026-03-01T10:00:00.000Z",
            "updatedAt": "2026-04-20T09:50:00.000Z"
          },
          "shops": ["nintendo", "bol"]
        }
        """.data(using: .utf8)!

        let summary = try JSONDecoder().decode(GroupSummary.self, from: json)
        #expect(summary.group.title == "Sonic Frontiers")
        #expect(summary.shops == ["nintendo", "bol"])
        #expect(summary.group.targetPriceDecimal == Decimal(string: "25.00"))
    }

    @Test func apiErrorDecodes() throws {
        let json = #"{"error":"duplicate_url","message":"This URL is already tracked"}"#
            .data(using: .utf8)!
        let err = try JSONDecoder().decode(APIError.self, from: json)
        #expect(err.error == "duplicate_url")
        #expect(err.userMessage == "This URL is already tracked")
    }

    @Test func apiErrorMapsKnownCodesWithoutMessage() {
        let err = APIError(error: "unsupported_shop", message: nil)
        #expect(err.userMessage == "Unsupported shop.")
    }
}

@Suite("Formatters")
struct FormattersTests {
    @Test func moneyFromStringFormatsEuro() {
        let formatted = Money.format("17.99")
        // Output depends on locale, but will always contain 17 and 99.
        #expect(formatted.contains("17"))
        #expect(formatted.contains("99"))
    }

    @Test func shopFaviconURLResolvesKnownShops() throws {
        let url = try #require(ShopFavicon.url(for: "nintendo"))
        #expect(url.absoluteString.contains("nintendo.com"))
    }

    @Test func shopFaviconURLFallsBackForUnknownShop() throws {
        let url = try #require(ShopFavicon.url(for: "steam"))
        #expect(url.absoluteString.contains("steam.com"))
    }
}
