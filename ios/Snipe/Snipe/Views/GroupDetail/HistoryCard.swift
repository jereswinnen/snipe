import SwiftUI

/// Unified history timeline across every listing in the group. Loads
/// per-listing history in parallel and interleaves newest-first, capped
/// at 200 rows so we never render an unbounded list.
struct HistoryCard: View {
    let listings: [Listing]

    struct Row: Identifiable, Hashable {
        let id: String
        let listingId: Int
        let shop: String
        let date: Date
        let totalCost: Double
        let price: Double
    }

    @State private var rows: [Row] = []
    @State private var isLoading = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("HISTORY")
                .font(.caption2.weight(.semibold))
                .tracking(0.5)
                .foregroundStyle(.secondary)

            if isLoading && rows.isEmpty {
                ProgressView()
            } else if rows.isEmpty {
                Text("No history yet.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                    if index > 0 { Divider() }
                    HStack(spacing: 12) {
                        Text(DateFormatting.full(row.date))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        if listings.count > 1 {
                            Text(row.shop.uppercased())
                                .font(.system(size: 10, weight: .semibold))
                                .tracking(0.5)
                                .foregroundStyle(.secondary)
                        }
                        Text(Money.format(row.totalCost))
                            .font(.subheadline.weight(.medium))
                            .monospacedDigit()
                    }
                    .padding(.vertical, 6)
                }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.snipeCard, in: .rect(cornerRadius: 24))
        .task(id: listings.map(\.id)) { await load() }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        var aggregate: [Row] = []
        await withTaskGroup(of: (Int, String, ListingHistory)?.self) { group in
            for listing in listings {
                group.addTask {
                    guard let history = try? await APIClient.shared.listingHistory(
                        id: listing.id,
                        days: 365
                    ) else { return nil }
                    return (listing.id, listing.shop, history)
                }
            }
            for await result in group {
                guard let (listingId, shop, history) = result else { continue }
                for point in history.points {
                    guard let date = point.date else { continue }
                    aggregate.append(
                        Row(
                            id: "\(listingId)-\(point.checkedAt)",
                            listingId: listingId,
                            shop: shop,
                            date: date,
                            totalCost: point.totalCost,
                            price: point.price
                        )
                    )
                }
            }
        }
        rows = aggregate
            .sorted { $0.date > $1.date }
            .prefix(200)
            .map { $0 }
    }
}
