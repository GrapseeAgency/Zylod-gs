import Foundation

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var loading = true
    @Published var error: String?
    @Published var serverUrl = ""
    @Published var categories: [Category] = []
    @Published var deals: [Deal] = []
    @Published var products: [Product] = []
    @Published var stats = Stats()
    @Published var page = 1
    @Published var totalPages = 1
    @Published var loadingMore = false

    private var client: ApiClient?

    // Mirrors android HomeViewModel.refresh(): parallel section loads, each
    // failure contained (nil), error states distinguish unreachable vs unhealthy.
    func refresh() async {
        loading = true
        error = nil
        let base = await ServerConfig.resolve()
        let client: ApiClient
        if let existing = self.client {
            client = existing
        } else if let created = ApiClient(base: base) {
            client = created
            self.client = created
        } else {
            // Corrupted cached base URL — don't crash, surface it (D2 fix).
            error = "Invalid server address"
            loading = false
            return
        }

        async let categoriesCall = client.categories()
        async let dealsCall = client.deals()
        async let productsCall = client.products(page: 1)
        async let productTotal = client.productCount()
        async let supplierTotal = client.supplierCount()

        let categoriesResult = try? await categoriesCall
        let dealsResult = try? await dealsCall
        let productsResult = try? await productsCall
        let productTotalResult = try? await productTotal
        let supplierTotalResult = try? await supplierTotal

        // A cancelled refresh (view torn down mid-flight, or one section
        // cancelled after another succeeded) must never publish a false
        // error state — `try?` maps cancellation to nil, so EVERY error
        // branch below must be gated on it (D3 fix — parity with Android's
        // safeCall rethrowing CancellationException).
        guard !Task.isCancelled else {
            loading = false
            return
        }
        if categoriesResult == nil && productsResult == nil {
            error = "Can't reach Zylod servers"
            loading = false
            return
        }
        if categoriesResult?.success != true || productsResult?.success != true {
            error = "Server error — the backend is unhealthy"
            loading = false
            return
        }

        serverUrl = base
        categories = Array((categoriesResult?.data ?? []).prefix(12))
        deals = Array((dealsResult?.data?.all ?? []).prefix(8))
        products = productsResult?.data ?? []
        page = productsResult?.pagination?.page ?? 1
        totalPages = productsResult?.pagination?.totalPages ?? 1
        stats = Stats(
            productCount: productTotalResult?.pagination?.total ?? 0,
            supplierCount: supplierTotalResult?.pagination?.total ?? 0
        )
        loading = false
    }

    func loadMore() async {
        guard !loadingMore, page < totalPages, error == nil else { return }
        loadingMore = true
        defer { loadingMore = false }
        guard let client else { return }
        let nextPage = page + 1
        guard let result = try? await client.products(page: nextPage) else { return }
        products += result.data ?? []
        page = result.pagination?.page ?? nextPage
        totalPages = result.pagination?.totalPages ?? totalPages
    }
}
