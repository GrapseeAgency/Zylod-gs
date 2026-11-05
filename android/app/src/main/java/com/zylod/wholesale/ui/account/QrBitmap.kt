package com.zylod.wholesale.ui.account

import android.graphics.Bitmap
import android.graphics.Color as BitmapColor
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter

/**
 * t280 — QR bitmap generator (extracted from the PDP share dialog's private
 * copy so the 2FA enrollment can render the otpauth:// URI the setup route
 * returns — same zxing core dependency, same rendering semantics).
 */
object QrBitmap {
    fun generate(content: String, size: Int = 420): Bitmap? = try {
        val matrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size, mapOf(EncodeHintType.MARGIN to 0))
        val pixels = IntArray(size * size)
        for (x in 0 until size) for (y in 0 until size) {
            pixels[y * size + x] = if (matrix.get(x, y)) BitmapColor.BLACK else BitmapColor.WHITE
        }
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        bitmap.setPixels(pixels, 0, size, 0, 0, size, size)
        bitmap
    } catch (_: Exception) {
        null
    }
}
