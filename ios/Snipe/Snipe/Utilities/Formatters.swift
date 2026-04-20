import Foundation

nonisolated enum Money {
    private static let formatter: NumberFormatter = {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "nl_BE")
        f.numberStyle = .currency
        f.currencyCode = "EUR"
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        return f
    }()

    nonisolated static func format(_ value: Decimal) -> String {
        formatter.string(from: NSDecimalNumber(decimal: value)) ?? "€0,00"
    }

    nonisolated static func format(_ string: String) -> String {
        Decimal(string: string).map(format) ?? string
    }

    nonisolated static func format(_ double: Double) -> String {
        format(Decimal(double))
    }
}

nonisolated enum DateFormatting {
    private static let shortDate: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nl_BE")
        f.setLocalizedDateFormatFromTemplate("d MMM")
        return f
    }()

    private static let fullDateTime: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nl_BE")
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()

    private static let relative: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .abbreviated
        f.locale = Locale(identifier: "en")
        return f
    }()

    nonisolated static func short(_ date: Date) -> String { shortDate.string(from: date) }
    nonisolated static func full(_ date: Date) -> String { fullDateTime.string(from: date) }

    nonisolated static func relativeToNow(_ date: Date) -> String {
        let elapsed = Date.now.timeIntervalSince(date)
        if elapsed < 60 { return "just now" }
        return relative.localizedString(for: date, relativeTo: .now)
    }
}
