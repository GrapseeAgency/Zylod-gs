import SwiftUI

@main
struct ZylodApp: App {
    init() {
        // F5 — permanent provenance visibility: one line at every launch so
        // `log stream --predicate 'category == "ZylodProvenance"'` proves
        // exactly which build is running and which endpoints it will consider
        // (docs/PROVENANCE.md).
        WebProvenance.logAppIdentity(candidates: ServerConfig.candidates)
    }

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
