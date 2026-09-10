import Foundation
import SwiftUI

// §3.10 — faithful port of src/store/cart-store.ts.
//
// Dual-source truth:
// - LOCAL persisted store (this file; web keeps `b2b-cart-storage` in
//   localStorage). Persisted as JSON at Application Support/cart-store.json
//   (chosen over UserDefaults for atomic whole-array rewrites and easy
//   debugging; documented deviation: different medium, same semantics).
//   Merge key `productId::variantId` (cart-store.ts:70-71), tier-based
//   calculatePrice (cart-store.ts:43-56), badge = items.length ( getItemCount
//   counts distinct products, cart-store.ts:147-151).
// - SERVER (buyer-only): background POST api/cart on add (cart-store.ts
//   syncWithApiBackground), authoritative GET api/cart grouping, PUT qty,
//   DELETE item. Server 400s carry {stockAvailable}/{moq} → surfaced inline.
// Unauthenticated users keep a fully editable local cart + soft login CTA.

final class CartStore: ObservableObject {
    static let shared = CartStore()

    /// Web CartItemData verbatim (cart-store.ts:4-23).
    struct CartItemData: Codable, Identifiable, Equatable {
        var id: String
        var productId: String
        var productName: String
        var productSlug: String?
        var productImage: String?
        var variantId: String?
        var variantName: String?
        var variantValue: String?
        var quantity: Int
        var unitPrice: Double
        var totalPrice: Double
        var moq: Int
        var maxOrderQty: Int?
        var supplierId: String
        var supplierName: String
        var supplierSlug: String?
        var unit: String?
        var priceTiers: [TierRow]
    }

    @Published private(set) var items: [CartItemData] = []

    /// Per-item inline error from the server (stockAvailable / moq).
    @Published var itemErrors: [String: String] = [:]

    private let fileURL: URL

    init(fileURL: URL? = nil) {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        try? FileManager.default.createDirectory(at: appSupport, withIntermediateDirectories: true)
        self.fileURL = fileURL ?? appSupport.appendingPathComponent("cart-store.json")
        load()
        // Rehydrate-time duplicate collapse (cart-store.ts onRehydrateStorage).
        collapseDuplicates()
    }

    // MARK: - Tier pricing (cart-store.ts:43-56 exact)

    static func calculatePrice(item: CartItemData, quantity: Int) -> Double {
        var applicablePrice = item.unitPrice
        if !item.priceTiers.isEmpty {
            for tier in item.priceTiers {
                if quantity >= tier.minQty && (tier.maxQty == nil || quantity <= (tier.maxQty ?? Int.max)) {
                    applicablePrice = tier.pricePerUnit
                    break
                }
            }
        }
        return applicablePrice * Double(quantity)
    }

    static func mergeKey(productId: String, variantId: String?) -> String {
        "\(productId)::\(variantId ?? "null")"
    }

    var mergeKeyOf: (CartItemData) -> String { { Self.mergeKey(productId: $0.productId, variantId: $0.variantId) } }

    // MARK: - Mutations (cart-store.ts:65-127 exact)

    func addItem(_ item: CartItemData) {
        let key = Self.mergeKey(productId: item.productId, variantId: item.variantId)
        if let index = items.firstIndex(where: { Self.mergeKey(productId: $0.productId, variantId: $0.variantId) == key }) {
            let newQuantity = max(items[index].quantity + item.quantity, item.moq)
            let newPrice = Self.calculatePrice(item: item, quantity: newQuantity)
            items[index].quantity = newQuantity
            items[index].totalPrice = newPrice
            items[index].unitPrice = newPrice / Double(newQuantity)
        } else {
            var adjusted = item
            let adjustedQuantity = max(item.quantity, item.moq)
            let adjustedPrice = Self.calculatePrice(item: item, quantity: adjustedQuantity)
            adjusted.quantity = adjustedQuantity
            adjusted.totalPrice = adjustedPrice
            adjusted.unitPrice = adjustedPrice / Double(adjustedQuantity)
            items.append(adjusted)
        }
        persist()
        syncAddToServer(item)
    }

    func removeItem(_ itemId: String) {
        items.removeAll { $0.id == itemId }
        itemErrors.removeValue(forKey: itemId)
        persist()
    }

    func updateQuantity(_ itemId: String, quantity: Int) {
        guard let index = items.firstIndex(where: { $0.id == itemId }) else { return }
        let newPrice = Self.calculatePrice(item: items[index], quantity: quantity)
        items[index].quantity = quantity
        items[index].totalPrice = newPrice
        items[index].unitPrice = newPrice / Double(quantity)
        itemErrors.removeValue(forKey: itemId)
        persist()
        syncUpdateOnServer(itemId: itemId, quantity: quantity)
    }

    func clearCart() {
        items.removeAll()
        itemErrors.removeAll()
        persist()
    }

    // MARK: - Derived (cart-store.ts:137-151 exact)

    func getTotalBySupplier(_ supplierId: String) -> Double {
        items.filter { $0.supplierId == supplierId }.reduce(0) { $0 + $1.totalPrice }
    }

    var total: Double {
        items.reduce(0) { $0 + $1.totalPrice }
    }

    /// Distinct products — NOT summed quantity (MOQ-inflated quantities made
    /// one add-to-cart show "99+" on web; cart-store.ts:147-151).
    var itemCount: Int { items.count }

    var badgeText: String? {
        guard itemCount > 0 else { return nil }
        return itemCount > 99 ? "99+" : String(itemCount)
    }

    // MARK: - Duplicate collapse (cart-store.ts:206-226)

    private func collapseDuplicates() {
        guard items.count > 1 else { return }
        var seen: [String: CartItemData] = [:]
        var ordered: [String] = []
        for item in items {
            let key = Self.mergeKey(productId: item.productId, variantId: item.variantId)
            if var prev = seen[key] {
                let qty = prev.quantity + item.quantity
                prev.quantity = qty
                prev.totalPrice = Self.calculatePrice(item: prev, quantity: qty)
                prev.unitPrice = prev.totalPrice / Double(qty)
                seen[key] = prev
            } else {
                seen[key] = item
                ordered.append(key)
            }
        }
        let collapsed = ordered.compactMap { seen[$0] }
        if collapsed.count != items.count {
            items = collapsed
            persist()
        }
    }

    // MARK: - Persistence (Application Support/cart-store.json)

    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let stored = try? JSONDecoder().decode([CartItemData].self, from: data) else { return }
        items = stored
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(items) else { return }
        try? data.write(to: fileURL, options: .atomic)
    }

    // MARK: - Server sync (buyer-only)

    /// Locally-generated CartItemData ids use the web PDP format
    /// `cart-<productId>-<variant|default>-<ts>` (product-detail-page.tsx:347),
    /// which the server cart never produces — server rows arrive with real
    /// cart-item ids via pullServerCart. Update/delete sync must only fire for
    /// server-sourced rows (the web never syncs update/remove at all —
    /// syncWithApiBackground handles 'add' only, cart-store.ts:241-265).
    private func isServerSourced(_ itemId: String) -> Bool {
        !itemId.hasPrefix("cart-")
    }

    private func serverBase() async -> String? {
        if let cached = ServerConfig.cached() { return cached }
        return await ServerConfig.resolve()
    }

    private func syncAddToServer(_ item: CartItemData) {
        guard SessionManager.isAuthenticated else { return }
        guard let user = SessionManager.profile(), user.userType == "buyer" else { return }
        Task {
            guard let base = await serverBase(), let client = ApiClient(base: base) else { return }
            _ = try? await client.cartAdd(.init(
                productId: item.productId,
                variantId: item.variantId,
                quantity: item.quantity,
                supplierId: item.supplierId
            ))
        }
    }

    private func syncUpdateOnServer(itemId: String, quantity: Int) {
        guard isServerSourced(itemId) else { return }
        guard SessionManager.isAuthenticated else { return }
        guard let user = SessionManager.profile(), user.userType == "buyer" else { return }
        Task {
            guard let base = await serverBase(), let client = ApiClient(base: base) else { return }
            do {
                _ = try await client.cartUpdate(itemId: itemId, quantity: quantity)
            } catch let failure as ApiFailure {
                // §3.10 — 400s carry {stockAvailable}/{moq}: surface as inline
                // field errors (cart-store parity: the server is authoritative).
                let message: String
                if let stock = failure.stockAvailable {
                    message = "Only \(stock) available in stock"
                } else if let moq = failure.moq {
                    message = "Minimum order quantity is \(moq)"
                } else {
                    message = failure.error
                }
                await MainActor.run { itemErrors[itemId] = message }
            } catch {
                // Transport failure — leave the optimistic local state; the
                // authoritative pull on next sign-in/appearance reconciles.
            }
        }
    }

    func syncRemoveOnServer(itemId: String) {
        guard isServerSourced(itemId) else { return }
        guard SessionManager.isAuthenticated else { return }
        guard let user = SessionManager.profile(), user.userType == "buyer" else { return }
        Task {
            guard let base = await serverBase(), let client = ApiClient(base: base) else { return }
            _ = try? await client.cartDelete(itemId: itemId)
        }
    }

    /// Pull the authoritative server cart when signed in as a buyer, merging
    /// server items that are not locally present (cart-store.syncWithApi parity).
    func pullServerCart() async {
        guard SessionManager.isAuthenticated,
              let user = SessionManager.profile(), user.userType == "buyer",
              let base = await serverBase(), let client = ApiClient(base: base) else { return }
        guard let envelope = try? await client.serverCart(), envelope.success == true, let cart = envelope.data else { return }

        var serverItems: [CartItemData] = []
        for supplier in cart.suppliers ?? [] {
            for row in supplier.items {
                let product = row.product
                serverItems.append(CartItemData(
                    id: row.id,
                    productId: row.productId,
                    productName: product?.name ?? "",
                    productSlug: product?.slug,
                    productImage: product?.thumbnailUrl,
                    variantId: row.variantId,
                    variantName: row.variant?.variantName,
                    variantValue: row.variant?.variantValue,
                    quantity: row.quantity,
                    unitPrice: row.variant?.priceOverride ?? product?.basePrice ?? 0,
                    totalPrice: Double(row.quantity) * (row.variant?.priceOverride ?? product?.basePrice ?? 0),
                    moq: product?.moq ?? 1,
                    maxOrderQty: nil,
                    supplierId: row.supplierId ?? supplier.supplierId,
                    supplierName: supplier.supplierName ?? "",
                    supplierSlug: nil,
                    unit: product?.unit,
                    priceTiers: (product?.priceTiers ?? []).map { TierRow(minQty: $0.minQty, maxQty: $0.maxQty, pricePerUnit: $0.pricePerUnit) }
                ))
            }
        }
        // Merge: keep local rows, add server rows not locally present.
        await MainActor.run {
            let localKeys = Set(self.items.map { Self.mergeKey(productId: $0.productId, variantId: $0.variantId) })
            let newFromServer = serverItems.filter { !localKeys.contains(Self.mergeKey(productId: $0.productId, variantId: $0.variantId)) }
            if !newFromServer.isEmpty {
                self.items.append(contentsOf: newFromServer)
                self.persist()
            }
        }
    }
}
