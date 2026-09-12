package com.zylod.wholesale.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Shared Phase 1 composables — frozen theme tokens only (MaterialTheme +
 * LocalZylodExtra), sp text, entrance animation parity with the web's
 * framer-motion canonical (opacity 0→1, y 20→0, ~200 ms).
 */

/** Per-screen entrance animation: opacity 0→1, translateY 20dp→0, 200 ms. */
@Composable
fun ZylodEntrance(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    val progress = remember { Animatable(0f) }
    LaunchedEffect(Unit) { progress.animateTo(1f, tween(200)) }
    Box(
        modifier = modifier.graphicsLayer {
            alpha = progress.value
            translationY = 20.dp.toPx() * (1f - progress.value)
        },
        content = content,
    )
}

enum class ZylodButtonVariant { PRIMARY, OUTLINED, DESTRUCTIVE_OUTLINE }

@Composable
fun ZylodButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    variant: ZylodButtonVariant = ZylodButtonVariant.PRIMARY,
    height: Dp = 52.dp,
    content: @Composable (() -> Unit)? = null,
) {
    val colors = when (variant) {
        ZylodButtonVariant.PRIMARY -> ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
        )
        ZylodButtonVariant.OUTLINED -> ButtonDefaults.outlinedButtonColors(
            contentColor = MaterialTheme.colorScheme.primary,
        )
        ZylodButtonVariant.DESTRUCTIVE_OUTLINE -> ButtonDefaults.outlinedButtonColors(
            contentColor = MaterialTheme.colorScheme.error,
        )
    }
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        colors = colors,
        shape = MaterialTheme.shapes.small,
        modifier = modifier.height(height),
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(16.dp),
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.onPrimary,
            )
            Spacer(Modifier.width(8.dp))
        }
        if (content != null) content() else Text(text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun ZylodTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    leadingIcon: ImageVector? = null,
    trailing: @Composable (() -> Unit)? = null,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    keyboardType: KeyboardType = KeyboardType.Text,
    enabled: Boolean = true,
    isError: Boolean = false,
    supportingText: String? = null,
) {
    Column(modifier) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            label = { Text(label, fontSize = 12.sp) },
            placeholder = { placeholder?.let { Text(it, fontSize = 12.sp) } },
            leadingIcon = { leadingIcon?.let { Icon(it, null, Modifier.size(18.dp)) } },
            trailingIcon = trailing,
            visualTransformation = visualTransformation,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            singleLine = true,
            enabled = enabled,
            isError = isError,
            shape = MaterialTheme.shapes.small,
            textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
            modifier = Modifier.fillMaxWidth(),
        )
        if (supportingText != null) {
            Text(
                supportingText,
                fontSize = 10.sp,
                color = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 4.dp, top = 2.dp),
            )
        }
    }
}

/**
 * 6-box OTP input (web input-otp port): one digit per box, digit-only,
 * auto-advance + backspace-to-previous. Multi-char input (paste) fills forward.
 */
@Composable
fun OtpInputBox(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    boxCount: Int = 6,
) {
    val focusRequesters = remember { List(boxCount) { FocusRequester() } }

    fun setDigit(index: Int, text: String) {
        val digits = text.filter(Char::isDigit)
        if (digits.isEmpty()) {
            val chars = value.toCharArray().toMutableList()
            when {
                index < chars.size -> chars.removeAt(index)
                chars.isNotEmpty() -> chars.removeAt(chars.lastIndex)
            }
            onValueChange(chars.joinToString(""))
            if (index > 0) focusRequesters[(index - 1).coerceAtLeast(0)].requestFocus()
            return
        }
        val chars = value.padEnd(boxCount, ' ').toCharArray().toMutableList()
        digits.take(boxCount - index).forEachIndexed { offset, d -> chars[index + offset] = d }
        onValueChange(chars.joinToString("").trimEnd(' '))
        val target = (index + digits.length).coerceAtMost(boxCount - 1)
        if (index + digits.length < boxCount) focusRequesters[target].requestFocus()
    }

    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        repeat(boxCount) { index ->
            val char = value.getOrNull(index)?.toString().orEmpty()
            BasicTextField(
                value = char,
                onValueChange = { setDigit(index, it) },
                enabled = enabled,
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                textStyle = MaterialTheme.typography.titleLarge.copy(
                    fontSize = 18.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center,
                ),
                cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                modifier = Modifier
                    .width(46.dp)
                    .height(52.dp)
                    .focusRequester(focusRequesters[index])
                    .background(MaterialTheme.colorScheme.surfaceContainer, RoundedCornerShape(10.dp)),
                decorationBox = { inner ->
                    Box(contentAlignment = Alignment.Center) {
                        if (char.isEmpty()) {
                            Box(
                                Modifier
                                    .size(4.dp)
                                    .background(MaterialTheme.colorScheme.outline, RoundedCornerShape(50)),
                            )
                        }
                        inner()
                    }
                },
            )
        }
    }
}

/** Inline error banner (web AnimatePresence error <p> with red-50 bg). */
@Composable
fun ErrorBanner(message: String, modifier: Modifier = Modifier) {
    Surface(
        color = MaterialTheme.colorScheme.error.copy(alpha = 0.06f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.25f)),
        shape = MaterialTheme.shapes.small,
        modifier = modifier.fillMaxWidth(),
    ) {
        Text(
            message,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        )
    }
}

/** Shimmer skeleton box (1:1 mirror of the SPA's skeleton language — alpha pulse). */
@Composable
fun SkeletonBox(modifier: Modifier = Modifier, corner: Int = 10) {
    val transition = rememberInfiniteTransition(label = "skeleton")
    val alpha by transition.animateFloat(
        initialValue = 0.5f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(800), RepeatMode.Reverse),
        label = "skeletonAlpha",
    )
    Box(
        modifier
            .graphicsLayer { this.alpha = alpha }
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(corner.dp)),
    )
}

/**
 * Fullscreen auth chrome: back bar + brand + scrollable content — mirrors the
 * mobile web auth pages (header bar with ArrowLeft / "Zylod" / help).
 */
@Composable
fun AuthScaffold(
    title: String,
    onBack: (() -> Unit)?,
    modifier: Modifier = Modifier,
    snackbarHostState: SnackbarHostState? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { snackbarHostState?.let { SnackbarHost(it) } },
        // Nested inside ZylodRoot's Scaffold — zero the insets here or the
        // status-bar top inset is applied twice on every auth screen.
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        modifier = modifier,
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp, vertical = 6.dp),
            ) {
                if (onBack != null) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Go back", tint = MaterialTheme.colorScheme.onSurface)
                    }
                } else {
                    Spacer(Modifier.width(48.dp))
                }
                Spacer(Modifier.weight(1f))
                Text(
                    "Zylod",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.weight(1f))
                Spacer(Modifier.width(48.dp))
            }
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 32.dp),
                content = content,
            )
        }
    }
}

/** Row of 5 rating stars (filled count = rating). */
@Composable
fun StarRow(rating: Int, starSize: Int = 12, modifier: Modifier = Modifier) {
    Row(modifier) {
        repeat(5) { i ->
            Icon(
                if (i < rating) Icons.Filled.Star else Icons.Outlined.Star,
                null,
                tint = if (i < rating) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.outline,
                modifier = Modifier.size(starSize.dp),
            )
        }
    }
}

/** Neutral info tile used across PDP details / supplier stats. */
@Composable
fun InfoTile(title: String, value: String, modifier: Modifier = Modifier) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        shape = MaterialTheme.shapes.small,
        modifier = modifier,
    ) {
        Column(Modifier.padding(10.dp)) {
            Text(
                title.uppercase(),
                fontSize = 9.sp,
                letterSpacing = 0.6.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                value,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}
