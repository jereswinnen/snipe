import Foundation

/// Resolves a shop identifier to its Google favicon-service URL. Used by
/// the card header stack and the detail listing rows.
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
        case "playstation": domain = "playstation.com"
        default: domain = "\(shop).com"
        }
        return URL(string: "https://www.google.com/s2/favicons?domain=\(domain)&sz=64")
    }
}
