package com.zylod.wholesale.ui.account

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.QrCode2
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.Smartphone
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * t280 — typed 2FA enrollment (two-factor-auth-page port). The LOGIN
 * challenge stays in ui/auth/TwoFactorAuthScreen (NavHost route); this is
 * the account-settings entry: method select → QR/manual key → verify →
 * backup-codes hop. Registry delegation: ui/screens/TwoFactorAuthScreen.kt.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TwoFactorSetupScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: TwoFactorSetupViewModel = viewModel(
        key = "native-two-factor-setup",
    ) { TwoFactorSetupViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.enabledTick) {
        if (state.enabledTick > 0) openPage("backup-codes", "")
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Two-Factor Authentication", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
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
            if (state.needsAuth) {
                FactorWall("Sign in to manage two-factor authentication.") { openPage("login", "") }
                return@Column
            }
            if (state.error != null) {
                FactorWall(state.error ?: "Setup failed") { vm.startSetup() }
                return@Column
            }

            when (state.step) {
                TwoFactorStep.SELECT -> SelectStep(state, vm)
                TwoFactorStep.SETUP -> SetupStep(state, vm)
                TwoFactorStep.VERIFY -> VerifyStep(state, vm)
                TwoFactorStep.DONE -> {
                    // One-line stop — the LaunchedEffect hop covers navigation.
                    Box(Modifier.fillMaxWidth().padding(top = 48.dp), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Outlined.Check, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(40.dp))
                            Spacer(Modifier.height(10.dp))
                            Text("2FA enabled — generating your backup codes…", fontSize = 13.sp)
                        }
                    }
                }
            }
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun FactorWall(text: String, onAction: () -> Unit) {
    Box(Modifier.fillMaxWidth().padding(top = 48.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(12.dp))
            OutlinedButton(onClick = onAction) { Text("Retry", fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
private fun SelectStep(state: TwoFactorSetupUiState, vm: TwoFactorSetupViewModel) {
    Text("Choose how you want to receive your verification codes.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Spacer(Modifier.height(16.dp))

    MethodCard(
        icon = Icons.Outlined.QrCode2,
        title = "Authenticator App",
        sub = "Use Google Authenticator or Authy to scan a QR code and generate codes.",
        enabled = true,
        selected = state.method == "authenticator",
        onClick = { vm.selectMethod("authenticator") },
    )
    MethodCard(
        icon = Icons.Outlined.Smartphone,
        title = "SMS Message",
        sub = if (state.hasPhone) {
            "We'll text a 6-digit code to your registered phone number."
        } else {
            "No phone number on this account. Add one in Profile to enable SMS codes."
        },
        enabled = state.hasPhone,
        selected = state.method == "sms",
        onClick = { vm.selectMethod("sms") },
    )

    Spacer(Modifier.height(20.dp))
    Button(
        onClick = { vm.startSetup() },
        enabled = (state.method == "authenticator" || state.hasPhone),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth().height(48.dp),
    ) { Text("Continue", fontSize = 12.sp, fontWeight = FontWeight.Black) }
}

@Composable
private fun MethodCard(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, sub: String, enabled: Boolean, selected: Boolean, onClick: () -> Unit) {
    Surface(
        color = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
        contentColor = if (selected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface,
        shape = RoundedCornerShape(16.dp),
        tonalElevation = 1.dp,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp)
            .let { m -> if (enabled) m.clickable(onClick = onClick) else m },
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(16.dp)) {
            Icon(icon, title, tint = if (enabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Text(sub, fontSize = 11.sp, color = if (enabled) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.outline)
            }
        }
    }
}

@Composable
private fun SetupStep(state: TwoFactorSetupUiState, vm: TwoFactorSetupViewModel) {
    if (state.method == "authenticator") {
        Text("Set Up Authenticator", fontSize = 16.sp, fontWeight = FontWeight.Black)
        Spacer(Modifier.height(6.dp))
        Text("Scan the QR code with your authenticator app, or enter the key manually.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(20.dp))

        Surface(
            color = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(16.dp),
            tonalElevation = 1.dp,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(20.dp),
            ) {
                val otpauth = state.otpauth
                if (otpauth != null) {
                    val qr: Bitmap? by produceState<Bitmap?>(null, otpauth) {
                        value = withContext(Dispatchers.Default) { QrBitmap.generate(otpauth, 420) }
                    }
                    if (qr != null) {
                        Image(
                            bitmap = qr!!.asImageBitmap(),
                            contentDescription = "2FA QR code — scan with your authenticator app",
                            modifier = Modifier.size(200.dp),
                        )
                    } else {
                        Text("QR rendering failed — use the manual key below.", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                    }
                }
                Spacer(Modifier.height(16.dp))
                Text("Manual Entry Key", fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp, color = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.height(6.dp))
                val clipboard = LocalClipboardManager.current
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 12.dp, end = 4.dp, top = 4.dp, bottom = 4.dp)) {
                        Text(
                            state.secret ?: "",
                            fontSize = 13.sp,
                            fontFamily = FontFamily.Monospace,
                            modifier = Modifier.weight(1f).padding(vertical = 8.dp),
                        )
                        IconButton(onClick = {
                            clipboard.setText(androidx.compose.ui.text.AnnotatedString(state.secret ?: ""))
                        }) {
                            Icon(Icons.Outlined.ContentCopy, "Copy secret key", modifier = Modifier.size(18.dp))
                        }
                    }
                }
                if (state.accountName != null) {
                    Spacer(Modifier.height(8.dp))
                    Text("Account: ${state.accountName}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        Spacer(Modifier.height(20.dp))
        Button(
            onClick = { vm.advanceToVerify() },
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth().height(48.dp),
        ) { Text("I've Set Up My Authenticator", fontSize = 12.sp, fontWeight = FontWeight.Black) }
    } else {
        // SMS setup.
        Icon(Icons.Outlined.Smartphone, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(40.dp))
        Spacer(Modifier.height(10.dp))
        Text("Verification code sent to your phone", fontSize = 16.sp, fontWeight = FontWeight.Black)
        Spacer(Modifier.height(6.dp))
        Text("The code expires in 5 minutes.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (state.debugCode != null) {
            Spacer(Modifier.height(10.dp))
            Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(10.dp)) {
                Text(
                    "Dev server code: ${state.debugCode}",
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier.padding(10.dp),
                )
            }
        }
        Spacer(Modifier.height(20.dp))
        Button(
            onClick = { vm.advanceToVerify() },
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth().height(48.dp),
        ) { Text("Enter the Code", fontSize = 12.sp, fontWeight = FontWeight.Black) }
        Spacer(Modifier.height(8.dp))
        OutlinedButton(
            onClick = { vm.resendSms() },
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth().height(44.dp),
        ) { Text("Resend Code", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
    }
}

@Composable
private fun VerifyStep(state: TwoFactorSetupUiState, vm: TwoFactorSetupViewModel) {
    Icon(Icons.Outlined.Shield, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(40.dp))
    Spacer(Modifier.height(10.dp))
    Text("Verification Code", fontSize = 16.sp, fontWeight = FontWeight.Black)
    Spacer(Modifier.height(6.dp))
    Text(
        if (state.method == "sms") "Enter the code sent to your phone" else "Enter the rotating 6-digit code shown in your authenticator app",
        fontSize = 12.sp,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    Spacer(Modifier.height(20.dp))
    OutlinedTextField(
        value = state.code,
        onValueChange = vm::setCode,
        label = { Text("6-digit code") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        modifier = Modifier.fillMaxWidth(),
    )
    if (state.verifyError != null) {
        Spacer(Modifier.height(10.dp))
        Text(state.verifyError ?: "", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
    }
    if (state.suspended != null) {
        Spacer(Modifier.height(10.dp))
        Surface(color = MaterialTheme.colorScheme.errorContainer, shape = RoundedCornerShape(10.dp)) {
            Column(Modifier.padding(12.dp)) {
                Text("Account is suspended", fontSize = 12.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onErrorContainer)
                Text(
                    "Reference ${state.suspended?.reference ?: "—"}: ${state.suspended?.reason ?: "contact support"}",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                )
            }
        }
    }
    Spacer(Modifier.height(20.dp))
    Button(
        onClick = { vm.verify() },
        enabled = state.code.length >= 6 && !state.submitting,
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth().height(48.dp),
    ) {
        if (state.submitting) {
            CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
        } else {
            Icon(Icons.Outlined.Lock, null, Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text("Secure My Account", fontSize = 12.sp, fontWeight = FontWeight.Black)
        }
    }
    Spacer(Modifier.height(8.dp))
    OutlinedButton(
        onClick = { vm.setCode("") },
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth().height(44.dp),
    ) { Text("Clear", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
}
