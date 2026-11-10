#!/usr/bin/env python3
"""t298 — rewrite the 20 CATEGORY_IDS thin screens as delegations to the
shared ui/categories/CategoryBrowseScreen. Each file keeps its meta data
object VERBATIM (registry imports the metas), only the composable body
changes: NativePageBody (curated bullets, endpoint null) -> the shared typed
browse screen (GET api/products?limit=24&category=<slug>, the web's own
t283 scoping). The meta's endpoint is updated to the honest one.
"""
import re, sys

ROOT = "/home/z/my-project/android/app/src/main/java/com/zylod/wholesale/ui/screens"

# pageId -> (ScreenName, MetaName)
SCREENS = [
    ("agriculture-food", "AgricultureFoodScreen", "AgricultureFoodPageMeta"),
    ("automotive", "AutomotiveScreen", "AutomotivePageMeta"),
    ("beauty-personal-care", "BeautyPersonalCareScreen", "BeautyPersonalCarePageMeta"),
    ("books-stationery", "BooksStationeryScreen", "BooksStationeryPageMeta"),
    ("construction", "ConstructionScreen", "ConstructionPageMeta"),
    ("electronics", "ElectronicsScreen", "ElectronicsPageMeta"),
    ("furniture", "FurnitureScreen", "FurniturePageMeta"),
    ("garments", "GarmentsScreen", "GarmentsPageMeta"),
    ("gifts-crafts", "GiftsCraftsScreen", "GiftsCraftsPageMeta"),
    ("home-garden", "HomeGardenScreen", "HomeGardenPageMeta"),
    ("jewelry", "JewelryScreen", "JewelryPageMeta"),
    ("led-lighting", "LedLightingScreen", "LedLightingPageMeta"),
    ("medical-supplies", "MedicalSuppliesScreen", "MedicalSuppliesPageMeta"),
    ("mobile-accessories", "MobileAccessoriesScreen", "MobileAccessoriesPageMeta"),
    ("packaging", "PackagingScreen", "PackagingPageMeta"),
    ("promotional-items", "PromotionalItemsScreen", "PromotionalItemsPageMeta"),
    ("spices", "SpicesScreen", "SpicesPageMeta"),
    ("sports-fitness", "SportsFitnessScreen", "SportsFitnessPageMeta"),
    ("textiles-fabrics", "TextilesFabricsScreen", "TextilesFabricsPageMeta"),
    ("toys", "ToysScreen", "ToysPageMeta"),
]

TEMPLATE = '''package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.categories.CategoryBrowseScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "{pid}".
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
{meta}

@Composable
fun {screen}(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {{
    CategoryBrowseScreen(
        pageId = "{pid}",
        title = {title_literal},
        onBack = onBack,
        openPage = openPage,
        query = query,
    )
}}
'''

for pid, screen, meta_name in SCREENS:
    path = f"{ROOT}/{screen}.kt"
    src = open(path).read()
    # Extract the meta data object block verbatim (starts at 'data object', ends before the next blank line + '/**').
    m = re.search(r'(data object ' + meta_name + r' : NativePageMeta\(\) \{.*?\n\})', src, re.S)
    if not m:
        print(f"FAIL: meta block not found in {screen}.kt", file=sys.stderr)
        sys.exit(1)
    meta = m.group(1)
    # Honest endpoint documentation: the row's real data source.
    meta = re.sub(
        r'override val endpoint: String\? = [^\n]+\n',
        f'override val endpoint: String? = "api/products?limit=24&category={pid}"\n',
        meta,
    )
    # Title: pull from the meta's title override.
    tm = re.search(r'override val title = "([^"]+)"', meta)
    if not tm:
        print(f"FAIL: title not found in {meta_name}", file=sys.stderr)
        sys.exit(1)
    title = tm.group(1)
    out = TEMPLATE.format(pid=pid, screen=screen, meta=meta, title_literal=f'"{title}"')
    open(path, "w").write(out)
    print(f"rewrote {screen}.kt ({pid})")

print("done")
