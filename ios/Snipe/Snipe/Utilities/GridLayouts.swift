import Foundation
import SwiftUI

enum GridLayouts {
    // MARK: - Default tokens

    private static let defaultColumnsCompact = 2
    private static let defaultColumnsRegular = 5
    private static let defaultSpacingCompact: CGFloat = 12
    private static let defaultSpacingRegular: CGFloat = 20

    // MARK: - Public helpers

    static func columns(
        for sizeClass: UserInterfaceSizeClass?,
        compact: Int? = nil,
        regular: Int? = nil
    ) -> Int {
        switch sizeClass {
        case .compact:
            return compact ?? defaultColumnsCompact
        default:
            return regular ?? defaultColumnsRegular
        }
    }

    static func spacing(
        for sizeClass: UserInterfaceSizeClass?,
        compact: CGFloat? = nil,
        regular: CGFloat? = nil
    ) -> CGFloat {
        switch sizeClass {
        case .compact:
            return compact ?? defaultSpacingCompact
        default:
            return regular ?? defaultSpacingRegular
        }
    }

    static func gridItems(
        for sizeClass: UserInterfaceSizeClass?,
        columnsCompact: Int? = nil,
        columnsRegular: Int? = nil,
        spacingCompact: CGFloat? = nil,
        spacingRegular: CGFloat? = nil,
        alignment: Alignment = .top
    ) -> [GridItem] {
        let count = columns(
            for: sizeClass,
            compact: columnsCompact,
            regular: columnsRegular
        )

        let spacing = spacing(
            for: sizeClass,
            compact: spacingCompact,
            regular: spacingRegular
        )

        return Array(
            repeating: GridItem(
                .flexible(),
                spacing: spacing,
                alignment: alignment
            ),
            count: count
        )
    }
}
