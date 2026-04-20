import SwiftUI
import UIKit

extension Color {
    /// Full-view background. Matches the default `List` backdrop — a faint
    /// gray in light mode and near-black in dark mode — so the app sits
    /// on the same neutral surface the system uses for grouped content.
    static let snipeBackground = Color(uiColor: .systemGroupedBackground)

    /// Card background. White in light mode, elevated dark-gray in dark
    /// mode. Matches a default List row / Form section.
    static let snipeCard = Color(uiColor: .secondarySystemGroupedBackground)
}
