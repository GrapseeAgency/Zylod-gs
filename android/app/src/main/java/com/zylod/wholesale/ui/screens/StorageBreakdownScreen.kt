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
 * t233 — NATIVE Kotlin screen for the SPA pageId "storage-breakdown"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Storage Breakdown — app-level settings and device-side controls. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object StorageBreakdownPageMeta : NativePageMeta() {
    override val pageId = "storage-breakdown"
    override val title = "Storage Breakdown"
    override val category = "Settings & App"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Honest view of what this device is storing — no fabricated Android sandbox figures"
    override val tabHint = ""
    override val bullets = listOf(
        "Storage Allocation Details",
        "The web client cannot inspect Android sandbox storage — the Room SQLite database, Glide &amp; Coil image cache, and PDF invoice downloads live inside the Android app&apos;s private sandbox…",
        "Storage breakdown is native to the Android app",
        "Real bytes this domain is storing in your browser&apos;s localStorage (UTF-16)",
        "Web client (browser) storage",
        "Browser storage (localStorage, sessionStorage, IndexedDB, service-worker caches) is per-browser and per-device — it is not the same as the Android app&apos;s sandbox storage. The number…",
    )
    override val related = listOf(
        NativePageLink("storage-management", "Storage Management"),
        NativePageLink("apk-download", "Apk Download"),
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
fun StorageBreakdownScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: NativePageViewModel = viewModel(key = "native-page-storage-breakdown") {
        NativePageViewModel(context.applicationContext, StorageBreakdownPageMeta)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { vm.refresh(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Storage Breakdown",
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
                meta = StorageBreakdownPageMeta,
                state = state,
                onRetry = { vm.refresh() },
                openPage = openPage,
            )
        }
    }
}
