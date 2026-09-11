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
 * Round-4 owner mandate: the native Home path and the WebView path must be
 * MEASURED against each other — `SurfacePerfTag("native:home")` on
 * HomeScreen and `SurfacePerfTag("web:<pageId>")` on WebScreen make the
 * comparison a single `adb logcat -s ZylodPerf` read on a real device
 * (methodology in docs/PERFORMANCE-PROFILE.md).
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
