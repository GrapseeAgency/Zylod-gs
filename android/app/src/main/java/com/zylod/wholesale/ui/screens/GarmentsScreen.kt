package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.categories.CategoryBrowseScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "garments".
 *
 * t298 — CATEGORY BROWSE parity: the body is a thin delegation to the shared
 * [CategoryBrowseScreen] (pageId-keyed ViewModel, suppliercore pattern) —
 * the REAL category grid the web's GenericCategoryPage renders for every
 * CATEGORY_IDS id: GET api/products?limit=24&category=<slug> with the web's
 * own CATEGORY_SLUG_MAP translation, the four client-side sorts, hearts via
 * ApiClient.wishlistApi, and the honest zero-rows states (mapped vs unmapped
 * ids). The old body rendered curated bullets with endpoint=null — a buyer
 * saw NO products where the web shows the real grid. The meta object below
 * keeps its registry identity (title/kind/summary/related unchanged; the
 * endpoint now states the row's REAL data source) and the NativePageRegistry
 * composable signature is unchanged.
 */
data object GarmentsPageMeta : NativePageMeta() {
    override val pageId = "garments"
    override val title = "Garments"
    override val category = "Zylod Marketplace"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = "api/products?limit=24&category=garments"
    override val summary = "Garments — the native category browse: the grid streams the category's REAL products from the Zylod API (api/products?limit=24&category=garments), the same scoped data the web's category page renders."
    override val tabHint = ""
    override val bullets = listOf(
        "Live category grid — the server's own scoped rows, never fabricated.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the garments pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("home", "Home"),
        NativePageLink("category-browser", "Category Browser"),
        NativePageLink("help-center", "Help Center"),
    )
}

@Composable
fun GarmentsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    CategoryBrowseScreen(
        pageId = "garments",
        title = "Garments",
        onBack = onBack,
        openPage = openPage,
        query = query,
    )
}
