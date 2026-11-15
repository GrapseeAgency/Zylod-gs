package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.sellerops.SellerInventoryScreen as SharedSellerInventoryScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "seller-inventory"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t266 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/sellerops implementation. The body is a thin delegation to the
 * shared seller-inventory screen (pageId-keyed so it keeps its own
 * ViewModel) — the REAL GET api/supplier/inventory book: the route's own
 * summary strip and per-product stock cards with the variants nested. The
 * meta object below and the NativePageRegistry composable signature are
 * unchanged.
 */
data object SellerInventoryPageMeta : NativePageMeta() {
    override val pageId = "seller-inventory"
    override val title = "Seller Inventory"
    override val category = "Seller & Supplier"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Your stock levels appear here once you create products. Publish your first listing to get started."
    override val tabHint = ""
    override val bullets = listOf(
        "Inventory Management",
        "Sign in as a supplier to manage your inventory.",
        "Stock Levels",
        "Every quick edit above is verified against your own catalog server-side and written in one transaction. ”Alert” sets this product’s own low-stock line — variants inherit it, and the product…",
    )
    override val related = listOf(
        NativePageLink("seller-add-product", "Seller Add Product"),
        NativePageLink("inventory-restock", "Inventory Restock"),
        NativePageLink("inventory-audit-log", "Inventory Audit Log"),
    )
}

/**
 * Delegation only — the shared [SharedSellerInventoryScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/sellerops, not on this file's own same-named composable).
 */
@Composable
fun SellerInventoryScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedSellerInventoryScreen(pageId = "seller-inventory", onBack = onBack, openPage = openPage, query = query)
}
