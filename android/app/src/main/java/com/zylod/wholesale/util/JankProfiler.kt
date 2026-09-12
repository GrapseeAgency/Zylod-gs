package com.zylod.wholesale.util

import android.os.Build
import android.util.Log
import android.view.Choreographer
import com.zylod.wholesale.BuildConfig
import java.util.ArrayDeque
import java.util.Locale

/**
 * Round-4 performance mandate (owner): "First measure the actual native Home
 * and determine why it underperforms the existing WebView implementation…
 * using actual frame/jank measurements, memory, image decode time,
 * recomposition, main-thread work and input latency." This is the in-app
 * half of that harness — an objective, per-surface frame-cadence recorder
 * built on Choreographer, the same vsync source the render pipeline and
 * `dumpsys gfxinfo` ultimately sample.
 *
 * The harness tags the visible surface, `web:<pageId>` for a WebView-hosted
 * SPA page — including home, which is WebView-owned since the native-Home
 * termination directive (the retired `native:home` tag died with the
 * quarantined Compose Home; historical native:home dumps predate it). All
 * captures come from the SAME window-level pipeline.
 *
 * Method:
 *  - Every surface transition calls [tag]; the tag switch DUMPS the previous
 *    surface's stats (frames, jank%, p50/p90/p95/p99, worst) and starts a
 *    fresh bucket, so numbers never mix two surfaces.
 *  - A Choreographer frame callback chain measures the interval between
 *    consecutive produced frames. A frame is JANKY when the interval
 *    exceeds 1.5× the display period (read from the real refresh rate,
 *    fallback 16.67 ms @60 Hz) and FROZEN at > 3×. Gaps > [IDLE_GAP_MS]
 *    are the renderer going idle (no frames requested — list settled, page
 *    parked) and are excluded: idle time is not jank.
 *  - DEBUG builds only ([enabled]) — release APKs carry zero overhead.
 *
 * Owner workflow (documented in docs/PERFORMANCE-PROFILE.md):
 *   adb logcat -c && adb logcat -s ZylodPerf
 *   … scroll the surface under test … switch surfaces … read the dumps.
 */
object JankProfiler {

    private const val TAG = "ZylodPerf"

    /** Debug-only: the harness never runs in release builds. */
    val enabled: Boolean = BuildConfig.DEBUG

    /** Gaps longer than this are idle, not jank (renderer parked). */
    private const val IDLE_GAP_NS: Long = 250_000_000L

    @Volatile
    private var surface: String? = null

    /** Remembers the last tagged surface so [retag] can re-arm after resume. */
    @Volatile
    private var lastSurface: String? = null

    private val frames = ArrayDeque<Long>()
    private var vsyncPeriodNs: Long = 16_666_667L
    private var lastFrameNs: Long = 0L
    private var running = false

    private val choreographer: Choreographer?
        get() = try {
            Choreographer.getInstance()
        } catch (_: Exception) {
            null
        }

    private val frameCallback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            if (!running) return
            synchronized(this@JankProfiler) {
                val gap = frameTimeNanos - lastFrameNs
                lastFrameNs = frameTimeNanos
                if (gap in 1L until IDLE_GAP_NS) {
                    frames.addLast(gap)
                    while (frames.size > 600) frames.removeFirst()
                    if (frames.size % 300 == 0) surface?.let { dumpLocked(it) }
                }
            }
            choreographer?.postFrameCallback(this)
        }
    }

    /**
     * Marks the beginning of [name]'s frame bucket. Dumps the previous
     * surface's stats first — call on every screen enter/leave.
     */
    fun tag(window: android.view.Window?, name: String) {
        if (!enabled || window == null) return
        synchronized(this) {
            surface?.let { dumpLocked(it) }
            frames.clear()
            surface = name
            lastSurface = name
            // Display period from the real refresh rate (fallback 60 Hz).
            val hz = try {
                window.decorView.display?.refreshRate ?: 60f
            } catch (_: Exception) {
                60f
            }
            if (hz > 20f) vsyncPeriodNs = (1_000_000_000f / hz).toLong()
        }
        startLocked()
        Log.i(TAG, "surface → $name")
    }

    /** Re-arms the last tagged surface after an app switch (onResume). */
    fun retag(window: android.view.Window?) {
        if (!enabled || window == null) return
        lastSurface?.let { tag(window, it) }
    }

    /** Stops attribution (activity pause) — dumps what the surface collected. */
    fun clear(window: android.view.Window?) {
        if (!enabled || window == null) return
        synchronized(this) {
            surface?.let { dumpLocked(it) }
            frames.clear()
            surface = null
        }
        stopLocked()
    }

    private fun startLocked() {
        if (running) return
        val choreo = choreographer ?: return
        running = true
        lastFrameNs = 0L
        choreo.postFrameCallback { first ->
            synchronized(this@JankProfiler) {
                lastFrameNs = first
            }
            choreo.postFrameCallback(frameCallback)
        }
    }

    private fun stopLocked() {
        running = false
        choreographer?.removeFrameCallback(frameCallback)
    }

    private fun dumpLocked(surfaceName: String) {
        if (frames.isEmpty()) {
            Log.i(TAG, "$surfaceName: (no frames)")
            return
        }
        val sorted = frames.toSortedSet().toLongArray()
        fun pct(p: Double): Long = sorted[((sorted.size - 1) * p).toInt().coerceIn(0, sorted.size - 1)]
        val jank = frames.count { it > vsyncPeriodNs * 3 / 2 }
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
                vsyncPeriodNs * 1.5 / 1_000_000.0,
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
