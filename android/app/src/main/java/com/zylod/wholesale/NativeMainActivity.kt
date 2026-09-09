package com.zylod.wholesale

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.zylod.wholesale.ui.nav.ZylodRoot
import com.zylod.wholesale.ui.theme.ZylodTheme

/**
 * Native Compose entry (launcher from Phase 0 on). Hosts Tier 1 screens and
 * hands Tier 3 pageIds to the embedded WebView — see ARCHITECTURE.md.
 */
class NativeMainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ZylodTheme {
                ZylodRoot()
            }
        }
    }
}
