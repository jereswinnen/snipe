import SwiftUI

/// One tile in the homepage grid. Mirrors the web design: a stack of
/// shop favicons in the top-left, relative checked-at time top-right,
/// the product image centred, title, price with optional strikethrough,
/// and a trimmed sale/was-price line.
struct GroupCardView: View {
    let summary: GroupSummary

    private var listing: Listing { summary.cheapest }

    var body: some View {
        VStack(alignment: .center, spacing: 12) {
            header

            if let image = summary.group.imageURL ?? listing.imageURL {
                AsyncImage(url: image) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().scaledToFit()
                    default:
                        Color.clear
                    }
                }
                .frame(height: 110)
            } else {
                Color.clear.frame(height: 110)
            }

            Text(summary.group.title)
                .font(.footnote.weight(.medium))
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)

            priceBlock
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .background(.background, in: .rect(cornerRadius: 24))
        .overlay(alignment: .topLeading) {
            if targetMet {
                RoundedRectangle(cornerRadius: 24)
                    .strokeBorder(.green.opacity(0.5), lineWidth: 2)
            }
        }
    }

    private var header: some View {
        HStack {
            ShopFaviconStack(shops: summary.shops)
            Spacer()
            HStack(spacing: 4) {
                if listing.lastError != nil {
                    Circle().fill(.red).frame(width: 6, height: 6)
                }
                if let date = listing.lastCheckedAtDate {
                    Text(DateFormatting.relativeToNow(date).uppercased())
                } else {
                    Text("—")
                }
            }
            .font(.system(size: 10, weight: .semibold))
            .tracking(0.5)
            .foregroundStyle(.secondary)
        }
    }

    private var priceBlock: some View {
        VStack(spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: listing.mediumValue == .digital ? "arrow.down.circle" : "shippingbox")
                    .foregroundStyle(.secondary)
                    .font(.caption)
                Text(Money.format(listing.lastTotalCostDecimal))
                    .font(.headline)
                if listing.isOnSale, let regular = listing.lastRegularPriceDecimal {
                    Text(Money.format(regular))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .strikethrough()
                }
            }

            if listing.isOnSale, let end = listing.lastSaleEndsAtDate {
                Text("Sale ends \(DateFormatting.short(end))")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.green)
            }
        }
    }

    private var targetMet: Bool {
        guard let target = summary.group.targetPriceDecimal else { return false }
        return listing.lastTotalCostDecimal <= target
    }
}

/// Overlapping stack of favicons. Cheapest shop first; subsequent shops
/// overlap ~5pt to the left so a multi-store group reads as a "stack".
struct ShopFaviconStack: View {
    let shops: [String]

    var body: some View {
        HStack(spacing: -6) {
            ForEach(Array(shops.prefix(4).enumerated()), id: \.offset) { index, shop in
                AsyncImage(url: ShopFavicon.url(for: shop)) { phase in
                    if let img = phase.image {
                        img.resizable()
                    } else {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(.quaternary)
                    }
                }
                .frame(width: 16, height: 16)
                .clipShape(RoundedRectangle(cornerRadius: 3))
                .overlay(
                    RoundedRectangle(cornerRadius: 3)
                        .strokeBorder(Color(.systemBackground), lineWidth: 1.5)
                )
                .zIndex(Double(shops.count - index))
            }
        }
    }
}

enum ShopFavicon {
    static func url(for shop: String) -> URL? {
        let domain: String
        switch shop {
        case "bol": domain = "bol.com"
        case "coolblue": domain = "coolblue.be"
        case "allyourgames": domain = "allyourgames.nl"
        case "nedgame": domain = "nedgame.nl"
        case "nintendo": domain = "nintendo.com"
        case "dreamland": domain = "dreamland.be"
        default: domain = "\(shop).com"
        }
        return URL(string: "https://www.google.com/s2/favicons?domain=\(domain)&sz=64")
    }
}
