package com.zylod.wholesale.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Type scale ported from the mobile spec (design-tokens.md §5).
// System font: the web's --font-sans vars are broken and render browser
// defaults, so Roboto is a fix, not a divergence.
val ZylodTypography = Typography(
    titleLarge = TextStyle(fontSize = 18.sp, fontWeight = FontWeight.Bold),
    titleMedium = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Bold),
    titleSmall = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
    bodyMedium = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Normal),
    bodySmall = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Medium),
    labelLarge = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
    labelMedium = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.SemiBold),
    labelSmall = TextStyle(fontSize = 8.sp, fontWeight = FontWeight.Bold),
)
