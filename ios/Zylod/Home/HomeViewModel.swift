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
        let client = self.client ?? ApiClient(base: base)
        self.client = client

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
