import SwiftUI
import Charts

struct GroupDetailView: View {
    let groupId: Int

    @Environment(Session.self) private var session
    @Environment(\.dismiss) private var dismiss

    @State private var detail: GroupDetail?
    @State private var trend: GroupTrend?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showAddStore = false
    @State private var isRefreshingAll = false
    @State private var showDeleteConfirm = false

    var body: some View {
        Group {
            if let detail {
                content(detail: detail)
            } else if let errorMessage {
                ContentUnavailableView(
                    "Couldn't load",
                    systemImage: "wifi.exclamationmark",
                    description: Text(errorMessage)
                )
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
        .toolbar { toolbar }
        .sheet(isPresented: $showAddStore) {
            AddURLSheet(mode: .attachTo(groupId: groupId)) {
                Task { await load() }
            }
        }
        .confirmationDialog(
            "Delete this product?",
            isPresented: $showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                Task { await deleteGroup() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This removes every tracked store for the product.")
        }
    }

    @ViewBuilder
    private func content(detail: GroupDetail) -> some View {
        let cheapest = detail.listings.first ?? detail.listings[0]

        ScrollView {
            VStack(spacing: 12) {
                hero(group: detail.group, cheapest: cheapest)

                if let trend, hasPlottableData(trend) {
                    trendCard(trend: trend)
                }

                storesCard(listings: detail.listings)

                targetPriceCard(group: detail.group, cheapest: cheapest)

                historyCard(listings: detail.listings)
            }
            .padding(.horizontal)
            .padding(.bottom, 24)
        }
    }

    private func hero(group: ProductGroup, cheapest: Listing) -> some View {
        VStack(spacing: 12) {
            HStack {
                let extra = max(0, (detail?.listings.count ?? 1) - 1)
                Text("CHEAPEST · \(cheapest.shop.uppercased())\(extra > 0 ? " · \(detail?.listings.count ?? 0) stores" : "")")
                    .font(.caption2.weight(.semibold))
                    .tracking(0.5)
                    .foregroundStyle(.secondary)
                Spacer()
                if let d = cheapest.lastCheckedAtDate {
                    Text(DateFormatting.relativeToNow(d).uppercased())
                        .font(.caption2.weight(.semibold))
                        .tracking(0.5)
                        .foregroundStyle(.secondary)
                }
            }

            if let image = group.imageURL ?? cheapest.imageURL {
                AsyncImage(url: image) { phase in
                    phase.image?.resizable().scaledToFit()
                }
                .frame(height: 180)
            }

            Text(group.title)
                .font(.title2.weight(.semibold))
                .multilineTextAlignment(.center)

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Image(systemName: cheapest.mediumValue == .digital ? "arrow.down.circle" : "shippingbox")
                    .font(.title2)
                    .foregroundStyle(.secondary)
                Text(Money.format(cheapest.lastTotalCostDecimal))
                    .font(.system(size: 40, weight: .semibold))
                if cheapest.isOnSale, let regular = cheapest.lastRegularPriceDecimal {
                    Text(Money.format(regular))
                        .font(.title3)
                        .foregroundStyle(.secondary)
                        .strikethrough()
                }
            }

            if cheapest.isOnSale, let end = cheapest.lastSaleEndsAtDate {
                Text("Sale ends \(DateFormatting.short(end))")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.green)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(.background, in: .rect(cornerRadius: 28))
    }

    private func trendCard(trend: GroupTrend) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("TREND")
                    .font(.caption2.weight(.semibold))
                    .tracking(0.5)
                    .foregroundStyle(.secondary)
                Spacer()
                if let low = trend.cheapestOverTime.map(\.value).min(),
                   let high = trend.cheapestOverTime.map(\.value).max() {
                    Text("low \(Money.format(low)) · high \(Money.format(high))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            TrendChartView(trend: trend)
        }
        .padding(20)
        .background(.background, in: .rect(cornerRadius: 24))
    }

    private func storesCard(listings: [Listing]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("STORES")
                    .font(.caption2.weight(.semibold))
                    .tracking(0.5)
                    .foregroundStyle(.secondary)
                Spacer()
                Button {
                    showAddStore = true
                } label: {
                    Label("Add store", systemImage: "plus")
                        .font(.caption.weight(.medium))
                }
            }
            .padding(.bottom, 12)

            ForEach(Array(listings.enumerated()), id: \.element.id) { index, listing in
                if index > 0 { Divider() }
                ListingRowView(
                    listing: listing,
                    isCheapest: listing.id == listings.first?.id,
                    onDelete: { Task { await deleteListing(listing) } }
                )
            }
        }
        .padding(20)
        .background(.background, in: .rect(cornerRadius: 24))
    }

    private func targetPriceCard(group: ProductGroup, cheapest: Listing) -> some View {
        TargetPriceCard(group: group, cheapest: cheapest) {
            Task { await load() }
        }
    }

    private func historyCard(listings: [Listing]) -> some View {
        HistoryCard(listings: listings)
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                Task { await refreshAll() }
            } label: {
                if isRefreshingAll {
                    ProgressView()
                } else {
                    Image(systemName: "arrow.clockwise")
                }
            }
            .disabled(isRefreshingAll)
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button(role: .destructive) {
                showDeleteConfirm = true
            } label: {
                Image(systemName: "trash")
            }
        }
    }

    // MARK: - Actions

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let detailTask = APIClient.shared.groupDetail(id: groupId)
            async let trendTask = APIClient.shared.trend(groupId: groupId)
            let (d, t) = try await (detailTask, trendTask)
            detail = d
            trend = t
            errorMessage = nil
        } catch NetworkError.unauthorized {
            await session.signOut()
        } catch {
            errorMessage = (error as? NetworkError)?.description ?? error.localizedDescription
        }
    }

    private func refreshAll() async {
        guard let listings = detail?.listings else { return }
        isRefreshingAll = true
        defer { isRefreshingAll = false }
        await withTaskGroup(of: Void.self) { group in
            for listing in listings {
                group.addTask {
                    _ = try? await APIClient.shared.checkListing(id: listing.id)
                }
            }
        }
        await load()
    }

    private func deleteListing(_ listing: Listing) async {
        do {
            let groupGone = try await APIClient.shared.deleteListing(id: listing.id)
            if groupGone {
                dismiss()
            } else {
                await load()
            }
        } catch {
            errorMessage = (error as? NetworkError)?.description ?? error.localizedDescription
        }
    }

    private func deleteGroup() async {
        do {
            try await APIClient.shared.deleteGroup(id: groupId)
            dismiss()
        } catch {
            errorMessage = (error as? NetworkError)?.description ?? error.localizedDescription
        }
    }

    private func hasPlottableData(_ trend: GroupTrend) -> Bool {
        trend.series.contains { $0.points.count >= 1 }
    }
}
