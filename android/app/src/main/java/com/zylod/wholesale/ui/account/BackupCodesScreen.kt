package com.zylod.wholesale.ui.account

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.delay

/**
 * t280 — typed backup-codes screen (backup-codes-page port: auto-generate on
 * mount, 2-column grid, Copy to Clipboard, Share (the web's Download builds a
 * text file — Android shares it as text), "I've Saved These", and the
 * high-security-zone footer). Registry delegation: ui/screens/BackupCodesScreen.kt.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BackupCodesScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: BackupCodesViewModel = viewModel(
        key = "native-backup-codes",
    ) { BackupCodesViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()

    var toast by remember { mutableStateOf<String?>(null) }
    var lastCopied by remember { mutableIntStateOf(0) }
    LaunchedEffect(state.copiedTick) {
        if (state.copiedTick > lastCopied) {
            lastCopied = state.copiedTick
            toast = "Copied!"
        }
    }
    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2000)
            toast = null
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Backup Recovery Codes", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
        ) {
            when {
                state.needsAuth -> {
                    CodesWall("Your session ended — sign in to manage your backup codes.") { openPage("login", "") }
                    return@Column
                }
                state.loading -> {
                    CodesWall("Generating secure codes…") { vm.generate() }
                    return@Column
                }
                state.error != null -> {
                    CodesWall(state.error ?: "Could not generate codes") { vm.generate() }
                    return@Column
                }
            }

            if (toast != null) {
                Surface(
                    color = MaterialTheme.colorScheme.secondaryContainer,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth().padding(bottom = 14.dp),
                ) {
                    Text(
                        toast ?: "",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                    )
                }
            }

            Text("Store these codes securely", fontSize = 16.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(6.dp))
            Text(
                "Each code works once if you ever lose access to your authenticator. They are shown only now — generating new codes invalidates any unused ones from previous sets.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(20.dp))

            // 2-column grid (web :229-241).
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    state.codes.filterIndexed { i, _ -> i % 2 == 0 }.forEach { CodeCell(it) }
                }
                Column(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    state.codes.filterIndexed { i, _ -> i % 2 == 1 }.forEach { CodeCell(it) }
                }
            }

            Spacer(Modifier.height(20.dp))
            val clipboard = LocalClipboardManager.current
            // t282: "Copy to Clipboard" ellipsized to "Copy to" (capture 76,
            // artifact 13412300323) — OutlinedButton's default 24dp-per-side
            // content padding starved the 10sp label inside a weight(1f)
            // half-row; tightened padding keeps the web's full label
            // (backup-codes-page 'Copy to Clipboard') on one line.
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = {
                        clipboard.setText(androidx.compose.ui.text.AnnotatedString(state.codes.joinToString("\n")))
                        vm.markCopied()
                    },
                    shape = RoundedCornerShape(14.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp),
                    modifier = Modifier.weight(1f).height(46.dp),
                ) {
                    Icon(Icons.Outlined.ContentCopy, null, Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Copy to Clipboard", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
                OutlinedButton(
                    onClick = {
                        // The web builds zylod-backup-codes.txt and downloads it —
                        // Android's equivalent surface is the share sheet.
                        val send = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(
                                Intent.EXTRA_TITLE,
                                "Zylod - Backup Recovery Codes",
                            )
                            putExtra(
                                Intent.EXTRA_TEXT,
                                "Zylod - Backup Recovery Codes\n\n" +
                                    state.codes.mapIndexed { i, c -> "${i + 1}. $c" }.joinToString("\n") +
                                    "\n\nKeep these in a safe place. Generating new codes invalidates any unused ones from previous sets.",
                            )
                        }
                        runCatching {
                            context.startActivity(Intent.createChooser(send, "Save your backup codes"))
                        }
                    },
                    shape = RoundedCornerShape(14.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp),
                    modifier = Modifier.weight(1f).height(46.dp),
                ) {
                    Icon(Icons.Outlined.Share, null, Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Save / Share", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(Modifier.height(12.dp))
            Button(
                onClick = { onBack?.invoke() },
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) {
                Icon(Icons.Outlined.Check, null, Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text("I've Saved These", fontSize = 12.sp, fontWeight = FontWeight.Black)
            }

            Spacer(Modifier.height(24.dp))
            Surface(
                color = MaterialTheme.colorScheme.errorContainer,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(14.dp)) {
                    Text(
                        "High Security Zone",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.sp,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Keep these in a safe place. Generating new codes invalidates any unused ones from previous sets.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                    )
                }
            }
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun CodeCell(code: String) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(10.dp),
        tonalElevation = 1.dp,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(
            code,
            fontSize = 14.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(vertical = 12.dp, horizontal = 8.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
    }
}

@Composable
private fun CodesWall(text: String, onAction: () -> Unit) {
    Box(Modifier.fillMaxWidth().padding(top = 48.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            if (text.startsWith("Generating")) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
            }
            Text(text, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (!text.startsWith("Generating")) {
                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = onAction) { Text("Retry", fontWeight = FontWeight.Bold) }
            }
        }
    }
}
