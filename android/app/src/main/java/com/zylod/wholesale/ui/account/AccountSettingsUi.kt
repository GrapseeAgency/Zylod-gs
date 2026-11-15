package com.zylod.wholesale.ui.account

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * t303 — shared honest-state chrome for the account-settings long tail
 * (language / theme / privacy / push preferences / tax / linked accounts /
 * delete account): the auth gate, the loading wall and the section card.
 * One definition — the seven screens stay byte-different only in content.
 */

/** Centered full-area wall (auth gate / loading / error) with slot content. */
@Composable
internal fun AccountSettingsWall(
    padding: PaddingValues,
    content: @Composable () -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(48.dp))
        content()
    }
}

/** A titled settings card — the web pages' white rounded-3xl sections. */
@Composable
internal fun AccountSettingsSection(
    title: String,
    content: @Composable () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                title.uppercase(),
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 10.dp),
            )
            content()
        }
    }
}

/** The signed-out wall body used by every account-gated screen. */
@Composable
internal fun AccountSignInGate(
    title: String,
    message: String,
    onSignIn: () -> Unit,
) {
    Text(title, fontSize = 14.sp, fontWeight = FontWeight.Black)
    Spacer(Modifier.height(6.dp))
    Text(message, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Spacer(Modifier.height(14.dp))
    OutlinedButton(onClick = onSignIn) { Text("Sign in", fontWeight = FontWeight.Bold) }
}
