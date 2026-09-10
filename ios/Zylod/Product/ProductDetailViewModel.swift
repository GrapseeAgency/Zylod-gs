import Foundation
import UIKit

// §3.9 product-detail view model — port of the mobile-product-detail-page.tsx
// data layer (load → GET api/products/[id] + optional sub-fetches) fused with
// the desktop handlers the frozen spec mandates (add-to-cart w/ MOQ+stock
// validation, buyNow → POST api/orders/create-direct exactly like
// product-detail-page.tsx:392-427, wishlist toggle POST/DELETE api/wishlist).
//
// Active tier uses the mobile scan (last tier whose minQty ≤ quantity, mobile
// product-detail-page.tsx:104-111); variant price uses priceOverride, the same
// field the server cart rows carry ([itemId] GET parity).

@MainActor
final class ProductDetailViewModel: ObservableObject {
    enum Tab: Int, CaseIterable {
        case details, specs, reviews, qa

        var label: String {
            switch self {
            case .details: return "Details"
            case .specs: return "Specifications"
            case .reviews: return "Reviews"
            case .qa: return "Q&A"
            }
        }
    }

    struct OrderConfirmation: Identifiable {
        let order: DirectOrder
        var id: String { order.orderId }
    }

    // MARK: Published state

    @Published var loading = true
    @Published var error: String?
    @Published var product: ProductDetail?
    @Published var serverUrl = ""
    /// Flattened groupedSpecifications (mobile specifications map).
    @Published var specifications: [(name: String, value: String)] = []
    @Published var qa: [QAItem] = []
    @Published var quantity = 1
    @Published var selectedVariantId: String?
    @Published var activeTab: Tab = .details
    @Published var isWishlisted = false
    @Published var wishlistLoading = false
    @Published var justAdded = false
    @Published var buyingNow = false
    @Published var orderConfirmation: OrderConfirmation?
    @Published var galleryIndex = 0

    private let productId: String
    private let cartStore: CartStore
    private var loadTask: Task<Void, Never>?

    init(productId: String, cartStore: CartStore = .shared) {
        self.productId = productId
        self.cartStore = cartStore
    }

    // MARK: Derived (web getApplicablePrice / currentVariantStock)

    var priceTiers: [PriceTier] { product?.priceTiers ?? [] }

    /// Mobile activeTier scan: highest tier whose minQty the quantity meets.
    var activeTier: PriceTier? {
        let tiers = priceTiers
        guard !tiers.isEmpty else { return nil }
        for tier in tiers.reversed() where quantity >= tier.minQty {
            return tier
        }
        return tiers[0]
    }

    var selectedVariant: ProductVariant? {
        guard let selectedVariantId, let variants = product?.variants else { return nil }
        return variants.first { $0.id == selectedVariantId }
    }

    var currentStock: Int {
        if let variant = selectedVariant { return variant.stockQuantity ?? 0 }
        return product?.stockQuantity ?? 0
    }

    var moq: Int { product?.moq ?? 1 }

    var unit: String { product?.unit ?? "pcs" }

    /// getApplicablePrice parity: tier price, then variant priceOverride.
    var applicablePrice: Double {
        var price = product?.basePrice ?? 0
        if let tier = activeTier { price = tier.pricePerUnit }
        if let override = selectedVariant?.priceOverride { price = override }
        return price
    }

    var totalPrice: Double { applicablePrice * Double(quantity) }

    var outOfStock: Bool { currentStock <= 0 }

    var belowMoq: Bool { quantity < moq }

    /// Web getStockStatus(currentVariantStock, maxStock).
    var stockStatus: (text: String, inStock: Bool) {
        let maxStock = product?.stockQuantity ?? 0
        if currentStock <= 0 { return ("Out of Stock", false) }
        if maxStock > 0, Double(currentStock) < Double(maxStock) * 0.2 { return ("Low Stock", true) }
        return ("In Stock", true)
    }

    /// Sorted gallery urls (sortOrder), thumbnail fallback (mobile:200).
    var galleryImages: [String] {
        let images = (product?.images ?? []).filter { !($0.imageUrl ?? "").isEmpty }
        let sorted = images.sorted { ($0.sortOrder ?? 0) < ($1.sortOrder ?? 0) }.compactMap { $0.imageUrl }
        if !sorted.isEmpty { return sorted }
        if let thumb = product?.thumbnailUrl, !thumb.isEmpty { return [thumb] }
        return []
    }

    /// The scannable/shareable product URL — the SPA's own origin + deep-link
    /// params (product-qr-code.tsx getShareUrl parity; origin = active server).
    var productUrl: String? {
        guard let base = serverUrl.isEmpty ? ServerConfig.cached() : serverUrl, !base.isEmpty else { return nil }
        let trimmed = base.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let encodedId = productId.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? productId
        return "\(trimmed)/?page=product-detail&productId=\(encodedId)"
    }

    var shareText: String? {
        guard let product else { return nil }
        return "Check out \(product.name) - \(ZylodFormat.bdt(product.basePrice ?? 0)) on Zylod — Bangladesh's B2B Wholesale Marketplace!"
    }

    // MARK: Load (mobile useEffect:72-101)

    func load() {
        loadTask?.cancel()
        loading = product == nil
        error = nil
        loadTask = Task { [weak self] in
            await self?.fetchProduct()
        }
    }

    func cancelPending() {
        loadTask?.cancel()
    }

    private func fetchProduct() async {
        guard !productId.isEmpty else {
            error = "Product not found"
            loading = false
            return
        }
        do {
            guard let client = await AuthSession.client() else {
                error = "Invalid server address"
                loading = false
                return
            }
            let envelope = try await client.productDetail(productId)
            guard !Task.isCancelled else { return }
            guard envelope.success == true, let detail = envelope.data else {
                error = "Product not found"
                loading = false
                return
            }
            serverUrl = ServerConfig.cached() ?? ""
            product = detail
            quantity = max(detail.moq ?? 0, 1)   // mobile:82 setQuantity(moq || 50); moq is optional on the wire
            selectedVariantId = nil
            loading = false

            // Optional sub-fetches — contained failures (try? maps both the
            // network error AND task cancellation to nil, HomeViewModel D3
            // pattern). The mobile port basis fetches specifications only;
            // Q&A powers the §3.9 tab. Desktop's similar/frequently-bought
            // sections are Phase 2 layout items, intentionally not fetched.
            async let specsCall = client.productSpecifications(productId)
            async let qaCall = client.productQA(productId)
            let specs = try? await specsCall
            let qaRows = try? await qaCall
            guard !Task.isCancelled else { return }

            if let grouped = specs?.data?.groupedSpecifications {
                specifications = grouped
                    .flatMap { group in group.value.map { (name: $0.specName, value: $0.specValue) } }
            }
            qa = qaRows?.data ?? []
        } catch let failure as ApiFailure {
            guard !Task.isCancelled else { return }
            error = failure.status == 404 ? "Product not found" : failure.error
            loading = false
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            self.error = "Network error. Please check your connection and try again."
            loading = false
        }
    }

    // MARK: Quantity / variants

    /// handleQuantityChange (mobile:171-173) — MOQ floor, ±step.
    func changeQuantity(by delta: Int) {
        quantity = max(moq, quantity + delta)
    }

    func selectVariant(_ id: String?) {
        selectedVariantId = id
    }

    // MARK: Add to cart (desktop handleAddToCart:340-373 + mobile:116-148)

    func addToCart() {
        guard let product, let supplier = product.supplier else { return }
        guard !outOfStock else {
            ToastCenter.shared.show("This product is out of stock", tone: .error)
            return
        }
        guard !belowMoq else {
            ToastCenter.shared.show("Minimum order quantity is \(moq) \(unit)", tone: .error)
            return
        }

        let alreadyInCart = cartStore.items.contains { $0.productId == product.id }
        let item = CartStore.CartItemData(
            id: "cart-\(product.id)-\(selectedVariantId ?? "default")-\(Int(Date().timeIntervalSince1970 * 1000))",
            productId: product.id,
            productName: product.name,
            productSlug: product.slug,
            productImage: product.thumbnailUrl,
            variantId: selectedVariantId,
            variantName: selectedVariant?.variantName,
            variantValue: selectedVariant?.variantValue,
            quantity: quantity,
            unitPrice: applicablePrice,
            totalPrice: totalPrice,
            moq: moq,
            maxOrderQty: product.maxOrderQty ?? product.stockQuantity,
            supplierId: supplier.id,
            supplierName: supplier.companyName ?? "",
            supplierSlug: supplier.slug,
            unit: product.unit,
            priceTiers: priceTiers.map { TierRow(minQty: $0.minQty, maxQty: $0.maxQty, pricePerUnit: $0.pricePerUnit) }
        )
        cartStore.addItem(item)

        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        justAdded = true
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            guard !Task.isCancelled else { return }
            self?.justAdded = false
        }
        if alreadyInCart {
            ToastCenter.shared.show("Already in your cart — quantity updated to \(quantity)", tone: .info)
        } else {
            ToastCenter.shared.show("Added to cart — \(product.name)", tone: .success)
        }
    }

    // MARK: Buy now (product-detail-page.tsx handleBuyNow:392-427 exact)

    func buyNow() async {
        guard let product, let supplier = product.supplier else { return }
        guard SessionManager.isAuthenticated else {
            ToastCenter.shared.show("Please sign in to place orders", tone: .info)
            return
        }
        guard !outOfStock, !belowMoq else { return }

        buyingNow = true
        defer { buyingNow = false }
        do {
            guard let client = await AuthSession.client() else {
                ToastCenter.shared.show("Invalid server address", tone: .error)
                return
            }
            let envelope = try await client.createDirectOrder(.init(
                productId: product.id,
                quantity: quantity,
                unitPrice: applicablePrice,
                supplierId: supplier.id,
                variantId: selectedVariantId,
                paymentMethod: "cod"
            ))
            if envelope.success == true, let order = envelope.data {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                ToastCenter.shared.show("Order placed! \(order.orderNumber) created successfully", tone: .success)
                orderConfirmation = OrderConfirmation(order: order)
            } else {
                ToastCenter.shared.show("Order Failed — could not place order", tone: .error)
            }
        } catch let failure as ApiFailure {
            ToastCenter.shared.show("Order Failed — \(failure.error)", tone: .error)
        } catch {
            ToastCenter.shared.show("Order Failed — could not place order. Please try again.", tone: .error)
        }
    }

    // MARK: Wishlist (product-detail-page.tsx handleWishlistToggle:267-301)

    func toggleWishlist() {
        guard let product else { return }
        guard SessionManager.isAuthenticated else {
            ToastCenter.shared.show("Sign in to save products to your wishlist", tone: .info)
            return
        }
        guard !wishlistLoading else { return }
        wishlistLoading = true
        let target = !isWishlisted
        Task { [weak self] in
            defer { self?.wishlistLoading = false }
            do {
                guard let client = await AuthSession.client() else { return }
                let response = target
                    ? try await client.wishlistAdd(productId: product.id)
                    : try await client.wishlistRemove(productId: product.id)
                guard response.success == true else {
                    ToastCenter.shared.show("Could not update your wishlist", tone: .error)
                    return
                }
                self?.isWishlisted = target
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                ToastCenter.shared.show(
                    target ? "Added to Wishlist — \(product.name)" : "Removed from Wishlist — \(product.name)",
                    tone: .success
                )
            } catch {
                // Web fallback: keep the local toggle so the control stays honest.
                self?.isWishlisted = target
                ToastCenter.shared.show(
                    target ? "Added to Wishlist — \(product.name)" : "Removed from Wishlist — \(product.name)",
                    tone: .info
                )
            }
        }
    }
}
