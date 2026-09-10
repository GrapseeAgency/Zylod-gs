package com.zylod.wholesale.bridge

import android.app.Activity
import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.widget.Toast
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.Executors

/**
 * Saves downloads handed over by the WebView into the shared Downloads
 * storage. Blob: URLs can't be fetched by DownloadManager, so the page pulls
 * the blob and passes the bytes here as a data URL via the ZylodDownload
 * JavaScript interface.
 */
class DownloadBridge(private val activity: Activity) {

    @JavascriptInterface
    fun save(dataUrl: String, filename: String, mime: String) {
        EXECUTOR.execute {
            val saved = persistDataUrl(activity, dataUrl, filename, mime)
            activity.runOnUiThread {
                if (saved) {
                    Toast.makeText(activity, "Saved to Downloads", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(activity, "Could not save the file", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    companion object {
        private val EXECUTOR = Executors.newSingleThreadExecutor()

        /** Decodes a data: URL and writes it to Downloads; true on success. */
        fun persistDataUrl(context: Context, dataUrl: String, filename: String, mime: String?): Boolean {
            return try {
                val comma = dataUrl.indexOf(',')
                if (comma < 0 || !dataUrl.startsWith("data:")) return false
                val bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT)
                persistBytes(
                    context,
                    bytes,
                    sanitizeFilename(filename),
                    mime?.takeIf { it.isNotBlank() } ?: "application/octet-stream"
                )
                true
            } catch (_: Exception) {
                false
            }
        }

        private fun persistBytes(context: Context, bytes: ByteArray, filename: String, mime: String) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, filename)
                    put(MediaStore.Downloads.MIME_TYPE, mime)
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val resolver = context.contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: throw IllegalStateException("MediaStore insert failed")
                resolver.openOutputStream(uri)?.use { it.write(bytes) }
                    ?: throw IllegalStateException("OutputStream unavailable")
                values.clear()
                values.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
            } else {
                @Suppress("DEPRECATION")
                val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).apply { mkdirs() }
                FileOutputStream(File(dir, filename)).use { it.write(bytes) }
            }
        }

        private fun sanitizeFilename(name: String): String {
            val cleaned = name.replace(Regex("[^A-Za-z0-9._ ()\\-]"), "_").trim()
            return cleaned.ifEmpty { "zylod_download" }
        }
    }
}
