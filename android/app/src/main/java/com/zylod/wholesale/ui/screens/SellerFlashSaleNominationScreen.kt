package com.zylod.wholesale.ui.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.pages.NativePageBody
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.pages.NativePageViewModel

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "seller-flash-sale-nomination"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Seller Flash Sale Nomination — the seller and supplier toolchain on the Zylod marketplace. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object SellerFlashSaleNominationPageMeta : NativePageMeta() {
    override val pageId = "seller-flash-sale-nomination"
    override val title = "Seller Flash Sale Nomination"
    override val category = "Seller & Supplier"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Flash sales are admin-curated — your products are pinned into active campaigns"
    override val tabHint = ""
    override val bullets = listOf(
        "Flash Sale Placement",
        "Flash-sale and campaign slots are curated by the Zylod admin team. When a buyer-visiting campaign is built, admin pins specific supplier products into it; the discount is funded by the…",
        "Your products currently in live campaigns",
        "To put a product forward for a future campaign, message Zylod support with the SKU and the proposed discount. The decision is made on the admin side and the placement will appear below the…",
        "No live campaign placements yet",
        "None of your products are pinned into an active campaign right now. When admin places one of your SKUs into a flash sale, the campaign and discount appear here in real time.",
    )
    override val related = listOf(
        NativePageLink("seller-promotions", "Seller Promotions"),
    )
}

/**
 * Real themed Compose screen: native top bar (back arrow pops the back
 * stack toward Home), sections driven by the shared [NativePageData] model
 * through [NativePageBody] — live data when the endpoint feeds it, the
 * device-saved cache offline, curated Kotlin metadata otherwise, with a
 * working retry state. Stable keys inside the shared renderer.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SellerFlashSaleNominationScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: NativePageViewModel = viewModel(key = "native-page-seller-flash-sale-nomination") {
        NativePageViewModel(context.applicationContext, SellerFlashSaleNominationPageMeta)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { vm.refresh(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Seller Flash Sale Nomination",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                    )
                },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(
                                Icons.AutoMirrored.Outlined.ArrowBack,
                                "Go back",
                                tint = MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            NativePageBody(
                meta = SellerFlashSaleNominationPageMeta,
                state = state,
                onRetry = { vm.refresh() },
                openPage = openPage,
            )
        }
    }
}
