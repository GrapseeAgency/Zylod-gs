import SwiftUI

// §3.10 Cart — port of src/components/pages/cart-page.tsx on top of the
// dual-source CartStore (local persisted items + buyer-only server sync).
//
// Layout: header → sign-in nudge (unauthenticated) → supplier-grouped sections
// (server-cart grouping shape) → item cards (image, name 2-clamp, tier price +
// unit, MOQ-aware qty stepper, remove) → coupon entry (visual only — web
// checkout owns coupon application) → sticky checkout CTA → WebView checkout
// (Tier 3; the token handoff §3.0 is the WKUserScript seeding).
//
// Documented deviations:
// - The web's select/deselect checkboxes are omitted: the native summary is
//   computed over the whole supplier-grouped cart (the spec §3.10 layout has
//   no selection state, and the server cart shape has no notion of it).
// - "Buy This Only" is omitted — it routes to the web buy-now page (Phase 2).
// - Remove is a button (web has a "Cancel" button, no swipe).

struct CartView: View {
    let openPage: (String, String) -> Void
    let openProduct: (String) -> Void
    let openAuth: (AuthRoute) -> Void

    @EnvironmentObject private var cartStore: CartStore
    @State private var couponCode = ""

    var body: some View {
        Group {
            if cartStore.items.isEmpty {
                emptyState
            } else {
                content
            }
        }
        .background(ZylodColor.background)
        .overlay(ToastOverlay())
        .onReceive(NotificationCenter.default.publisher(for: .zylodSessionExpired)) { _ in
            cartStore.itemErrors.removeAll()
        }
        .task { await cartStore.pullServerCart() }
        .zylodEntrance()
    }

    // MARK: Content

    private var content: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 12) {
                    header
                    if !SessionManager.isAuthenticated {
                        signInNudge
                    }
                    ForEach(supplierGroups, id: \.supplierId) { group in
                        supplierSection(group)
                    }
                    couponRow
                    Color.clear.frame(height: 8)
                }
                .padding(.horizontal, 14)
                .padding(.top, 6)
            }
            checkoutBar
        }
    }

    private var header: some View {
        HStack {
            Text("Your Cart")
                .font(ZylodFont.scaled(20, .black, relativeTo: .title3))
                .foregroundColor(ZylodColor.primary)
            Spacer()
            Text("\(cartStore.itemCount) product\(cartStore.itemCount == 1 ? "" : "s") · \(totalUnits) \(totalUnits == 1 ? "unit" : "units")")
                .font(ZylodFont.scaled(11, relativeTo: .caption))
                .foregroundColor(ZylodColor.onMuted)
        }
        .padding(.vertical, 6)
    }

    /// Soft sign-in CTA (§3.10 — NOT a redirect; unauthenticated users keep a
    /// fully editable local cart, web mobile-bottom-nav.tsx:43-45 parity).
    private var signInNudge: some View {
        HStack(spacing: 10) {
            Image(systemName: "person.crop.circle.badge.exclamationmark")
                .font(ZylodFont.scaled(20, relativeTo: .title3))
                .foregroundColor(ZylodColor.primary)
            VStack(alignment: .leading, spacing: 2) {
                Text("Shopping as a guest")
                    .font(ZylodFont.scaled(12, .semibold, relativeTo: .footnote))
                    .foregroundColor(ZylodColor.onBackground)
                Text("Sign in to sync your cart and check out.")
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.onMuted)
            }
            Spacer(minLength: 0)
            Button {
                openAuth(.login)
            } label: {
                Text("Sign In")
                    .font(ZylodFont.scaled(11, .bold, relativeTo: .caption))
                    .foregroundColor(ZylodColor.onPrimary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(ZylodColor.primary))
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 12).fill(ZylodColor.card))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(ZylodColor.primary.opacity(0.25), lineWidth: 1))
    }

    // MARK: Supplier groups (GET /api/cart shape)

    private func supplierSection(_ group: SupplierGroup) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "storefront")
                        .font(ZylodFont.scaled(12, relativeTo: .caption))
                        .foregroundColor(ZylodColor.primary)
                    Text(group.supplierName.isEmpty ? "Supplier" : group.supplierName)
                        .font(ZylodFont.scaled(13, .bold, relativeTo: .footnote))
                        .foregroundColor(ZylodColor.onBackground)
                        .lineLimit(1)
                }
                Spacer()
                Text("\(group.items.count) item\(group.items.count == 1 ? "" : "s")")
                    .font(ZylodFont.scaled(10, relativeTo: .caption2))
                    .foregroundColor(ZylodColor.onMuted)
            }
            ForEach(group.items) { item in
                itemCard(item)
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 14).fill(ZylodColor.card))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(ZylodColor.border.opacity(0.6), lineWidth: 1))
    }

    private func itemCard(_ item: CartStore.CartItemData) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                Button {
                    openProduct(item.productId)
                } label: {
                    RemoteImageView(rawPath: item.productImage, serverUrl: ServerConfig.cached() ?? "", placeholderSize: 28)
                        .frame(width: 80, height: 80)
                        .background(ZylodColor.muted.opacity(0.5))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 4) {
                    Text(item.productName)
                        .font(ZylodFont.scaled(12, .bold, relativeTo: .footnote))
                        .foregroundColor(ZylodColor.onBackground)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    if let variant = item.variantValue ?? item.variantName, !variant.isEmpty {
                        Text("Variant: \(variant)")
                            .font(ZylodFont.scaled(10, relativeTo: .caption2))
                            .foregroundColor(ZylodColor.onMuted)
                    }
                    Text("\(item.supplierName) · MOQ \(item.moq) \(item.unit ?? "units")")
                        .font(ZylodFont.scaled(10, relativeTo: .caption2))
                        .foregroundColor(ZylodColor.onMuted)
                        .lineLimit(1)
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(ZylodFormat.bdt(item.unitPrice))
                            .font(ZylodFont.scaled(14, .black, relativeTo: .body))
                            .foregroundColor(ZylodColor.primary)
                        Text("/ \(item.unit ?? "unit")")
                            .font(ZylodFont.scaled(10, relativeTo: .caption2))
                            .foregroundColor(ZylodColor.onMuted)
                    }
                }
                Spacer(minLength: 0)
            }

            HStack {
                quantityStepper(item)
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(ZylodFormat.bdt(item.totalPrice))
                        .font(ZylodFont.scaled(14, .black, relativeTo: .body))
                        .foregroundColor(ZylodColor.onBackground)
                    Text("\(item.quantity) \(item.unit ?? "units")")
                        .font(ZylodFont.scaled(10, relativeTo: .caption2))
                        .foregroundColor(ZylodColor.onMuted)
                }
            }

            if let errorText = cartStore.itemErrors[item.id] {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(ZylodFont.scaled(11, relativeTo: .caption))
                        .foregroundColor(ZylodColor.destructive)
                    Text(errorText)
                        .font(ZylodFont.scaled(11, relativeTo: .caption))
                        .foregroundColor(ZylodColor.destructive)
                }
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 8).fill(ZylodColor.destructive.opacity(0.07)))
            }

            HStack(spacing: 10) {
                removeButton(item)
            }
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 12).fill(ZylodColor.background))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(ZylodColor.border.opacity(0.5), lineWidth: 1))
    }

    /// MOQ-aware stepper — step = max(1, round(moq/5)), floor = moq
    /// (cart-page.tsx handleQtyChange:66-70).
    private func quantityStepper(_ item: CartStore.CartItemData) -> some View {
        let step = max(1, Int((Double(item.moq) / 5.0).rounded()))
        return HStack(spacing: 0) {
            stepperButton("minus", item: item) {
                cartStore.updateQuantity(item.id, quantity: max(item.moq, item.quantity - step))
            }
            Text("\(item.quantity)")
                .font(ZylodFont.scaled(12, .bold, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onBackground)
                .monospacedDigit()
                .frame(width: 44, height: 30)
                .background(ZylodColor.card)
            stepperButton("plus", item: item) {
                cartStore.updateQuantity(item.id, quantity: item.quantity + step)
            }
        }
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(ZylodColor.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func stepperButton(_ symbol: String, item: CartStore.CartItemData, action: @escaping () -> Void) -> some View {
        Button {
            action()
        } label: {
            Image(systemName: symbol)
                .font(ZylodFont.scaled(11, .semibold, relativeTo: .caption))
                .foregroundColor(ZylodColor.onMuted)
                .frame(width: 30, height: 30)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func removeButton(_ item: CartStore.CartItemData) -> some View {
        Button {
            cartStore.syncRemoveOnServer(itemId: item.id)
            cartStore.removeItem(item.id)
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            ToastCenter.shared.show("Removed from cart — \(item.productName)", tone: .success)
        } label: {
            HStack(spacing: 5) {
                Image(systemName: "trash")
                    .font(ZylodFont.scaled(10, relativeTo: .caption2))
                Text("Cancel")
                    .font(ZylodFont.scaled(11, .bold, relativeTo: .caption))
            }
            .foregroundColor(ZylodColor.destructive)
            .padding(.horizontal, 12)
            .frame(minHeight: 30)
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(ZylodColor.destructive.opacity(0.35), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Coupon (visual only — web checkout owns application server-side)

    private var couponRow: some View {
        HStack(spacing: 10) {
            Image(systemName: "tag.fill")
                .font(ZylodFont.scaled(13, relativeTo: .footnote))
                .foregroundColor(ZylodColor.primary)
            TextField("Coupon code", text: $couponCode)
                .font(ZylodFont.scaled(12, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onBackground)
                .disableAutocorrection(true)
                .autocapitalization(.allCharacters)
            Button {
                ToastCenter.shared.show("Coupons are applied at checkout", tone: .info)
            } label: {
                Text("Apply")
                    .font(ZylodFont.scaled(11, .bold, relativeTo: .caption))
                    .foregroundColor(couponCode.isEmpty ? ZylodColor.onMuted : ZylodColor.primary)
            }
            .disabled(couponCode.isEmpty)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 12).fill(ZylodColor.card))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(ZylodColor.border.opacity(0.6), lineWidth: 1))
    }

    // MARK: Sticky checkout bar (cart-page.tsx:313-353)

    private var checkoutBar: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Subtotal (\(cartStore.itemCount) product\(cartStore.itemCount == 1 ? "" : "s"), \(totalUnits) units)")
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.onMuted)
                Spacer()
                Text(ZylodFormat.bdt(cartStore.total))
                    .font(ZylodFont.scaled(12, .semibold, relativeTo: .footnote))
                    .foregroundColor(ZylodColor.onBackground)
            }
            HStack {
                Text("Shipping")
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.onMuted)
                Spacer()
                Text("Calculated at checkout")
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.onMuted)
            }
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("Total")
                        .font(ZylodFont.scaled(9, .medium, relativeTo: .caption2))
                        .foregroundColor(ZylodColor.onMuted)
                    Text(ZylodFormat.bdt(cartStore.total))
                        .font(ZylodFont.scaled(18, .black, relativeTo: .title3))
                        .foregroundColor(ZylodColor.primary)
                }
                ZylodButton(title: "Proceed to Checkout", systemImage: "lock.fill") {
                    openPage("checkout", "")
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(ZylodColor.card)
        .overlay(alignment: .top) {
            Rectangle().fill(ZylodColor.border.opacity(0.6)).frame(height: 1)
        }
    }

    // MARK: Empty state (cart-page.tsx:94-119)

    private var emptyState: some View {
        VStack(spacing: 14) {
            ZStack {
                Circle().fill(ZylodColor.muted)
                Image(systemName: "bag.fill")
                    .font(ZylodFont.scaled(34, relativeTo: .largeTitle))
                    .foregroundColor(ZylodColor.onMuted)
            }
            .frame(width: 80, height: 80)
            Text("Your cart is empty")
                .font(ZylodFont.scaled(16, .black, relativeTo: .title3))
                .foregroundColor(ZylodColor.onBackground)
            Text("Browse wholesale deals and add products to get started.")
                .font(ZylodFont.scaled(12, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onMuted)
                .multilineTextAlignment(.center)
            ZylodButton(title: "Start Shopping") {
                openPage("home", "")
            }
            .frame(maxWidth: 280)
        }
        .padding(.horizontal, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: Derived

    struct SupplierGroup {
        let supplierId: String
        let supplierName: String
        let items: [CartStore.CartItemData]
    }

    /// First-appearance-ordered grouping by supplierId (GET /api/cart shape).
    private var supplierGroups: [SupplierGroup] {
        var order: [String] = []
        var names: [String: String] = [:]
        var map: [String: [CartStore.CartItemData]] = [:]
        for item in cartStore.items {
            if map[item.supplierId] == nil { order.append(item.supplierId) }
            if names[item.supplierId] == nil || names[item.supplierId]?.isEmpty == true {
                names[item.supplierId] = item.supplierName
            }
            map[item.supplierId, default: []].append(item)
        }
        return order.map { SupplierGroup(supplierId: $0, supplierName: names[$0] ?? "", items: map[$0] ?? []) }
    }

    private var totalUnits: Int {
        cartStore.items.reduce(0) { $0 + $1.quantity }
    }
}
