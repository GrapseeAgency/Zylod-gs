package com.zylod.wholesale.ui.auth

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zylod.wholesale.ui.components.AuthScaffold
import com.zylod.wholesale.ui.components.ZylodButton
import com.zylod.wholesale.ui.components.ZylodEntrance
import com.zylod.wholesale.data.session.SessionManager

/**
 * Compact native account-suspended screen (spec §10 "recommended: native
 * account-suspended (login branch renders it)"). Renders the suspension
 * details from the 403 ACCOUNT_SUSPENDED branch and offers sign-out.
 */
@Composable
fun AccountSuspendedScreen(
    email: String,
    reason: String,
    reference: String,
    suspendedAt: String,
    onSignOut: () -> Unit,
) {
    ZylodEntrance {
        AuthScaffold(title = "Zylod", onBack = null) {
            Spacer(Modifier.height(32.dp))
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Surface(
                    shape = androidx.compose.foundation.shape.CircleShape,
                    color = MaterialTheme.colorScheme.error.copy(alpha = 0.1f),
                ) {
                    Icon(
                        Icons.Outlined.Block,
                        null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier
                            .padding(26.dp)
                            .size(38.dp),
                    )
                }
                Text(
                    "Account Suspended",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(top = 16.dp),
                )
                if (email.isNotBlank()) {
                    Text(email, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
                }
            }

            Spacer(Modifier.height(24.dp))
            Surface(
                color = MaterialTheme.colorScheme.surfaceContainer,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp)) {
                    SuspendedRow("Reason", reason.ifBlank { "Your account activity requires a manual review by our security compliance team." })
                    SuspendedRow("Reference", reference.ifBlank { "—" })
                    if (suspendedAt.isNotBlank()) SuspendedRow("Suspended at", suspendedAt)
                }
            }

            Spacer(Modifier.height(20.dp))
            Text(
                "This account is not currently active. If you believe this is a mistake, contact Zylod support with the reference above.",
                fontSize = 12.sp,
                lineHeight = 18.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(Modifier.height(28.dp))
            ZylodButton(
                text = "Sign out",
                onClick = {
                    SessionManager.clear()
                    onSignOut()
                },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun SuspendedRow(label: String, value: String) {
    Row(Modifier.padding(vertical = 6.dp)) {
        Text(
            label,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(92.dp),
        )
        Text(value, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface)
    }
}
