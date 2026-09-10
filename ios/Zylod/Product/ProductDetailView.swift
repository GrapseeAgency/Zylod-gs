import SwiftUI
import CoreImage

// §3.9 Product detail — SwiftUI port of mobile-product-detail-page.tsx
// (port basis) with the desktop handlers the frozen spec mandates: sticky buy
// bar (product-detail-page.tsx:1628-1668), share + QR dialogs
// (product-share-dialog.tsx / product-qr-code.tsx), buy-now →
// POST api/orders/create-direct (product-detail-page.tsx:392-427).
//
// Documented deviations:
// - Share uses the system share sheet instead of the web's hand-built social
//   dialog (sanctioned by spec §3.9 "native MAY use system share sheet").
// - Gallery is TabView(.page) (spec §4.2 embla → TabView(.page)).
// - The header cart button is omitted — the iOS tab bar badge is always
//   visible, so the web's header-cart affordance is redundant here.
// - Order confirmation is a native summary sheet (spec §3.9 allows it); the
//   web's "View Full Order" jumps to order-detail, which is Phase 2.

struct ProductDetailView: View {
    @StateObject private var viewModel: ProductDetailViewModel
    @EnvironmentObject private var flow: AppFlow

    @State private var ctaOnScreen = true
    @State private var showQrSheet = false
    @Namespace private var tabNamespace

    init(productId: String) {
        _viewModel = StateObject(wrappedValue: ProductDetailViewModel(productId: productId))
    }

    var body: some View {
        Group {
            if viewModel.loading {
                skeleton
            } else if let message = viewModel.error {
                errorView(message)
            } else if let product = viewModel.product {
                content(product)
            } else {
                errorView("Product not found")
            }
        }
        .background(ZylodColor.background)
        .navigationTitle("Product Details")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbarItems }
        .overlay(alignment: .bottom) { stickyBuyBar }
        .animation(.easeInOut(duration: 0.22), value: ctaOnScreen)
        .sheet(item: $viewModel.orderConfirmation) { confirmation in
            orderSheet(confirmation.order)
        }
        .sheet(isPresented: $showQrSheet) { qrSheet }
        .onAppear { viewModel.load() }
        .onDisappear { viewModel.cancelPending() }
        .zylodEntrance()
    }

    // MARK: Toolbar (share + QR — web title-row buttons, desktop:584-585)

    @ToolbarContentBuilder
    private var toolbarItems: some ToolbarContent {
        ToolbarItemGroup(placement: .navigationBarTrailing) {
            Button {
                shareProduct()
            } label: {
                Image(systemName: "square.and.arrow.up")
                    .font(ZylodFont.scaled(15, relativeTo: .body))
            }
            Button {
                showQrSheet = true
            } label: {
                Image(systemName: "qrcode")
                    .font(ZylodFont.scaled(15, relativeTo: .body))
            }
        }
    }

    // MARK: Content

    private func content(_ product: ProductDetail) -> some View {
        ScrollView {
            VStack(spacing: 8) {
                gallery(product)
                infoSection(product)
                supplierSection(product)
                tabsSection(product)
                Color.clear.frame(height: ctaOnScreen ? 8 : 96)
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .coordinateSpace(name: "pdpScroll")
    }

    // MARK: Gallery (mobile:238-273)

    private func gallery(_ product: ProductDetail) -> some View {
        let images = viewModel.galleryImages
        return VStack(spacing: 0) {
            if images.isEmpty {
                ZStack {
                    ZylodColor.muted.opacity(0.4)
                    Image(systemName: "shippingbox")
                        .font(ZylodFont.scaled(64, relativeTo: .largeTitle))
                        .foregroundColor(ZylodColor.border)
                }
                .aspectRatio(1, contentMode: .fit)
            } else {
                TabView(selection: $viewModel.galleryIndex) {
                    ForEach(Array(images.enumerated()), id: \.offset) { index, rawPath in
                        RemoteImageView(rawPath: rawPath, serverUrl: viewModel.serverUrl, placeholderSize: 64)
                            .aspectRatio(1, contentMode: .fit)
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .aspectRatio(1, contentMode: .fit)
                .background(ZylodColor.card)
            }

            if images.count > 1 {
                HStack(spacing: 6) {
                    ForEach(Array(images.enumerated()), id: \.offset) { index, _ in
                        Capsule()
                            .fill(index == viewModel.galleryIndex ? ZylodColor.primary : ZylodColor.border)
                            .frame(width: index == viewModel.galleryIndex ? 16 : 8, height: 8)
                            .animation(.easeOut(duration: 0.2), value: viewModel.galleryIndex)
                    }
                }
                .padding(.vertical, 8)
            }
        }
        .background(ZylodColor.card)
        .overlay(alignment: .topLeading) {
            if product.isCustomizable == true {
                Text("Customizable")
                    .font(ZylodFont.scaled(10, .medium, relativeTo: .caption2))
                    .foregroundColor(ZylodColor.onBackground)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(RoundedRectangle(cornerRadius: 6).fill(ZylodColor.card))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(ZylodColor.border, lineWidth: 1))
                    .shadow(color: .black.opacity(0.08), radius: 3, y: 1)
                    .padding(12)
            }
        }
    }

    // MARK: Info section (mobile:275-375)

    private func infoSection(_ product: ProductDetail) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 10) {
                Text(product.name)
                    .font(ZylodFont.scaled(18, .bold, relativeTo: .title3))
                    .foregroundColor(ZylodColor.onBackground)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
                Button {
                    viewModel.toggleWishlist()
                } label: {
                    Image(systemName: viewModel.isWishlisted ? "heart.fill" : "heart")
                        .font(ZylodFont.scaled(20, relativeTo: .title3))
                        .foregroundColor(viewModel.isWishlisted ? ZylodColor.primary : ZylodColor.onMuted)
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(ZylodColor.muted.opacity(0.35)))
                }
                .disabled(viewModel.wishlistLoading)
            }

            HStack(spacing: 6) {
                StarRating(value: product.ratingAvg ?? 0, size: 12)
                Text("\(String(format: "%.1f", product.ratingAvg ?? 0)) (\(product.reviewCount ?? 0) reviews)")
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.onMuted)
                Text("•")
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.onMuted)
                Text("\(ZylodFormat.compact(product.soldCount ?? 0)) sold")
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.onMuted)
            }

            priceBlock(product)

            if !viewModel.priceTiers.isEmpty {
                TierPriceTable(
                    unit: viewModel.unit,
                    basePrice: product.basePrice ?? 0,
                    tiers: viewModel.priceTiers.map { TierRow(minQty: $0.minQty, maxQty: $0.maxQty, pricePerUnit: $0.pricePerUnit) },
                    quantity: viewModel.quantity
                )
            }

            if let variants = product.variants, !variants.isEmpty {
                variantChips(variants)
            }

            quantitySelector

            HStack(spacing: 8) {
                Image(systemName: viewModel.stockStatus.inStock ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .font(ZylodFont.scaled(12, relativeTo: .caption))
                    .foregroundColor(viewModel.stockStatus.inStock ? ZylodColor.success : ZylodColor.destructive)
                Text("\(viewModel.stockStatus.text) — \(viewModel.currentStock) \(viewModel.unit) available")
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.onMuted)
            }

            ctaSection(product)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ZylodColor.card)
        .background(
            GeometryReader { geo in
                Color.clear.preference(
                    key: CtaVisibilityKey.self,
                    value: geo.frame(in: .global).maxY
                )
            }
        )
        .onPreferenceChange(CtaVisibilityKey.self) { maxY in
            let onScreen = maxY > 0
            if onScreen != ctaOnScreen { ctaOnScreen = onScreen }
        }
    }

    /// Price header + savings pill (desktop price block, applicablePrice).
    private func priceBlock(_ product: ProductDetail) -> some View {
        let base = product.basePrice ?? 0
        let savings = base > 0 ? Int(round((1 - viewModel.applicablePrice / base) * 100)) : 0
        return HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(ZylodFormat.bdt(viewModel.applicablePrice))
                .font(ZylodFont.scaled(24, .bold, relativeTo: .title2))
                .foregroundColor(ZylodColor.primary)
            Text("/ \(viewModel.unit)")
                .font(ZylodFont.scaled(12, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onMuted)
            if savings > 0, base != viewModel.applicablePrice {
                Text("\(savings)% OFF")
                    .font(ZylodFont.scaled(10, .semibold, relativeTo: .caption2))
                    .foregroundColor(ZylodColor.onSuccess)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(ZylodColor.success))
            }
            Spacer()
            Text("Total \(ZylodFormat.bdt(viewModel.totalPrice))")
                .font(ZylodFont.scaled(12, .semibold, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onBackground)
        }
    }

    private func variantChips(_ variants: [ProductVariant]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Variants")
                .font(ZylodFont.scaled(11, .semibold, relativeTo: .caption))
                .foregroundColor(ZylodColor.onMuted)
                .textCase(.uppercase)
            FlowChips(items: variants.map { variant in
                FlowChipItem(
                    id: variant.id,
                    label: [variant.variantValue, variant.variantName].compactMap { $0 }.joined(separator: " · "),
                    selected: viewModel.selectedVariantId == variant.id,
                    disabled: (variant.stockQuantity ?? 0) <= 0
                )
            }) { id in
                withAnimation(.easeInOut(duration: 0.15)) {
                    viewModel.selectVariant(viewModel.selectedVariantId == id ? nil : id)
                }
            }
        }
    }

    private var quantitySelector: some View {
        HStack(spacing: 12) {
            Text("Quantity (MOQ: \(viewModel.moq))")
                .font(ZylodFont.scaled(11, relativeTo: .caption))
                .foregroundColor(ZylodColor.onMuted)
            HStack(spacing: 0) {
                stepperButton("minus") { viewModel.changeQuantity(by: -10) }
                Text("\(viewModel.quantity)")
                    .font(ZylodFont.scaled(14, .semibold, relativeTo: .body))
                    .foregroundColor(ZylodColor.onBackground)
                    .monospacedDigit()
                    .frame(width: 48, minHeight: 32)
                    .overlay(
                        Rectangle().fill(ZylodColor.border.opacity(0.6)).frame(width: 1), alignment: .leading
                    )
                    .overlay(
                        Rectangle().fill(ZylodColor.border.opacity(0.6)).frame(width: 1), alignment: .trailing
                    )
                stepperButton("plus") { viewModel.changeQuantity(by: 10) }
            }
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(ZylodColor.border, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            Text(viewModel.unit)
                .font(ZylodFont.scaled(11, relativeTo: .caption))
                .foregroundColor(ZylodColor.onMuted)
        }
    }

    private func stepperButton(_ symbol: String, action: @escaping () -> Void) -> some View {
        Button {
            action()
        } label: {
            Image(systemName: symbol)
                .font(ZylodFont.scaled(12, .semibold, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onBackground)
                .frame(width: 34, minHeight: 32)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// Message supplier + Add to Cart / Buy Now (mobile:350-374).
    private func ctaSection(_ product: ProductDetail) -> some View {
        VStack(spacing: 10) {
            if let supplier = product.supplier {
                Button {
                    flow.openPage("chat-detail", "conversationId=\(supplier.id)")
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "message.fill")
                            .font(ZylodFont.scaled(12, relativeTo: .footnote))
                        Text("Message Supplier")
                            .font(ZylodFont.scaled(12, .semibold, relativeTo: .footnote))
                    }
                    .frame(maxWidth: .infinity, minHeight: 36)
                    .foregroundColor(ZylodColor.primary)
                    .background(RoundedRectangle(cornerRadius: 8).fill(ZylodColor.primary.opacity(0.06)))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(ZylodColor.primary.opacity(0.3), lineWidth: 1))
                }
            }
            HStack(spacing: 12) {
                ZylodOutlineButton(title: viewModel.justAdded ? "In Cart ✓" : "Add to Cart", systemImage: viewModel.justAdded ? "checkmark.circle.fill" : "cart") {
                    viewModel.addToCart()
                }
                ZylodButton(title: "Buy Now", loading: viewModel.buyingNow, enabled: !viewModel.outOfStock && !viewModel.belowMoq) {
                    Task { await viewModel.buyNow() }
                }
            }
            if viewModel.outOfStock {
                Text("Out of stock — check back soon")
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.destructive)
            } else if viewModel.belowMoq {
                Text("Minimum order quantity is \(viewModel.moq) \(viewModel.unit)")
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.warning)
            }
        }
    }

    // MARK: Supplier card (mobile:502-536)

    private func supplierSection(_ product: ProductDetail) -> some View {
        Group {
            if let supplier = product.supplier {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 12) {
                        ZStack {
                            Circle().fill(ZylodColor.primary.opacity(0.1))
                            Image(systemName: "storefront")
                                .font(ZylodFont.scaled(18, relativeTo: .title3))
                                .foregroundColor(ZylodColor.primary)
                        }
                        .frame(width: 40, height: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Text(supplier.companyName ?? "Supplier")
                                    .font(ZylodFont.scaled(14, .semibold, relativeTo: .body))
                                    .foregroundColor(ZylodColor.onBackground)
                                    .lineLimit(1)
                                if supplier.verificationStatus == "approved" {
                                    Image(systemName: "checkmark.seal.fill")
                                        .font(ZylodFont.scaled(13, relativeTo: .footnote))
                                        .foregroundColor(ZylodColor.success)
                                } else {
                                    Text("Unverified Supplier")
                                        .font(ZylodFont.scaled(9, .semibold, relativeTo: .caption2))
                                        .foregroundColor(ZylodColor.onWarning)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Capsule().fill(ZylodColor.warning.opacity(0.2)))
                                }
                            }
                            Text(supplier.city ?? "—")
                                .font(ZylodFont.scaled(10, relativeTo: .caption2))
                                .foregroundColor(ZylodColor.onMuted)
                        }
                        Spacer(minLength: 0)
                        Button {
                            // supplier-profile is the live pageId the mobile web
                            // card uses (mobile-product-detail-page.tsx:518).
                            flow.openPage("supplier-profile", "supplierId=\(supplier.id)")
                        } label: {
                            Text("Visit Store")
                                .font(ZylodFont.scaled(11, .semibold, relativeTo: .caption))
                                .foregroundColor(ZylodColor.primary)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(ZylodColor.primary, lineWidth: 1))
                        }
                    }
                    HStack(spacing: 8) {
                        supplierStat("\(String(format: "%.1f", supplier.ratingAvg ?? 0))", "Rating")
                        supplierStat("\(supplier.ratingCount ?? 0)", "Reviews")
                        supplierStat("\(product.reviewCount ?? 0)", "Products")
                    }
                }
                .padding(14)
                .background(ZylodColor.card)
            }
        }
    }

    private func supplierStat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(ZylodFont.scaled(12, .bold, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onBackground)
            Text(label)
                .font(ZylodFont.scaled(9, relativeTo: .caption2))
                .foregroundColor(ZylodColor.onMuted)
        }
        .frame(maxWidth: .infinity, minHeight: 44)
        .background(RoundedRectangle(cornerRadius: 8).fill(ZylodColor.muted.opacity(0.4)))
    }

    // MARK: Tabs (mobile:377-500 + Q&A per spec §3.9)

    private func tabsSection(_ product: ProductDetail) -> some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 0) {
                    ForEach(ProductDetailViewModel.Tab.allCases, id: \.rawValue) { tab in
                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                viewModel.activeTab = tab
                            }
                        } label: {
                            VStack(spacing: 6) {
                                Text(tabLabel(tab, product: product))
                                    .font(ZylodFont.scaled(12, .medium, relativeTo: .footnote))
                                    .foregroundColor(viewModel.activeTab == tab ? ZylodColor.primary : ZylodColor.onMuted)
                                    .padding(.horizontal, 12)
                                    .padding(.top, 12)
                                ZStack {
                                    Rectangle().fill(Color.clear).frame(height: 2)
                                    if viewModel.activeTab == tab {
                                        Rectangle()
                                            .fill(ZylodColor.primary)
                                            .frame(height: 2)
                                            .matchedGeometryEffect(id: "pdp-tab-underline", in: tabNamespace)
                                    }
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 6)
            }
            .overlay(alignment: .bottom) {
                Rectangle().fill(ZylodColor.border.opacity(0.6)).frame(height: 1)
            }

            tabContent(product)
                .padding(14)
                .transition(.opacity)
        }
        .background(ZylodColor.card)
        .animation(.easeInOut(duration: 0.2), value: viewModel.activeTab)
    }

    private func tabLabel(_ tab: ProductDetailViewModel.Tab, product: ProductDetail) -> String {
        switch tab {
        case .specs:
            return viewModel.specifications.isEmpty ? "Details" : "Specifications"
        case .reviews:
            return "Reviews (\(product.reviewCount ?? product.reviews?.count ?? 0))"
        default:
            return tab.label
        }
    }

    @ViewBuilder
    private func tabContent(_ product: ProductDetail) -> some View {
        switch viewModel.activeTab {
        case .details:
            detailsTab(product)
        case .specs:
            specsTab
        case .reviews:
            reviewsTab(product)
        case .qa:
            qaTab
        }
    }

    private func detailsTab(_ product: ProductDetail) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(product.description ?? "No description available.")
                .font(ZylodFont.scaled(13, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onMuted)
                .lineSpacing(3)
            HStack(spacing: 10) {
                detailTile("IN STOCK", "\(viewModel.currentStock) \(viewModel.unit)")
                detailTile("MIN. ORDER", "\(viewModel.moq) \(viewModel.unit)")
                if let brand = product.brand, !brand.isEmpty {
                    detailTile("BRAND", brand)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func detailTile(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(ZylodFont.scaled(9, .medium, relativeTo: .caption2))
                .foregroundColor(ZylodColor.onMuted)
                .textCase(.uppercase)
            Text(value)
                .font(ZylodFont.scaled(13, .semibold, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onBackground)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 8).fill(ZylodColor.muted.opacity(0.4)))
    }

    private var specsTab: some View {
        Group {
            if viewModel.specifications.isEmpty {
                emptyTabText("No specifications available.")
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(viewModel.specifications.enumerated()), id: \.offset) { index, spec in
                        HStack(alignment: .top) {
                            Text(spec.name)
                                .font(ZylodFont.scaled(12, relativeTo: .footnote))
                                .foregroundColor(ZylodColor.onMuted)
                            Spacer(minLength: 16)
                            Text(spec.value)
                                .font(ZylodFont.scaled(12, .medium, relativeTo: .footnote))
                                .foregroundColor(ZylodColor.onBackground)
                                .multilineTextAlignment(.trailing)
                        }
                        .padding(.vertical, 9)
                        .overlay(alignment: .top) {
                            if index > 0 {
                                Rectangle().fill(ZylodColor.border.opacity(0.4)).frame(height: 1)
                            }
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func reviewsTab(_ product: ProductDetail) -> some View {
        let reviews = product.reviews ?? []
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                VStack(spacing: 4) {
                    Text(String(format: "%.1f", product.ratingAvg ?? 0))
                        .font(ZylodFont.scaled(28, .bold, relativeTo: .title))
                        .foregroundColor(ZylodColor.onBackground)
                    StarRating(value: product.ratingAvg ?? 0, size: 11)
                    Text("\(product.reviewCount ?? reviews.count) reviews")
                        .font(ZylodFont.scaled(9, relativeTo: .caption2))
                        .foregroundColor(ZylodColor.onMuted)
                }
                Spacer()
            }
            if reviews.isEmpty {
                emptyTabText("No reviews yet. Be the first to review this product!")
            } else {
                ForEach(reviews) { review in
                    reviewCard(review)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func reviewCard(_ review: ProductReview) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                ZStack {
                    Circle().fill(ZylodColor.primary.opacity(0.1))
                    Text(initial(of: review))
                        .font(ZylodFont.scaled(11, .bold, relativeTo: .caption))
                        .foregroundColor(ZylodColor.primary)
                }
                .frame(width: 28, height: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(review.displayName ?? "Anonymous")
                        .font(ZylodFont.scaled(12, .medium, relativeTo: .footnote))
                        .foregroundColor(ZylodColor.onBackground)
                    HStack(spacing: 4) {
                        StarRating(value: Double(review.rating), size: 9)
                        if let date = Self.formatDate(review.createdAt) {
                            Text(date)
                                .font(ZylodFont.scaled(9, relativeTo: .caption2))
                                .foregroundColor(ZylodColor.onMuted)
                        }
                    }
                }
                Spacer(minLength: 0)
            }
            if let comment = review.comment, !comment.isEmpty {
                Text(comment)
                    .font(ZylodFont.scaled(12, relativeTo: .footnote))
                    .foregroundColor(ZylodColor.onMuted)
                    .lineSpacing(2)
            }
            if review.verifiedPurchase == true {
                Text("✓ Verified purchase")
                    .font(ZylodFont.scaled(10, relativeTo: .caption2))
                    .foregroundColor(ZylodColor.success)
            }
            ForEach(review.replies ?? []) { reply in
                VStack(alignment: .leading, spacing: 3) {
                    Text("\(reply.displayName ?? "Seller") replied:")
                        .font(ZylodFont.scaled(10, .medium, relativeTo: .caption2))
                        .foregroundColor(ZylodColor.onBackground)
                    Text(reply.comment ?? "")
                        .font(ZylodFont.scaled(10, relativeTo: .caption2))
                        .foregroundColor(ZylodColor.onMuted)
                }
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 8).fill(ZylodColor.muted.opacity(0.35)))
                .padding(.leading, 24)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 10).fill(ZylodColor.muted.opacity(0.4)))
    }

    private var qaTab: some View {
        Group {
            if viewModel.qa.isEmpty {
                emptyTabText("No questions yet. Ask the supplier about this product.")
            } else {
                VStack(spacing: 10) {
                    ForEach(viewModel.qa) { item in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: "questionmark.circle.fill")
                                    .font(ZylodFont.scaled(12, relativeTo: .caption))
                                    .foregroundColor(ZylodColor.primary)
                                Text(item.question ?? "")
                                    .font(ZylodFont.scaled(12, .medium, relativeTo: .footnote))
                                    .foregroundColor(ZylodColor.onBackground)
                            }
                            if let answer = item.answer, !answer.isEmpty {
                                HStack(alignment: .top, spacing: 8) {
                                    Image(systemName: "text.bubble.fill")
                                        .font(ZylodFont.scaled(12, relativeTo: .caption))
                                        .foregroundColor(ZylodColor.success)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(answer)
                                            .font(ZylodFont.scaled(12, relativeTo: .footnote))
                                            .foregroundColor(ZylodColor.onMuted)
                                        if let answeredBy = item.answeredBy, !answeredBy.isEmpty {
                                            Text("— \(answeredBy)")
                                                .font(ZylodFont.scaled(10, relativeTo: .caption2))
                                                .foregroundColor(ZylodColor.onMuted)
                                        }
                                    }
                                }
                            }
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 10).fill(ZylodColor.muted.opacity(0.4)))
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func emptyTabText(_ message: String) -> some View {
        Text(message)
            .font(ZylodFont.scaled(12, relativeTo: .footnote))
            .foregroundColor(ZylodColor.onMuted)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 22)
    }

    // MARK: Sticky buy bar (product-detail-page.tsx:1628-1668)

    @ViewBuilder
    private var stickyBuyBar: some View {
        if !ctaOnScreen {
            VStack(spacing: 0) {
                Divider().overlay(ZylodColor.border)
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(ZylodFormat.bdt(viewModel.totalPrice))
                            .font(ZylodFont.scaled(17, .bold, relativeTo: .title3))
                            .foregroundColor(ZylodColor.primary)
                        Text("\(viewModel.quantity) \(viewModel.unit) × \(ZylodFormat.bdt(viewModel.applicablePrice))")
                            .font(ZylodFont.scaled(10, relativeTo: .caption2))
                            .foregroundColor(ZylodColor.onMuted)
                    }
                    Spacer(minLength: 0)
                    Button {
                        Task { await viewModel.buyNow() }
                    } label: {
                        HStack(spacing: 6) {
                            if viewModel.buyingNow {
                                ProgressView().tint(ZylodColor.onPrimary)
                            } else {
                                Image(systemName: "bolt.fill")
                                    .font(ZylodFont.scaled(14, relativeTo: .body))
                            }
                            Text(viewModel.buyingNow ? "Placing..." : "Buy Now")
                                .font(ZylodFont.scaled(14, .bold, relativeTo: .body))
                        }
                        .frame(minWidth: 128, minHeight: 46)
                        .foregroundColor(viewModel.outOfStock || viewModel.belowMoq ? ZylodColor.onPrimary.opacity(0.6) : ZylodColor.onPrimary)
                        .background(RoundedRectangle(cornerRadius: 10).fill(viewModel.outOfStock || viewModel.belowMoq ? ZylodColor.primary.opacity(0.5) : ZylodColor.primary))
                    }
                    .disabled(viewModel.outOfStock || viewModel.belowMoq || viewModel.buyingNow)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
            }
            .background(ZylodColor.card)
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    // MARK: Order confirmation sheet (desktop order dialog, summary parity)

    private func orderSheet(_ order: DirectOrder) -> some View {
        VStack(spacing: 16) {
            ZStack {
                Circle().fill(ZylodColor.success.opacity(0.12))
                Image(systemName: "checkmark.circle.fill")
                    .font(ZylodFont.scaled(40, relativeTo: .largeTitle))
                    .foregroundColor(ZylodColor.success)
            }
            .frame(width: 84, height: 84)
            .padding(.top, 26)

            Text("Order Placed!")
                .font(ZylodFont.scaled(20, .bold, relativeTo: .title3))
                .foregroundColor(ZylodColor.onBackground)
            Text("Order \(order.orderNumber) created successfully.")
                .font(ZylodFont.scaled(13, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onMuted)
                .multilineTextAlignment(.center)

            VStack(spacing: 10) {
                orderRow("Order Number", order.orderNumber)
                if let total = order.totalAmount {
                    orderRow("Total", ZylodFormat.bdt(total))
                }
                if let status = order.paymentStatus {
                    orderRow("Payment", status.uppercased())
                }
                if let delivery = order.estimatedDelivery, !delivery.isEmpty {
                    orderRow("Est. Delivery", delivery)
                }
            }
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 10).fill(ZylodColor.muted.opacity(0.4)))
            .padding(.horizontal, 4)

            Text("Full order tracking arrives with the orders screens (Phase 2). A confirmation email is on its way.")
                .font(ZylodFont.scaled(11, relativeTo: .caption))
                .foregroundColor(ZylodColor.onMuted)
                .multilineTextAlignment(.center)

            ZylodButton(title: "Continue Shopping") {
                viewModel.orderConfirmation = nil
            }
            .padding(.bottom, 20)
        }
        .padding(.horizontal, 20)
        .frame(maxWidth: .infinity)
        .background(ZylodColor.background)
        .presentationDetents([.medium])
    }

    private func orderRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(ZylodFont.scaled(12, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onMuted)
            Spacer()
            Text(value)
                .font(ZylodFont.scaled(12, .semibold, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onBackground)
        }
    }

    // MARK: QR sheet (product-qr-code.tsx parity — CoreImage generator)

    private var qrSheet: some View {
        VStack(spacing: 14) {
            Text("Scan to open this product")
                .font(ZylodFont.scaled(16, .bold, relativeTo: .headline))
                .foregroundColor(ZylodColor.onBackground)
                .padding(.top, 24)

            if let image = Self.qrImage(for: viewModel.productUrl) {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 220, height: 220)
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 12).fill(ZylodColor.card))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(ZylodColor.border, lineWidth: 1))
            } else {
                Text("QR code unavailable — no server connection yet.")
                    .font(ZylodFont.scaled(12, relativeTo: .footnote))
                    .foregroundColor(ZylodColor.onMuted)
                    .frame(width: 220, height: 220)
            }

            if let url = viewModel.productUrl {
                Text(url)
                    .font(ZylodFont.scaled(10, relativeTo: .caption2))
                    .foregroundColor(ZylodColor.onMuted)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                Button {
                    UIPasteboard.general.string = url
                    ToastCenter.shared.show("Link copied to clipboard", tone: .success)
                } label: {
                    Label("Copy Link", systemImage: "doc.on.doc")
                        .font(ZylodFont.scaled(12, .semibold, relativeTo: .footnote))
                        .foregroundColor(ZylodColor.primary)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 24)
        .frame(maxWidth: .infinity)
        .background(ZylodColor.background)
        .presentationDetents([.medium])
    }

    // MARK: Share (product-share-dialog.tsx getShareText parity)

    private func shareProduct() {
        var items: [Any] = []
        if let text = viewModel.shareText { items.append(text) }
        if let urlString = viewModel.productUrl, let url = URL(string: urlString) { items.append(url) }
        guard !items.isEmpty else {
            ToastCenter.shared.show("Share unavailable until the server is reached", tone: .error)
            return
        }
        BridgeCoordinatorHolder.shared.presentShareSheet(with: items)
    }

    // MARK: States

    private var skeleton: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                SkeletonBlock(height: 320, cornerRadius: 0)
                SkeletonBlock(height: 22).padding(.trailing, 60)
                SkeletonBlock(height: 14).padding(.trailing, 160)
                SkeletonBlock(height: 96)
                SkeletonBlock(height: 44)
                SkeletonBlock(height: 52)
                SkeletonBlock(height: 180)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
        }
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "shippingbox")
                .font(ZylodFont.scaled(44, relativeTo: .largeTitle))
                .foregroundColor(ZylodColor.onMuted)
            Text("Product not found")
                .font(ZylodFont.scaled(15, .semibold, relativeTo: .body))
                .foregroundColor(ZylodColor.onBackground)
            Text(message)
                .font(ZylodFont.scaled(12, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onMuted)
                .multilineTextAlignment(.center)
            HStack(spacing: 12) {
                ZylodOutlineButton(title: "Retry") {
                    viewModel.load()
                }
                .frame(maxWidth: 140)
                ZylodButton(title: "Go Home") {
                    flow.popHomeToRoot()
                }
                .frame(maxWidth: 140)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: Helpers

    private func initial(of review: ProductReview) -> String {
        String((review.displayName ?? "A").prefix(1)).uppercased()
    }

    private static func formatDate(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: raw) {
            return Self.reviewDateFormatter.string(from: date)
        }
        iso.formatOptions = [.withInternetDateTime]
        if let date = iso.date(from: raw) {
            return Self.reviewDateFormatter.string(from: date)
        }
        return nil
    }

    private static let reviewDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    /// CIQRCodeGenerator (spec §4.2: qrcode.react → CoreImage CIQRCodeGenerator).
    private static func qrImage(for urlString: String?) -> UIImage? {
        guard let urlString, let data = urlString.data(using: .utf8),
              let filter = CIFilter(name: "CIQRCodeGenerator") else { return nil }
        filter.setValue(data, forKey: "inputMessage")
        filter.setValue("M", forKey: "inputCorrectionLevel")
        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 10, y: 10))
        let context = CIContext()
        guard let cgImage = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}

// MARK: - CTA visibility preference (sticky-bar trigger)

/// Reports the global maxY of the CTA section; ≤ 0 means the buy controls
/// scrolled past the top of the viewport — exactly the web's
/// `rect.bottom < 0` rule (product-detail-page.tsx:255-264).
private struct CtaVisibilityKey: PreferenceKey {
    static var defaultValue: CGFloat = .greatestFiniteMagnitude
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = min(value, nextValue())
    }
}

// MARK: - Simple flow layout for variant chips

struct FlowChipItem: Identifiable, Equatable {
    let id: String
    let label: String
    let selected: Bool
    let disabled: Bool
}

/// Lightweight wrapping row (system-only; avoids iOS 16 Layout protocol
/// subtleties — chips are short so 2 rows cover real data).
struct FlowChips: View {
    let items: [FlowChipItem]
    let onSelect: (String) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(spacing: 8) {
                ForEach(items) { chip in
                    Button {
                        guard !chip.disabled else { return }
                        onSelect(chip.id)
                    } label: {
                        Text(chip.label)
                            .font(ZylodFont.scaled(12, .medium, relativeTo: .footnote))
                            .foregroundColor(
                                chip.disabled ? ZylodColor.onMuted.opacity(0.5)
                                : chip.selected ? ZylodColor.onPrimary
                                : ZylodColor.onBackground
                            )
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(
                                Capsule().fill(
                                    chip.disabled ? ZylodColor.muted.opacity(0.4)
                                    : chip.selected ? ZylodColor.primary
                                    : ZylodColor.muted.opacity(0.6)
                                )
                            )
                            .overlay(
                                Capsule().stroke(
                                    chip.selected ? ZylodColor.primary : ZylodColor.border.opacity(0.6),
                                    lineWidth: 1
                                )
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 2)
        }
    }
}
