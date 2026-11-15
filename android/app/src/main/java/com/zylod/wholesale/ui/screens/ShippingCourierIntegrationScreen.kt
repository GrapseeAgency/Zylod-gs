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
 * t233 — NATIVE Kotlin screen for the SPA pageId "shipping-courier-integration"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Shipping Courier Integration — order, shipping and delivery operations for Zylod buyers. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object ShippingCourierIntegrationPageMeta : NativePageMeta() {
    override val pageId = "shipping-courier-integration"
    override val title = "Shipping Courier Integration"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Open your order queue, pick an order to fulfil, and enter the courier + tracking ID. The buyer sees it on their timeline instantly."
    override val tabHint = ""
    override val bullets = listOf(
        "Courier Integration",
        "How courier handoff works on Zylod today",
        "Per-account API keys aren&apos;t wired yet",
        "The previous version of this page asked for a Pathao/RedX/Paperfly API key, secret and store ID, then showed a &quot;Connect&quot; button that did nothing on click — no merchant account was…",
        "Couriers are integrated per-shipment instead: when you fulfil an order, you enter the courier name and tracking number on the order-detail page. The buyer sees the courier and tracking ID…",
        "Need per-account API integration for high-volume fulfillment? Message Zylod support — your request will be tracked and the integration prioritised against real seller demand.",
    )
    override val related = listOf(
        NativePageLink("seller-order-management", "Seller Order Management"),
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
fun ShippingCourierIntegrationScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: NativePageViewModel = viewModel(key = "native-page-shipping-courier-integration") {
        NativePageViewModel(context.applicationContext, ShippingCourierIntegrationPageMeta)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { vm.refresh(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Shipping Courier Integration",
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
                meta = ShippingCourierIntegrationPageMeta,
                state = state,
                onRetry = { vm.refresh() },
                openPage = openPage,
            )
        }
    }
}
