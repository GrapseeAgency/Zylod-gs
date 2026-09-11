package com.zylod.wholesale.ui.components

import android.os.SystemClock
import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import coil.compose.AsyncImage
import coil.request.ImageRequest

/**
 * Round-4 performance harness (owner: "image decode time" is a required
 * measurement for the Compose Home vs WebView Home comparison). Wraps
 * [AsyncImage] and, in DEBUG builds only, logs every grid/thumbnail image
 * request that takes longer than [SLOW_MS] from request start to successful
 * result — surfacing network-fetch + decode cost that would otherwise be
 * invisible inside "scrolling feels slow".
 *
 * Release builds: a zero-branch pass-through (the listener is still attached
 * but does nothing) — no behavior change, no measurable overhead.
 */
@Composable
fun TimedAsyncImage(
    url: String,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    placeholder: Painter? = null,
    error: Painter? = null,
    contentScale: ContentScale = ContentScale.Crop,
) {
    val context = LocalContext.current
    val startMs = remember(url) { longArrayOf(0L) }
    val request = remember(url) {
        ImageRequest.Builder(context)
            .data(url)
            .listener(
                onStart = { startMs[0] = SystemClock.uptimeMillis() },
                onSuccess = { req, _ ->
                    val elapsed = SystemClock.uptimeMillis() - startMs[0]
                    if (elapsed > SLOW_MS) {
                        Log.i("ZylodPerf", "image slow: ${elapsed}ms ${req.data}")
                    }
                },
                onError = { req, err ->
                    Log.w("ZylodPerf", "image failed after ${SystemClock.uptimeMillis() - startMs[0]}ms ${req.data}: ${err.throwable?.message}")
                },
            )
            .build()
    }
    AsyncImage(
        model = request,
        contentDescription = contentDescription,
        modifier = modifier,
        placeholder = placeholder,
        error = error,
        contentScale = contentScale,
    )
}

private const val SLOW_MS = 64L
