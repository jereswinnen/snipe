import SwiftUI

// MARK: - Platform Detection

enum Platform: CaseIterable, CustomStringConvertible {
    case iPhone
    case iPad
    case mac
    case macCatalyst
    case unknown

    var description: String {
        switch self {
        case .iPhone: return "iPhone"
        case .iPad: return "iPad"
        case .mac: return "Mac"
        case .macCatalyst: return "Mac Catalyst"
        case .unknown: return "Unknown"
        }
    }

    var isDesktop: Bool {
        self == .mac || self == .macCatalyst
    }

    var isMobile: Bool {
        self == .iPhone || self == .iPad
    }
}

// MARK: - Device Context

struct Device {
    let platform: Platform
    let sizeClassX: UserInterfaceSizeClass?

    // MARK: - Direct access to your exact conditionals

    var isDesktop: Bool {
        platform.isDesktop
    }

    var isMac: Bool {
        platform == .mac
    }

    var isMacCatalyst: Bool {
        platform == .macCatalyst
    }

    var isLargeDevice: Bool {
        if isDesktop {
            return true
        }
        return platform == .iPad && sizeClassX == .regular
    }

    var isCompactDevice: Bool {
        sizeClassX == .compact
    }

    var isRegularDevice: Bool {
        sizeClassX == .regular
    }

    var isTabletOrDesktop: Bool {
        platform == .iPad || isDesktop
    }

    var isMobile: Bool {
        platform.isMobile
    }
}

// MARK: - Environment Key

private struct DeviceEnvironmentKey: EnvironmentKey {
    static let defaultValue = Device(
        platform: {
            #if os(macOS)
            return .mac
            #elseif os(iOS)
            switch UIDevice.current.userInterfaceIdiom {
            case .pad: return .iPad
            case .phone: return .iPhone
            default: return .unknown
            }
            #else
            return .unknown
            #endif
        }(),
        sizeClassX: nil
    )
}

// MARK: - Environment Values Extension

extension EnvironmentValues {
    var device: Device {
        get {
            // Update with current horizontal size class
            Device(
                platform: self[DeviceEnvironmentKey.self].platform,
                sizeClassX: horizontalSizeClass
            )
        }
        set { self[DeviceEnvironmentKey.self] = newValue }
    }
}
