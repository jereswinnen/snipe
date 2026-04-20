import SwiftUI
import Charts

/// Multi-line price chart. Each listing gets one line; colors come from
/// a fixed palette so a given shop's colour stays stable across renders
/// within a session. If only one series has data we render it as a filled
/// area for a cleaner "single store" look.
struct TrendChartView: View {
    let trend: GroupTrend

    private static let palette: [Color] = [
        .green, .blue, .purple, .orange, .pink, .yellow,
    ]

    /// (shop, [(Date, value)]).
    private var series: [(shop: String, points: [(Date, Double)])] {
        trend.series.compactMap { s in
            let points: [(Date, Double)] = s.points.compactMap { p in
                guard let date = p.date else { return nil }
                return (date, p.value)
            }
            guard !points.isEmpty else { return nil }
            return (s.shop, points)
        }
    }

    var body: some View {
        Chart {
            ForEach(Array(series.enumerated()), id: \.offset) { index, entry in
                let color = Self.palette[index % Self.palette.count]
                ForEach(Array(entry.points.enumerated()), id: \.offset) { _, point in
                    LineMark(
                        x: .value("When", point.0),
                        y: .value("Price", point.1),
                        series: .value("Shop", entry.shop)
                    )
                    .foregroundStyle(color)
                    .interpolationMethod(.monotone)
                }
                if entry.points.count == 1, let single = entry.points.first {
                    PointMark(
                        x: .value("When", single.0),
                        y: .value("Price", single.1)
                    )
                    .foregroundStyle(color)
                    .symbolSize(60)
                }
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading) { value in
                AxisGridLine()
                AxisValueLabel {
                    if let amount = value.as(Double.self) {
                        Text(Money.format(amount))
                    }
                }
            }
        }
        .chartXAxis {
            AxisMarks(preset: .aligned, values: .automatic(desiredCount: 4)) { value in
                AxisGridLine()
                AxisValueLabel(format: .dateTime.month(.abbreviated).day())
            }
        }
        .chartLegend(series.count > 1 ? .visible : .hidden)
        .frame(height: 180)
    }
}
