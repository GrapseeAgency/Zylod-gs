package com.zylod.wholesale.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import com.zylod.wholesale.util.JankProfiler

/**
 * Declares the currently visible UI surface for [JankProfiler] (DEBUG-only
 * frame/jank harness — release builds are a no-op). Compose this INSIDE a
 * screen's composition; enter tags the surface, leave dumps its stats.
 *
 * Frame/jank attribution for WebView-hosted surfaces (DEBUG-only harness —
 * release is a no-op). `SurfacePerfTag("web:<pageId>")` on WebScreen covers
 * every WebView page INCLUDING home (home → WEBVIEW, owner directive — the
 * retired `native:home` tag died with the quarantined Compose Home).
 * Methodology in docs/PERFORMANCE-PROFILE.md.
 */
@Composable
fun SurfacePerfTag(name: String) {
    val view = LocalView.current
    val context = LocalContext.current
    DisposableEffect(name) {
        val window = (context as? android.app.Activity)?.window
        JankProfiler.tag(window, name)
        onDispose { JankProfiler.clear(window) }
    }
}
