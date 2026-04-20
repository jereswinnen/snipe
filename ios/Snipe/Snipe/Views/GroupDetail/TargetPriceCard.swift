import SwiftUI

/// Group-level target price editor. Saves on commit (blur/return);
/// shows a green "target reached" chip when the cheapest total is at or
/// below the target.
struct TargetPriceCard: View {
    let group: ProductGroup
    let cheapest: Listing
    let onSaved: () -> Void

    @State private var draft: String = ""
    @State private var isSaving = false
    @State private var savedAt: Date?
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("TARGET PRICE")
                .font(.caption2.weight(.semibold))
                .tracking(0.5)
                .foregroundStyle(.secondary)

            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("€")
                    .font(.system(size: 32, weight: .light))
                    .foregroundStyle(.secondary)
                TextField("—", text: $draft)
                    .keyboardType(.decimalPad)
                    .font(.system(size: 32, weight: .light))
                    .monospacedDigit()
                    .focused($focused)
                    .onChange(of: focused) { _, isFocused in
                        if !isFocused { Task { await commit() } }
                    }
                    .onSubmit { Task { await commit() } }
                if isSaving {
                    ProgressView()
                } else if let savedAt, Date.now.timeIntervalSince(savedAt) < 2 {
                    Label("saved", systemImage: "checkmark")
                        .font(.caption)
                        .foregroundStyle(.green)
                }
            }

            statusLine
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: .rect(cornerRadius: 24))
        .onAppear {
            draft = group.targetPriceDecimal.map {
                NSDecimalNumber(decimal: $0).stringValue
            } ?? ""
        }
    }

    @ViewBuilder
    private var statusLine: some View {
        let current = cheapest.lastTotalCostDecimal
        if let target = group.targetPriceDecimal {
            if current <= target {
                Text("Target reached · \(Money.format(current))")
                    .font(.caption)
                    .foregroundStyle(.green)
            } else {
                let gap = (current - target) as NSDecimalNumber
                Text("\(Money.format(Decimal(string: gap.stringValue) ?? 0)) above target")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        } else {
            Text("no target set")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private func commit() async {
        let normalized = draft.replacingOccurrences(of: ",", with: ".")
        let trimmed = normalized.trimmingCharacters(in: .whitespaces)
        let value = trimmed.isEmpty ? nil : Double(trimmed)
        let existing = group.targetPriceDecimal.flatMap { (d: Decimal) -> Double? in
            Double(NSDecimalNumber(decimal: d).stringValue)
        }
        if value == existing { return }
        isSaving = true
        defer { isSaving = false }
        do {
            try await APIClient.shared.updateGroup(id: group.id, targetPrice: value)
            savedAt = .now
            onSaved()
        } catch {
            // Swallow; the next server load will re-sync state.
            print("target price save failed:", error)
        }
    }
}
