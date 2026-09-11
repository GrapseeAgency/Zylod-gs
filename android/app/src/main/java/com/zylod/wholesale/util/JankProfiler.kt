package com.zylod.wholesale.util

import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.FrameMetrics
import android.view.Window
import androidx.annotation.RequiresApi
import com.zylod.wholesale.BuildConfig
import java.util.ArrayDeque
import java.util.Locale

/**
 * Round-4 performance mandate (owner): "First measure the actual native Home
 * and determine why it underperforms the existing WebView implementation…
 * using actual frame/jank measurements, memory, image decode time,
 * recomposition, main-thread work and input latency." This is the in-app
 * half of that harness — an objective, per-surface frame/jank recorder built
 * on the platform's own FrameMetrics pipeline (the same source `adb shell
 * dumpsys gfxinfo` samples, but per-surface-tagged and instantly readable
 * from logcat).
 *
 * The harness tags the two competing implementations of the SAME surface:
 * `native:home` (Compose HomeScreen) and `web:<pageId>` (a WebView-hosted
 * SPA page). Because both are captured by the SAME window-level pipeline,
 * "Compose Home vs WebView Home" is an apples-to-apples comparison of
 * frame production on the same device, same session.
 *
 * Method:
 *  - Every surface transition calls [tag]; the tag switch DUMPS the previous
 *    surface's stats (frames, jank%, p50/p90/p95/p99, worst frame) and
 *    starts a fresh bucket, so numbers never mix two surfaces.
 *  - Frames are the OS-reported TOTAL_DURATION ns of each Choreographer
 *    frame while the surface is active. A frame is JANKY at > 1× the
 *    display period (read from the display's real refresh rate, fallback
 *    16.67 ms @60 Hz), FROZEN at > 3×.
 *  - DEBUG builds only ([enabled]) — release APKs carry zero overhead.
 *
 * Owner workflow (documented in docs/PERFORMANCE-PROFILE.md):
 *   adb logcat -c && adb logcat -s ZylodPerf
 *   … scroll the surface under test … switch surfaces … read the dumps.
 */
object JankProfiler {

    private const val TAG = "ZylodPerf"

    /** FrameMetrics requires API 24+; the app minSdk is 24. */
    val enabled: Boolean = BuildConfig.DEBUG

    @Volatile
    private var surface: String? = null

    /** Remembers the last tagged surface so [retag] can re-arm after resume. */
    @Volatile
    private var lastSurface: String? = null

    private val frames = ArrayDeque<Long>()
    private var vsyncPeriodNs: Long = 16_666_667L
    private var installed = false

    // SAM signature: onFrameMetricsAvailable(window, frameMetrics, frameCount).
    private val listener =
        Window.OnFrameMetricsAvailableListener { window, frameMetrics, _ ->
            val active = surface ?: return@OnFrameMetricsAvailableListener
            val total = frameMetrics.getMetric(FrameMetrics.TOTAL_DURATION)
            synchronized(frames) {
                frames.addLast(total)
                while (frames.size > 600) frames.removeFirst()
                if (frames.size % 300 == 0) dumpLocked(active)
            }
        }

    /**
     * Marks the beginning of [name]'s frame bucket. Dumps the previous
     * surface's stats first — call on every screen enter/leave.
     */
    fun tag(window: Window?, name: String) {
        if (!enabled || window == null) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
        synchronized(frames) {
            surface?.let { dumpLocked(it) }
            frames.clear()
            surface = name
            lastSurface = name
        }
        // Display period from the real refresh rate (fallback 60 Hz).
        val hz = try {
            window.decorView.display?.refreshRate ?: 60f
        } catch (_: Exception) {
            60f
        }
        if (hz > 20f) vsyncPeriodNs = (1_000_000_000f / hz).toLong()
        install(window)
        Log.i(TAG, "surface → $name")
    }

    /** Re-arms the last tagged surface after an app switch (onResume). */
    fun retag(window: Window?) {
        if (!enabled || window == null) return
        lastSurface?.let { tag(window, it) }
    }

    /** Stops attribution (activity pause) — dumps what the surface collected. */
    fun clear(window: Window?) {
        if (!enabled || window == null) return
        synchronized(frames) {
            surface?.let { dumpLocked(it) }
            frames.clear()
            surface = null
        }
    }

    @RequiresApi(Build.VERSION_CODES.N)
    private fun install(window: Window) {
        if (installed) return
        installed = true
        try {
            window.setOnFrameMetricsAvailableListener(listener, Handler(Looper.getMainLooper()))
        } catch (e: Exception) {
            Log.w(TAG, "FrameMetrics unavailable on this device/profile", e)
            installed = false
        }
    }

    private fun dumpLocked(surfaceName: String) {
        if (frames.isEmpty()) {
            Log.i(TAG, "$surfaceName: (no frames)")
            return
        }
        val sorted = frames.toSortedSet().toLongArray()
        fun pct(p: Double): Long = sorted[((sorted.size - 1) * p).toInt().coerceIn(0, sorted.size - 1)]
        val jank = frames.count { it > vsyncPeriodNs }
        val frozen = frames.count { it > vsyncPeriodNs * 3 }
        val worst = sorted.last()
        Log.i(
            TAG,
            String.format(
                Locale.US,
                "%s: frames=%d jank=%.1f%% (>%.1fms) frozen=%d p50=%.1fms p90=%.1fms p95=%.1fms p99=%.1fms worst=%.1fms",
                surfaceName,
                frames.size,
                100.0 * jank / frames.size,
                vsyncPeriodNs / 1_000_000.0,
                frozen,
                pct(0.50) / 1_000_000.0,
                pct(0.90) / 1_000_000.0,
                pct(0.95) / 1_000_000.0,
                pct(0.99) / 1_000_000.0,
                worst / 1_000_000.0,
            ),
        )
    }
}
