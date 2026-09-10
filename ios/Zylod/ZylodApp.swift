import SwiftUI

@main
struct ZylodApp: App {
    var body: some Scene {
        WindowGroup {
            // Deep links (zylod:// + https zylod.com) are handled by RootView's
            // own DeepLinkCenter via .onOpenURL — a single bus, so a URL can
            // never be routed twice. (An earlier draft also registered an
            // onOpenURL here on a second DeepLinkCenter instance; removed as
            // part of the Task 3-finish consistency pass.)
            RootView()
        }
    }
}
