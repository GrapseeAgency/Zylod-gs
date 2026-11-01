package com.zylod.wholesale.ui.complaints

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.rewards.RewardsAuthGate

/**
 * The web raise-complaint page's rose accent (its select/border language),
 * parsed once — the t259 tint convention (the screen owns colors).
 */
private val RaiseRose = Color(0xFFE11D48)

/**
 * SHARED typed raise-complaint surface (pageIds raise-complaint AND
 * raise-dispute — both load the SAME web component,
 * raise-complaint-page.tsx, so both render the identical form here).
 *
 * Structure mirrors raise-complaint-page.tsx 1:1: the Associated Order
 * card (the entry query's order, or the honest "No specific order
 * attached"), the complaint-type select (the web's five REAL options),
 * the three desired-resolution buttons + the display-only claim-amount
 * field (the web renders it for refund/partial and sends NOTHING —
 * mirrored), the Detailed Statement & Evidence box with the web's
 * evidence copy (photos cannot be uploaded here — Help Center / published
 * support email), the honest no-escrow protection note, and the submit
 * that POSTs api/support/report-problem. Success is the web's reference
 * screen (the REAL saved id + its copy verbatim); 401/403 is the web's
 * AccountGate. Honest error states with the server's verbatim text —
 * nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RaiseComplaintScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: RaiseComplaintViewModel = viewModel(key = "native-raise-complaint-$pageId") {
        RaiseComplaintViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Entry resolve on EVERY entry (ReturnRequestViewModel.load convention).
    LaunchedEffect(Unit) { vm.load(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            RaiseTopBar(title = "Raise Complaint", onBack = onBack)
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            when {
                state.sessionExpired -> RewardsAuthGate(
                    title = "Sign in to raise a complaint",
                    body = "Complaints are saved to your account so the Zylod team can follow up. Sign in to continue.",
                    onSignIn = { openPage("login", "") },
                )
                state.submitted -> SubmittedReference(
                    reference = state.reference,
                    onHelpCenter = { openPage("help-center", "") },
                )
                else -> RaiseForm(state = state, vm = vm)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RaiseTopBar(title: String, onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                title,
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
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

/** The REAL 201 reference screen — the web's own copy verbatim. */
@Composable
private fun SubmittedReference(reference: String, onHelpCenter: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 48.dp),
    ) {
        Icon(
            Icons.Outlined.CheckCircle,
            null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(56.dp),
        )
        Text(
            "Complaint Saved",
            fontSize = 18.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            (if (reference.isNotBlank()) "Reference: $reference. " else "") +
                "Your complaint has been saved to our inbox for review by the Zylod team — we reply by email when " +
                "action is needed. Zylod does not hold funds in escrow; approved refunds go back to your original " +
                "payment method.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        Button(
            onClick = onHelpCenter,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .padding(top = 24.dp)
                .fillMaxWidth()
                .height(48.dp),
        ) {
            Text("Back to Help Center", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun RaiseForm(state: RaiseComplaintUiState, vm: RaiseComplaintViewModel) {
    // Associated Order card (the web's Order Target Card).
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .border(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                RoundedCornerShape(20.dp),
            ),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                "ASSOCIATED ORDER",
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                if (state.orderId.isNotBlank()) "#${state.orderId}" else "No specific order attached",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }

    state.errorMsg?.let { message ->
        Surface(
            color = MaterialTheme.colorScheme.error.copy(alpha = 0.08f),
            shape = RoundedCornerShape(16.dp),
        ) {
            Text(
                message,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
            )
        }
    }

    // Complaint Type card.
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                "COMPLAINT TYPE *",
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            TypeDropdown(selected = state.complaintType, onSelected = vm::setComplaintType)
        }
    }

    // Requested Resolution card — the web's three buttons + display-only amount.
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                "REQUESTED RESOLUTION *",
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                RAISE_OUTCOMES.forEach { (value, label) ->
                    val selected = state.desiredOutcome == value
                    Surface(
                        color = if (selected) RaiseRose.copy(alpha = 0.08f) else MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .border(
                                1.dp,
                                if (selected) RaiseRose else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                                RoundedCornerShape(12.dp),
                            )
                            .clickable(onClick = { vm.setDesiredOutcome(value) }),
                    ) {
                        Text(
                            label,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (selected) RaiseRose else MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 10.dp),
                        )
                    }
                }
            }
            if (state.desiredOutcome == "refund" || state.desiredOutcome == "partial") {
                // DISPLAY-ONLY: the web renders this field for refund/partial
                // and never sends it — mirrored exactly (no fabricated claim).
                OutlinedTextField(
                    value = state.refundAmount,
                    onValueChange = vm::setRefundAmount,
                    placeholder = { Text("e.g. 12500", fontSize = 12.sp) },
                    shape = RoundedCornerShape(12.dp),
                    textStyle = MaterialTheme.typography.bodyMedium.copy(
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }

    // Statement & Evidence card.
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                "DETAILED STATEMENT & EVIDENCE *",
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = state.statement,
                onValueChange = vm::setStatement,
                placeholder = {
                    Text(
                        if (state.supportEmail.isNotBlank()) {
                            "Explain what went wrong, and email photos/video to ${state.supportEmail} with your reference afterwards..."
                        } else {
                            "Explain what went wrong. Afterwards, share photos/video with the Zylod team through the Help Center using your reference..."
                        },
                        fontSize = 12.sp,
                    )
                },
                shape = RoundedCornerShape(14.dp),
                textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                minLines = 4,
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                if (state.supportEmail.isNotBlank()) {
                    "Photo or video evidence cannot be uploaded here yet — include it in your follow-up email to ${state.supportEmail}."
                } else {
                    "Photo or video evidence cannot be uploaded here yet — share it with the Zylod team through the Help Center afterwards."
                },
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }

    // Honest protection info (the web's own copy verbatim).
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(16.dp),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
            Icon(
                Icons.Outlined.VerifiedUser,
                null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.width(10.dp))
            Text(
                "Zylod does not hold payments in escrow. Your complaint is reviewed by the Zylod team and the outcome " +
                    "is documented — nothing is decided automatically.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }

    Button(
        onClick = vm::submit,
        enabled = !state.submitting && state.statement.trim().isNotBlank(),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier
            .fillMaxWidth()
            .height(48.dp),
    ) {
        Text(
            if (state.submitting) "Submitting..." else "Submit Complaint",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TypeDropdown(selected: String, onSelected: (String) -> Unit) {
    val expanded = remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded.value, onExpandedChange = { expanded.value = it }) {
        OutlinedTextField(
            value = RAISE_COMPLAINT_TYPES.firstOrNull { it.first == selected }?.second.orEmpty(),
            onValueChange = {},
            readOnly = true,
            shape = RoundedCornerShape(14.dp),
            textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
            trailingIcon = {
                Icon(Icons.Outlined.ExpandMore, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
        )
        ExposedDropdownMenu(
            expanded = expanded.value,
            onDismissRequest = { expanded.value = false },
        ) {
            RAISE_COMPLAINT_TYPES.forEach { (value, label) ->
                DropdownMenuItem(
                    text = { Text(label, fontSize = 12.sp) },
                    onClick = {
                        expanded.value = false
                        onSelected(value)
                    },
                )
            }
        }
    }
}
