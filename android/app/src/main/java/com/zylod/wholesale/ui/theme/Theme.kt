package com.zylod.wholesale.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.foundation.isSystemInDarkTheme

// success/warning have no Material3 slot — exposed alongside the scheme.
@Immutable
data class ZylodExtraColors(
    val success: androidx.compose.ui.graphics.Color,
    val onSuccess: androidx.compose.ui.graphics.Color,
    val warning: androidx.compose.ui.graphics.Color,
    val onWarning: androidx.compose.ui.graphics.Color,
)

val LocalZylodExtra = staticCompositionLocalOf {
    ZylodExtraColors(
        success = LightSuccess, onSuccess = LightOnSuccess,
        warning = LightWarning, onWarning = LightOnWarning,
    )
}

private val LightScheme = lightColorScheme(
    primary = LightPrimary,
    onPrimary = LightOnPrimary,
    primaryContainer = LightAccent,
    onPrimaryContainer = LightOnAccent,
    secondary = LightSecondary,
    onSecondary = LightOnSecondary,
    secondaryContainer = LightSecondary,
    onSecondaryContainer = LightOnSecondary,
    tertiary = LightAccent,
    onTertiary = LightOnAccent,
    background = LightBackground,
    onBackground = LightOnBackground,
    surface = LightBackground,
    onSurface = LightOnBackground,
    surfaceVariant = LightMuted,
    onSurfaceVariant = LightOnMuted,
    surfaceContainer = LightCard,
    surfaceContainerHigh = LightPopover,
    surfaceContainerHighest = LightCard,
    error = LightDestructive,
    outline = LightBorder,
    outlineVariant = LightBorder,
)

private val DarkScheme = darkColorScheme(
    primary = DarkPrimary,
    onPrimary = DarkOnPrimary,
    primaryContainer = DarkAccent,
    onPrimaryContainer = DarkOnAccent,
    secondary = DarkSecondary,
    onSecondary = DarkOnSecondary,
    secondaryContainer = DarkSecondary,
    onSecondaryContainer = DarkOnSecondary,
    tertiary = DarkAccent,
    onTertiary = DarkOnAccent,
    background = DarkBackground,
    onBackground = DarkOnBackground,
    surface = DarkBackground,
    onSurface = DarkOnBackground,
    surfaceVariant = DarkMuted,
    onSurfaceVariant = DarkOnMuted,
    surfaceContainer = DarkCard,
    surfaceContainerHigh = DarkPopover,
    surfaceContainerHighest = DarkCard,
    error = DarkDestructive,
    outline = DarkBorder,
    outlineVariant = DarkBorder,
)

@Composable
fun ZylodTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val scheme = if (darkTheme) DarkScheme else LightScheme
    val extra = if (darkTheme) {
        ZylodExtraColors(DarkSuccess, DarkOnSuccess, DarkWarning, DarkOnWarning)
    } else {
        ZylodExtraColors(LightSuccess, LightOnSuccess, LightWarning, LightOnWarning)
    }
    CompositionLocalProvider(LocalZylodExtra provides extra) {
        MaterialTheme(
            colorScheme = scheme,
            typography = ZylodTypography,
            shapes = ZylodShapes,
            content = content,
        )
    }
}
