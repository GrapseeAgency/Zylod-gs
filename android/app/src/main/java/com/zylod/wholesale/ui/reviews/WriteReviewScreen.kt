package com.zylod.wholesale.ui.reviews

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * SHARED typed write-review screen (pageId rate-products — the ui/screens
 * delegate calls THIS, so the page keeps its own WriteReviewViewModel).
 *
 * Data truth: POST api/reviews via [WriteReviewViewModel] — the REAL
 * buyer-only create route. Structure mirrors write-review-page.tsx 1:1:
 * the honest sign-in gate (before typing), the "OVERALL QUALITY RATING"
 * card with the interactive 5-star input and its label ("Exceptional
 * Quality" / "Very Good" / "Average" / "Below Expectation"), the headline
 * + detailed-feedback card, the REAL error line (server copy verbatim —
 * 400/404/409/429), the sticky "Submit Review" bar with its
 * "Publishing Review..." in-flight state, and the "Review Submitted!"
 * view whose "View All Reviews" jumps back to the reviews list with the
 * product id. The web's image-upload tile is deliberately NOT ported:
 * the route only accepts /uploads/review-media/ urls and there is no
 * native upload client — nothing is faked.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WriteReviewScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: WriteReviewViewModel = viewModel(key = "native-write-review-$pageId") {
        WriteReviewViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            WriteReviewTopBar(onBack = onBack)
        },
        bottomBar = {
            if (!state.needsAuth && !state.submitted) {
                SubmitBar(
                    submitting = state.submitting,
                    onSubmit = vm::submit,
                )
            }
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            when {
                // Honest gate for signed-out users BEFORE they type a review
                // that could never be submitted (the buyer-only route).
                state.needsAuth -> WriteReviewAuthGate()
                // Real 201 → the web's submitted view.
                state.submitted -> SubmittedView(
                    productId = state.productId,
                    openPage = openPage,
                )
                else -> WriteReviewForm(state = state, vm = vm)
            }
        }
    }
}

/* ─── top bar ────────────────────────────────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WriteReviewTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Write a Review",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
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

/* ─── form ───────────────────────────────────────────────────────────────── */

@Composable
private fun WriteReviewForm(state: WriteReviewUiState, vm: WriteReviewViewModel) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        // Star rating card (web: centered card, amber interactive stars).
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
            ) {
                Text(
                    "Overall Quality Rating".uppercase(),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
                ) {
                    repeat(5) { star ->
                        val active = star < state.rating
                        Icon(
                            if (active) Icons.Filled.Star else Icons.Outlined.Star,
                            if (active) "Rated ${star + 1} stars" else "Rate ${star + 1} stars",
                            tint = if (active) {
                                LocalZylodExtra.current.warning
                            } else {
                                MaterialTheme.colorScheme.outlineVariant
                            },
                            modifier = Modifier
                                .size(32.dp)
                                .clickable(onClick = { vm.setRating(star + 1) }),
                        )
                    }
                }
                Text(
                    when (state.rating) {
                        5 -> "Exceptional Quality"
                        4 -> "Very Good"
                        3 -> "Average"
                        else -> "Below Expectation"
                    },
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }

        // Headline + feedback + durability card.
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Column {
                    Text(
                        "Review Headline",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Spacer(Modifier.height(6.dp))
                    OutlinedTextField(
                        value = state.title,
                        onValueChange = vm::setTitle,
                        placeholder = {
                            Text("e.g., Exceptional build quality and fast lead time", fontSize = 12.sp)
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                        colors = OutlinedTextFieldDefaults.colors(
                            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                            focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                        ),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                Column {
                    Text(
                        "Detailed Feedback",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Spacer(Modifier.height(6.dp))
                    OutlinedTextField(
                        value = state.comment,
                        onValueChange = vm::setComment,
                        placeholder = {
                            Text(
                                "Share specific details regarding durability, packaging, shipment handling, or tolerances...",
                                fontSize = 12.sp,
                            )
                        },
                        minLines = 4,
                        maxLines = 8,
                        shape = RoundedCornerShape(12.dp),
                        textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                        colors = OutlinedTextFieldDefaults.colors(
                            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                            focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                        ),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                // Durability — the wire field the POST always carries; the
                // native surface renders the real selector the web state
                // implies (high/medium/low) instead of a silent constant.
                Column {
                    Text(
                        "Durability",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        DurabilityOption("High", "high", state.durability, vm::setDurability, Modifier.weight(1f))
                        DurabilityOption("Medium", "medium", state.durability, vm::setDurability, Modifier.weight(1f))
                        DurabilityOption("Low", "low", state.durability, vm::setDurability, Modifier.weight(1f))
                    }
                }
            }
        }

        // REAL server error — shown verbatim (web error line).
        state.error?.let { message ->
            val error = MaterialTheme.colorScheme.error
            Surface(
                color = error.copy(alpha = 0.08f),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, error.copy(alpha = 0.25f), RoundedCornerShape(12.dp)),
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
    }
}

/** One of the three durability choices (high/medium/low on the wire). */
@Composable
private fun DurabilityOption(
    label: String,
    value: String,
    selected: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val active = selected == value
    Surface(
        color = if (active) {
            MaterialTheme.colorScheme.primary
        } else {
            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
        },
        shape = RoundedCornerShape(12.dp),
        modifier = modifier.clickable(onClick = { onSelect(value) }),
    ) {
        Text(
            label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = if (active) {
                MaterialTheme.colorScheme.onPrimary
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant
            },
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 10.dp),
        )
    }
}

/* ─── sticky submit bar ──────────────────────────────────────────────────── */

@Composable
private fun SubmitBar(submitting: Boolean, onSubmit: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f),
        ),
    ) {
        Button(
            onClick = onSubmit,
            enabled = !submitting,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .height(48.dp),
        ) {
            Text(
                if (submitting) "Publishing Review..." else "Submit Review",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

/* ─── submitted view ─────────────────────────────────────────────────────── */

/** Web success view: check circle, thanks copy, "View All Reviews" jump. */
@Composable
private fun SubmittedView(
    productId: String,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val success = LocalZylodExtra.current.success
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 48.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(64.dp)
                .background(success.copy(alpha = 0.12f), RoundedCornerShape(50)),
        ) {
            Icon(
                Icons.Outlined.CheckCircle,
                null,
                tint = success,
                modifier = Modifier.size(40.dp),
            )
        }
        Text(
            "Review Submitted!",
            fontSize = 20.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Thank you for sharing your experience. Your feedback helps other enterprise buyers source with confidence.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        Button(
            onClick = { openPage("product-reviews-list", "productId=$productId") },
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(44.dp),
        ) {
            Text(
                "View All Reviews",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

/**
 * Honest gate for signed-out users (web 401 truth moved BEFORE typing):
 * reviews are tied to the buyer account, so a guest sees the gate, never
 * a form that could only fail with 401.
 */
@Composable
private fun WriteReviewAuthGate() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp, vertical = 64.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(80.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
        ) {
            Icon(
                Icons.Outlined.Lock,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text(
            "Sign in to write a review",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Reviews are tied to your buyer account. Sign in to rate the products you bought.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}
