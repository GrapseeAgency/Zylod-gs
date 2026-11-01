package com.zylod.wholesale.ui.support

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * SHARED typed contact screen (pageId contact-page — the ui/screens
 * delegate calls THIS, so the page keeps its own ContactViewModel).
 *
 * Data truth: contact-us-page.tsx ported 1:1 — the "Email Support" card
 * rendering ONLY the owner-published support.email from
 * GET api/settings/public (the t187-d honest-absence line when nothing is
 * published), the "Send an Inquiry" card with the REAL POST
 * api/support/contact form (name/email/phone/category/subject/message),
 * the route's own 400 text as the client-side required gate, the verbatim
 * server error line (AlertCircle → the proven ErrorOutline), the
 * submitting guard ("Submit Inquiry" disabled in flight) and the 201
 * "Inquiry Received" view with "Send Another Message". The header's Live
 * Chat jump is ported (openPage("live-chat")).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContactScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: ContactViewModel = viewModel(key = "native-support-contact-$pageId") {
        ContactViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            ContactTopBar(onBack = onBack, onLiveChat = { openPage("live-chat", "") })
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                // Contact info — only the REAL published channel.
                Surface(
                    color = MaterialTheme.colorScheme.surfaceContainer,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(
                            Icons.Outlined.Mail,
                            null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(20.dp),
                        )
                        Text(
                            "Email Support",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        if (state.supportEmail.isNotEmpty()) {
                            Text(
                                state.supportEmail,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        } else {
                            Text(
                                "No support email published yet — use the inquiry form below or reach us through the Help Center.",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                        Text(
                            "For anything urgent, use Live Chat — a support team member reviews every message.",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                // Contact form / submitted view.
                Surface(
                    color = MaterialTheme.colorScheme.surfaceContainer,
                    shape = RoundedCornerShape(24.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (state.submitted) {
                        ContactSubmittedView(onSendAnother = vm::reset)
                    } else {
                        ContactForm(state = state, vm = vm)
                    }
                }
            }
        }
    }
}

/* ─── top bar ────────────────────────────────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ContactTopBar(onBack: (() -> Unit)?, onLiveChat: () -> Unit) {
    TopAppBar(
        title = {
            Text(
                "Contact Zylod Support",
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
            )
        },
        navigationIcon = {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Go back", tint = MaterialTheme.colorScheme.onSurface)
                }
            }
        },
        actions = {
            TextButton(onClick = onLiveChat) {
                Icon(
                    Icons.Outlined.Forum,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    "Live Chat",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

/* ─── form ───────────────────────────────────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ContactForm(state: ContactUiState, vm: ContactViewModel) {
    Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Column {
            Text(
                "Send an Inquiry",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                "Fill out this form and our merchant support team will respond promptly.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        // REAL error line — server copy verbatim (web error banner).
        state.error?.let { message ->
            val error = MaterialTheme.colorScheme.error
            Surface(
                color = error.copy(alpha = 0.08f),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(
                        BorderStroke(1.dp, error.copy(alpha = 0.25f)),
                        RoundedCornerShape(12.dp),
                    ),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(12.dp),
                ) {
                    Icon(Icons.Outlined.ErrorOutline, null, tint = error, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        message,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = error,
                    )
                }
            }
        }

        LabeledField("Full Name *") {
            OutlinedTextField(
                value = state.name,
                onValueChange = vm::setName,
                placeholder = { Text("e.g. Tanvir Ahmed", fontSize = 12.sp) },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                colors = contactFieldColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        LabeledField("Email Address *") {
            OutlinedTextField(
                value = state.email,
                onValueChange = vm::setEmail,
                placeholder = { Text("e.g. tanvir@business.com", fontSize = 12.sp) },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                colors = contactFieldColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        LabeledField("Phone Number (Optional)") {
            OutlinedTextField(
                value = state.phone,
                onValueChange = vm::setPhone,
                placeholder = { Text("e.g. 01712345678", fontSize = 12.sp) },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                colors = contactFieldColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        LabeledField("Inquiry Category *") {
            CategoryDropdown(selected = state.category, onSelected = vm::setCategory)
        }
        LabeledField("Subject *") {
            OutlinedTextField(
                value = state.subject,
                onValueChange = vm::setSubject,
                placeholder = { Text("Brief summary of your inquiry", fontSize = 12.sp) },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                colors = contactFieldColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        LabeledField("Message Description *") {
            OutlinedTextField(
                value = state.message,
                onValueChange = vm::setMessage,
                placeholder = {
                    Text(
                        "Provide all relevant wholesale details, order numbers, or supplier questions...",
                        fontSize = 12.sp,
                    )
                },
                minLines = 4,
                maxLines = 8,
                shape = RoundedCornerShape(12.dp),
                textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                colors = contactFieldColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Button(
            onClick = vm::submit,
            enabled = !state.submitting,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(46.dp),
        ) {
            if (state.submitting) {
                Box(
                    Modifier
                        .size(16.dp)
                        .background(
                            MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.35f),
                            RoundedCornerShape(50),
                        ),
                )
                Spacer(Modifier.width(8.dp))
                Text("Submitting...", fontSize = 13.sp, fontWeight = FontWeight.Bold)
            } else {
                Icon(Icons.AutoMirrored.Outlined.Send, null, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(8.dp))
                Text("Submit Inquiry", fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** The web field label above each input. */
@Composable
private fun LabeledField(label: String, content: @Composable () -> Unit) {
    Column {
        Text(
            label,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Spacer(Modifier.height(6.dp))
        content()
    }
}

private fun contactFieldColors() = OutlinedTextFieldDefaults.colors(
    unfocusedContainerColor = androidx.compose.ui.graphics.Color.Transparent,
    focusedContainerColor = androidx.compose.ui.graphics.Color.Transparent,
)

/** The web <select> — the five REAL category values, verbatim labels. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CategoryDropdown(selected: String, onSelected: (String) -> Unit) {
    val expanded = remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded.value, onExpandedChange = { expanded.value = it }) {
        OutlinedTextField(
            value = CONTACT_CATEGORIES.firstOrNull { it.value == selected }?.label.orEmpty(),
            onValueChange = {},
            readOnly = true,
            shape = RoundedCornerShape(12.dp),
            textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
            colors = contactFieldColors(),
            trailingIcon = {
                Icon(Icons.Outlined.ExpandMore, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
        )
        ExposedDropdownMenu(expanded = expanded.value, onDismissRequest = { expanded.value = false }) {
            CONTACT_CATEGORIES.forEach { category ->
                DropdownMenuItem(
                    text = { Text(category.label, fontSize = 12.sp) },
                    onClick = {
                        onSelected(category.value)
                        expanded.value = false
                    },
                )
            }
        }
    }
}

/* ─── submitted view ─────────────────────────────────────────────────────── */

@Composable
private fun ContactSubmittedView(onSendAnother: () -> Unit) {
    val success = LocalZylodExtra.current.success
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(56.dp)
                .background(success.copy(alpha = 0.12f), RoundedCornerShape(50)),
        ) {
            Icon(
                Icons.Outlined.CheckCircle,
                null,
                tint = success,
                modifier = Modifier.size(32.dp),
            )
        }
        Text(
            "Inquiry Received",
            fontSize = 17.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            "Thank you for contacting Zylod Wholesale. A support representative will review your message and reach out via phone or email within 24 hours.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Button(
            onClick = onSendAnother,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 8.dp)
                .height(40.dp),
        ) {
            Text("Send Another Message", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}
