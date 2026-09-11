import SwiftUI

// Faithful port of src/components/mobile/mobile-home-page.tsx (Phase 0
// reference, same as android ui/home/HomeScreen.kt). Section order: top bar →
// search → category pills → quick access → flash deals → product grid.

struct QuickLink: Identifiable {
    let label: String
    let icon: String
    let tint: Color
    let gradient: [Color]
    let pageId: String

    var id: String { label }
}

private let primaryLinks: [QuickLink] = [
    QuickLink(label: "Explore", icon: "safari", tint: Color(hex: 0xC8102E), gradient: ZylodChip.red, pageId: "explore"),
    QuickLink(label: "Trending", icon: "arrow.trend.up", tint: Color(hex: 0xE53935), gradient: ZylodChip.red, pageId: "trending-products"),
    QuickLink(label: "Flash Sale", icon: "bolt.fill", tint: Color(hex: 0xF57C00), gradient: ZylodChip.orange, pageId: "flash-sale"),
    QuickLink(label: "Daily Deals", icon: "scissors", tint: Color(hex: 0xE53935), gradient: ZylodChip.red, pageId: "daily-deals"),
    QuickLink(label: "New Arrivals", icon: "sparkles", tint: Color(hex: 0x1565C0), gradient: ZylodChip.blue, pageId: "new-arrivals"),
    QuickLink(label: "Clearance", icon: "tag", tint: Color(hex: 0xC62828), gradient: ZylodChip.red, pageId: "clearance"),
    QuickLink(label: "Seasonal", icon: "rosette", tint: Color(hex: 0x2E7D32), gradient: ZylodChip.green, pageId: "seasonal-offers"),
    QuickLink(label: "Brands", icon: "building.2", tint: Color(hex: 0x6A1B9A), gradient: ZylodChip.purple, pageId: "brand-showcase"),
]

private let moreLinks: [QuickLink] = [
    QuickLink(label: "Categories", icon: "square.grid.2x2", tint: Color(hex: 0x1976D2), gradient: ZylodChip.blue, pageId: "category-browser"),
    QuickLink(label: "Coupons", icon: "percent", tint: Color(hex: 0xC62828), gradient: ZylodChip.red, pageId: "coupons"),
    QuickLink(label: "Suppliers", icon: "storefront", tint: Color(hex: 0xE53935), gradient: ZylodChip.red, pageId: "suppliers"),
    QuickLink(label: "Trade Assurance", icon: "shield", tint: Color(hex: 0x1976D2), gradient: ZylodChip.blue, pageId: "suppliers"),
    QuickLink(label: "Easy Payments", icon: "creditcard", tint: Color(hex: 0x388E3C), gradient: ZylodChip.green, pageId: "checkout"),
    QuickLink(label: "Fast Shipping", icon: "shippingbox", tint: Color(hex: 0x6A1B9A), gradient: ZylodChip.purple, pageId: "orders"),
    QuickLink(label: "Top Deals", icon: "clock", tint: Color(hex: 0xF57C00), gradient: ZylodChip.orange, pageId: "top-deals"),
    QuickLink(label: "Bulk Orders", icon: "shippingbox", tint: Color(hex: 0x00695C), gradient: ZylodChip.teal, pageId: "bulk-order"),
    QuickLink(label: "RFQ", icon: "doc.plaintext", tint: Color(hex: 0x37474F), gradient: ZylodChip.grey, pageId: "rfq-list"),
    QuickLink(label: "Support", icon: "headphones", tint: Color(hex: 0xC8102E), gradient: ZylodChip.red, pageId: "support"),
    QuickLink(label: "Cross-border", icon: "globe", tint: Color(hex: 0x1976D2), gradient: ZylodChip.blue, pageId: "cross-border"),
    QuickLink(label: "Factory Direct", icon: "factory", tint: Color(hex: 0x388E3C), gradient: ZylodChip.green, pageId: "factory-direct"),
]

struct HomeView: View {
    @StateObject private var viewModel = HomeViewModel()
    @State private var moreOpen = false
    // Observing the Dynamic Type size makes ZylodFont.scaled re-evaluate the
    // moment the user changes their text size (UIFontMetrics isn't reactive
    // on its own — D5 fix).
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let openPage: (String, String) -> Void
    /// Phase 1: product taps open the NATIVE PDP (§3.9 acceptance — "renders
    /// real product by id … from list taps") instead of the Tier 3 WebView.
    var openProduct: (String) -> Void

    @State private var showStickySearch = false
    @State private var subcategorySheetFor: Category?

    var body: some View {
        Group {
            if viewModel.loading {
                skeletonLayout
            } else if let message = viewModel.error {
                HomeErrorView(message: message) {
                    Task { await viewModel.refresh() }
                }
            } else {
                content
            }
        }
        .background(ZylodColor.background)
        .task { await viewModel.refresh() }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                topBar
                searchPill.padding(.top, 4)
                statsCaption.padding(.top, 10)
                categoryPills.padding(.top, 10)
                quickAccess.padding(.top, 16)
                flashDeals.padding(.top, 12)
                productGrid.padding(.top, 8)
                loadMore.padding(.top, 10)
                Color.clear.frame(height: 24)
            }
            .padding(.horizontal, 12)
            .background(scrollOffsetReader)
        }
        .coordinateSpace(name: "homeScroll")
        .onPreferenceChange(HomeScrollOffsetKey.self) { offset in
            // Sticky compact search swap after ~120px (mobile-home-page.tsx:83-90).
            let scrolled = offset < -120
            if scrolled != showStickySearch { showStickySearch = scrolled }
        }
        .overlay(alignment: .top) {
            if showStickySearch {
                stickySearchBar
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: showStickySearch)
        .sheet(item: $subcategorySheetFor) { category in
            subcategorySheet(category)
        }
    }

    private var scrollOffsetReader: some View {
        GeometryReader { geo in
            Color.clear.preference(
                key: HomeScrollOffsetKey.self,
                value: geo.frame(in: .named("homeScroll")).minY
            )
        }
    }

    /// Compact search bar shown when the full top bar scrolls away
    /// (mobile-home-page.tsx StickySearchBar parity).
    private var stickySearchBar: some View {
        HStack(spacing: 10) {
            Text("Zylod")
                .font(ZylodFont.scaled(15, .bold, relativeTo: .headline))
                .foregroundColor(ZylodColor.primary)
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(ZylodFont.scaled(12, relativeTo: .footnote))
                    .foregroundColor(ZylodColor.onMuted)
                Text("Search products, suppliers...")
                    .font(ZylodFont.scaled(12, relativeTo: .footnote))
                    .foregroundColor(ZylodColor.onMuted)
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Capsule().fill(ZylodColor.muted.opacity(0.6)))
            .contentShape(Capsule())
            .onTapGesture { openPage("search-home", "") }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(ZylodColor.background.opacity(0.97))
        .overlay(alignment: .bottom) {
            Rectangle().fill(ZylodColor.border.opacity(0.6)).frame(height: 1)
        }
    }

    /// Mirror skeleton (loading-skeletons.tsx MobileHomeLoading parity — §3.8
    /// delta c): same section order as the live layout.
    private var skeletonLayout: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 10) {
                    SkeletonBlock(height: 20).frame(width: 72)
                    Spacer()
                    SkeletonBlock(height: 20).frame(width: 20)
                    SkeletonBlock(height: 20).frame(width: 20)
                }
                SkeletonBlock(height: 36, cornerRadius: 18)
                HStack(spacing: 8) {
                    ForEach(0..<5, id: \.self) { _ in
                        SkeletonBlock(height: 28, cornerRadius: 14).frame(width: 84)
                    }
                }
                SkeletonBlock(height: 122, cornerRadius: 14)
                HStack(spacing: 8) {
                    ForEach(0..<4, id: \.self) { _ in
                        SkeletonBlock(height: 84, cornerRadius: 8).frame(width: 58)
                    }
                }
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                    ForEach(0..<6, id: \.self) { _ in
                        SkeletonBlock(height: 172, cornerRadius: 6)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.top, 8)
        }
    }

    private var topBar: some View {
        HStack {
            Text("Zylod")
                .font(ZylodFont.scaled(18, .bold, relativeTo: .title3))
                .foregroundColor(ZylodColor.primary)
            Spacer()
            Button { openPage("notifications", "") } label: {
                Image(systemName: "bell")
                    .font(ZylodFont.scaled(17, relativeTo: .body))
                    .foregroundColor(ZylodColor.onMuted)
            }
            Button { openPage("category-browser", "") } label: {
                Image(systemName: "line.3.horizontal")
                    .font(ZylodFont.scaled(17, relativeTo: .body))
                    .foregroundColor(ZylodColor.onMuted)
            }
        }
        .frame(height: 44)
    }

    private var searchPill: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(ZylodFont.scaled(12, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onMuted)
            Text("Search products, suppliers...")
                .font(ZylodFont.scaled(12, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onMuted)
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(Capsule().fill(ZylodColor.muted.opacity(0.6)))
        .contentShape(Capsule())
        .onTapGesture { openPage("search-home", "") }
    }

    private var statsCaption: some View {
        Text("\(ZylodFormat.compact(viewModel.stats.productCount))+ products · \(ZylodFormat.compact(viewModel.stats.supplierCount))+ verified suppliers")
            .font(ZylodFont.scaled(10, relativeTo: .caption2))
            .foregroundColor(ZylodColor.onMuted)
    }

    /// Category pills (mobile-category-pills.tsx): tap → category page;
    /// 500ms long-press on a pill WITH children → subcategory sheet
    /// (handleTouchStart/handlePillLongPress:143-158).
    private var categoryPills: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(viewModel.categories, id: \.id) { category in
                    CategoryPill(category: category) {
                        openPage("category-products", "category=\(category.slug ?? "")")
                    } onLongPress: {
                        if category.children?.isEmpty == false {
                            subcategorySheetFor = category
                        }
                    }
                }
            }
        }
    }

    /// Subcategory drawer parity (mobile-category-pills.tsx drawer).
    private func subcategorySheet(_ category: Category) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(category.name)
                    .font(ZylodFont.scaled(16, .bold, relativeTo: .headline))
                    .foregroundColor(ZylodColor.onBackground)
                Text("Subcategories")
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.onMuted)
                    .textCase(.uppercase)
            }
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(category.children ?? [], id: \.id) { child in
                        Button {
                            subcategorySheetFor = nil
                            openPage("category-products", "category=\(child.slug ?? "")")
                        } label: {
                            HStack {
                                Text(child.name)
                                    .font(ZylodFont.scaled(13, .medium, relativeTo: .footnote))
                                    .foregroundColor(ZylodColor.onBackground)
                                Spacer()
                                if let count = child.productCount, count > 0 {
                                    Text("\(count)")
                                        .font(ZylodFont.scaled(11, relativeTo: .caption))
                                        .foregroundColor(ZylodColor.onMuted)
                                }
                                Image(systemName: "chevron.right")
                                    .font(ZylodFont.scaled(10, relativeTo: .caption2))
                                    .foregroundColor(ZylodColor.onMuted)
                            }
                            .padding(.vertical, 12)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .overlay(alignment: .top) {
                            Rectangle().fill(ZylodColor.border.opacity(0.4)).frame(height: 1)
                        }
                    }
                }
            }
            ZylodOutlineButton(title: "View all in \(category.name)") {
                subcategorySheetFor = nil
                openPage("category-products", "category=\(category.slug ?? "")")
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .presentationDetents([.medium, .large])
    }

    private var quickAccess: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Quick Access")
                    .font(ZylodFont.scaled(12, .semibold, relativeTo: .footnote))
                    .foregroundColor(ZylodColor.onBackground)
                Spacer()
                Button {
                    moreOpen = true
                } label: {
                    Text("More")
                        .font(ZylodFont.scaled(10, .medium, relativeTo: .caption2))
                        .foregroundColor(ZylodColor.primary)
                }
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    ForEach(primaryLinks) { link in
                        QuickIconView(link: link) { openPage(link.pageId, "") }
                    }
                    Button {
                        moreOpen = true
                    } label: {
                        VStack(spacing: 6) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 14)
                                    .fill(ZylodColor.muted)
                                    .frame(width: 44, height: 44)
                                Text("+\(moreLinks.count)")
                                    .font(ZylodFont.scaled(10, .black, relativeTo: .caption2))
                                    .foregroundColor(ZylodColor.onMuted)
                            }
                            Text("More")
                                .font(ZylodFont.scaled(10, .medium, relativeTo: .caption2))
                                .foregroundColor(ZylodColor.onBackground)
                        }
                        .frame(width: 68)
                    }
                }
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 14).fill(ZylodColor.card))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(ZylodColor.border.opacity(0.5), lineWidth: 1))
        .sheet(isPresented: $moreOpen) {
            QuickAccessMoreSheet { link in
                moreOpen = false
                openPage(link.pageId, "")
            }
        }
    }

    private var flashDeals: some View {
        Group {
            if !viewModel.deals.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(viewModel.deals, id: \.effectiveId) { deal in
                            Button {
                                if let id = deal.effectiveId {
                                    openProduct(id)
                                }
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    RemoteImage(url: imageURL(deal.effectiveImage), cornerRadius: 8, maxPixel: 200)
                                        .frame(width: 58, height: 58)
                                    Text(ZylodFormat.bdt(deal.effectivePrice))
                                        .font(ZylodFont.scaled(10, .bold, relativeTo: .caption2))
                                        .foregroundColor(ZylodColor.primary)
                                        .lineLimit(1)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    private var productGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
            ForEach(viewModel.products, id: \.id) { product in
                ProductCardView(product: product, serverUrl: viewModel.serverUrl) {
                    openProduct(product.id)
                }
            }
        }
    }

    @ViewBuilder
    private var loadMore: some View {
        if viewModel.page < viewModel.totalPages {
            HStack {
                Spacer()
                if viewModel.loadingMore {
                    ProgressView()
                } else {
                    Button {
                        Task { await viewModel.loadMore() }
                    } label: {
                        Text("Load more")
                            .font(ZylodFont.scaled(12, relativeTo: .footnote))
                            .foregroundColor(ZylodColor.primary)
                    }
                }
                Spacer()
            }
        } else if viewModel.products.isEmpty {
            Text("No products found")
                .font(ZylodFont.scaled(12, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onMuted)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 32)
        }
    }

    private func imageURL(_ raw: String?) -> URL? {
        guard let raw, !raw.isEmpty else { return nil }
        if raw.hasPrefix("http") { return URL(string: raw) }
        guard !viewModel.serverUrl.isEmpty else { return nil }
        return URL(string: viewModel.serverUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + raw)
    }
}

private struct QuickIconView: View {
    let link: QuickLink
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14)
                        .fill(LinearGradient(colors: link.gradient, startPoint: .topLeading, endPoint: .bottomTrailing))
                    Image(systemName: link.icon)
                        .font(ZylodFont.scaled(19, relativeTo: .title3))
                        .foregroundColor(link.tint)
                }
                .frame(width: 44, height: 44)
                Text(link.label)
                    .font(ZylodFont.scaled(10, .medium, relativeTo: .caption2))
                    .foregroundColor(ZylodColor.onBackground)
                    .lineLimit(1)
            }
            .frame(width: 68)
        }
        .buttonStyle(.plain)
    }
}

private struct QuickAccessMoreSheet: View {
    let onSelect: (QuickLink) -> Void

    private let columns = [
        GridItem(.flexible()), GridItem(.flexible()),
        GridItem(.flexible()), GridItem(.flexible()),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("All Services")
                    .font(ZylodFont.scaled(14, .bold, relativeTo: .body))
                    .foregroundColor(ZylodColor.onBackground)
                LazyVGrid(columns: columns, spacing: 16) {
                    ForEach(moreLinks) { link in
                        QuickIconView(link: link) { onSelect(link) }
                    }
                }
            }
            .padding(16)
            .padding(.bottom, 24)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .presentationDetents([.medium, .large])
    }
}

private struct RemoteImage: View {
    let url: URL?
    var cornerRadius: CGFloat
    /// Per-context decode cap (round-3 Home-scroll finding): grid cards render
    /// ~170pt wide (≈520px @3x) and flash thumbs 58pt (≈175px @3x) — decoding
    /// everything at the old 900px default tripled bitmap memory and the
    /// per-cell layer-upload cost mid-fling.
    var maxPixel: CGFloat = 600
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            ZylodColor.muted // token placeholder — was Color.white, broke dark mode (D1 fix)
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Image(systemName: "shippingbox")
                    .font(ZylodFont.scaled(16, relativeTo: .body))
                    .foregroundColor(ZylodColor.onMuted)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .task(id: url) {
            guard let url else {
                image = nil
                return
            }
            image = await ZylodImagePipeline.image(for: url, maxPixel: maxPixel)
        }
    }
}

private struct ProductCardView: View {
    let product: Product
    let serverUrl: String
    let action: () -> Void

    private var resolvedImage: URL? {
        guard let raw = product.firstImage, !raw.isEmpty, !raw.hasPrefix("/placeholder") else { return nil }
        if raw.hasPrefix("http") { return URL(string: raw) }
        guard !serverUrl.isEmpty else { return nil }
        return URL(string: serverUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + raw)
    }

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                RemoteImage(url: resolvedImage, cornerRadius: 0)
                    .aspectRatio(5.0 / 6.0, contentMode: .fit)
                    .clipped()
                VStack(alignment: .leading, spacing: 2) {
                    Text(product.name)
                        .font(ZylodFont.scaled(10, .medium, relativeTo: .caption2))
                        .foregroundColor(ZylodColor.onBackground)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .frame(minHeight: 26, alignment: .topLeading)
                    HStack(alignment: .bottom, spacing: 4) {
                        Text(ZylodFormat.bdt(product.basePrice ?? 0))
                            .font(ZylodFont.scaled(11, .bold, relativeTo: .caption))
                            .foregroundColor(ZylodColor.primary)
                        if let sold = product.soldCount, sold > 0 {
                            Text("\(ZylodFormat.compact(sold)) sold")
                                .font(ZylodFont.scaled(8, relativeTo: .caption2))
                                .foregroundColor(ZylodColor.onMuted)
                        }
                        Spacer(minLength: 0)
                    }
                }
                .padding(.horizontal, 6)
                .padding(.top, 4)
                .padding(.bottom, 6)
            }
            .background(RoundedRectangle(cornerRadius: 6).fill(ZylodColor.card))
            .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
    }
}

private struct HomeErrorView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "cloud.off")
                .font(ZylodFont.scaled(44, relativeTo: .largeTitle))
                .foregroundColor(ZylodColor.onMuted)
            Text("Can't reach Zylod")
                .font(ZylodFont.scaled(14, .semibold, relativeTo: .body))
                .foregroundColor(ZylodColor.onBackground)
            Text(message)
                .font(ZylodFont.scaled(11, relativeTo: .caption))
                .foregroundColor(ZylodColor.onMuted)
                .multilineTextAlignment(.center)
            Button(action: retry) {
                Text("Retry")
                    .font(ZylodFont.scaled(13, .semibold, relativeTo: .footnote))
                    .foregroundColor(ZylodColor.onPrimary)
                    .padding(.horizontal, 28)
                    .padding(.vertical, 10)
                    .background(Capsule().fill(ZylodColor.primary))
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Scroll offset (sticky-search trigger)

/// Reports the content's minY inside the "homeScroll" coordinate space;
/// < -120 swaps in the compact search bar (mobile-home-page.tsx:83-90).
private struct HomeScrollOffsetKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

// MARK: - Category pill (tap + 500ms long-press)

private struct CategoryPill: View {
    let category: Category
    let onTap: () -> Void
    let onLongPress: () -> Void

    var body: some View {
        Text(category.name)
            .font(ZylodFont.scaled(11, .medium, relativeTo: .caption))
            .foregroundColor(ZylodColor.onSecondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Capsule().fill(ZylodColor.secondary))
            .overlay(Capsule().stroke(ZylodColor.border.opacity(0.4), lineWidth: 1))
            .lineLimit(1)
            .contentShape(Capsule())
            .onTapGesture { onTap() }
            // 500ms threshold — mobile-category-pills.tsx handleTouchStart:150-154.
            .onLongPressGesture(minimumDuration: 0.5, maximumDistance: 12) {
                onLongPress()
            }
    }
}
