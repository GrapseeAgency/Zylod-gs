package com.zylod.wholesale.ui.web

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import com.zylod.wholesale.data.api.ServerConfig
import android.webkit.WebView

/**
 * WebView shell for Tier 3 pageIds inside the Compose navigation. Loads the SPA
 * deep-link URL (?page=<id>) on the active server so state stays uniform with
 * the web app and the zylod:// link scheme.
 */
@Composable
fun WebScreen(pageId: String, query: String) {
    val context = LocalContext.current
    var webView by remember { mutableStateOf<WebView?>(null) }
    var baseUrl by remember { mutableStateOf(ServerConfig.cached(context)) }

    LaunchedEffect(Unit) {
        if (baseUrl == null) {
            baseUrl = runCatching { ServerConfig.resolve(context) }.getOrNull()
        }
    }

    LaunchedEffect(webView, baseUrl, pageId, query) {
        val base = baseUrl ?: return@LaunchedEffect
        val target = base.trimEnd('/') + "/?page=" + pageId + (if (query.isNotBlank()) "&$query" else "")
        webView?.loadUrl(target)
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center,
    ) {
        if (baseUrl == null) {
            CircularProgressIndicator()
        }
        AndroidView(
            factory = { ctx ->
                WebView(ctx).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                }
            },
            onRelease = { it.destroy() },
            update = { webView = it },
            modifier = Modifier.fillMaxSize(),
        )
    }
}
