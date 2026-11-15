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
 * t233 — NATIVE Kotlin screen for the SPA pageId "app-settings"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"App Settings — app-level settings and device-side controls. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object AppSettingsPageMeta : NativePageMeta() {
    override val pageId = "app-settings"
    override val title = "App Settings"
    override val category = "Settings & App"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Configure client caching, synchronization, biometrics, and runtime performance"
    override val tabHint = ""
    override val bullets = listOf(
        "Stored preference — biometric sign-in is not available on the web app yet",
        "App &amp; System Settings",
        "Toggles on this page tune how this browser talks to Zylod. They are stored in your localStorage and never sent to the server. The Android app carries its own native equivalents on-device.",
        "Diagnostic &amp; System Tools",
        "Security &amp; Biometrics",
    )
    override val related = listOf(
        NativePageLink("app-security-settings", "App Security Settings"),
        NativePageLink("app-network-settings", "App Network Settings"),
        NativePageLink("deep-link-handler", "Deep Link Handler"),
        NativePageLink("server-diagnostics", "Server Diagnostics"),
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
fun AppSettingsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: NativePageViewModel = viewModel(key = "native-page-app-settings") {
        NativePageViewModel(context.applicationContext, AppSettingsPageMeta)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { vm.refresh(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "App Settings",
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
                meta = AppSettingsPageMeta,
                state = state,
                onRetry = { vm.refresh() },
                openPage = openPage,
            )
        }
    }
}
