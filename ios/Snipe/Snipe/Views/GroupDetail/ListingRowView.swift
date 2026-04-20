import SwiftUI

/// One row inside the Stores card on the detail screen. Tapping opens the
/// store page in Safari; the trailing trash button deletes the listing.
struct ListingRowView: View {
    let listing: Listing
    let isCheapest: Bool
    let onDelete: () -> Void

    @State private var showDeleteConfirm = false

    var body: some View {
        HStack(spacing: 12) {
            AsyncImage(url: ShopFavicon.url(for: listing.shop)) { phase in
                if let img = phase.image {
                    img.resizable()
                } else {
                    RoundedRectangle(cornerRadius: 3).fill(.quaternary)
                }
            }
            .frame(width: 20, height: 20)
            .clipShape(RoundedRectangle(cornerRadius: 3))

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(listing.shop.capitalized)
                        .font(.subheadline.weight(isCheapest ? .semibold : .medium))
                    if isCheapest {
                        Text("CHEAPEST")
                            .font(.system(size: 10, weight: .semibold))
                            .tracking(0.5)
                            .foregroundStyle(.green)
                    }
                }
                HStack(spacing: 6) {
                    Text(listing.medium)
                        .textCase(.lowercase)
                    if listing.isOnSale, let end = listing.lastSaleEndsAtDate {
                        Text("· sale ends \(DateFormatting.short(end))")
                            .foregroundStyle(.green)
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(Money.format(listing.lastTotalCostDecimal))
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                if listing.isOnSale, let regular = listing.lastRegularPriceDecimal {
                    Text(Money.format(regular))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .strikethrough()
                        .monospacedDigit()
                }
            }

            Button {
                showDeleteConfirm = true
            } label: {
                Image(systemName: "trash")
                    .foregroundStyle(.red.opacity(0.8))
            }
            .buttonStyle(.borderless)
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        .onTapGesture {
            if let url = listing.storeURL {
                UIApplication.shared.open(url)
            }
        }
        .confirmationDialog(
            "Remove \(listing.shop) from this product?",
            isPresented: $showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Remove", role: .destructive) { onDelete() }
            Button("Cancel", role: .cancel) {}
        }
    }
}
