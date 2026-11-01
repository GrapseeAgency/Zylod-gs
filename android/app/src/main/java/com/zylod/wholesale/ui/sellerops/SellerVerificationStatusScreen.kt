package com.zylod.wholesale.ui.sellerops

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.SellerOpsVerificationDoc

/**
 * t266 — SHARED typed Seller Verification Status screen (pageId
 * "seller-verification-status" — the ui/screens delegate calls THIS, so the
 * page keeps its own SellerVerificationStatusViewModel). A STATUS surface,
 * not a list console: the route's honest progress card (only VERIFIED rows
 * count, and only the four required document types — rendered as a
 * segmented progress strip, no fabricated percent), the required-types
 * checklist with each type's latest real status, and one elevated card per
 * uploaded document (file name, size, upload/review dates, rejection
 * reason when present). Honest loading / not-seller / offline / empty
 * states; theme colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun SellerVerificationStatusScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SellerVerificationStatusViewModel = viewModel(key = "native-seller-ops-$pageId") {
        SellerVerificationStatusViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    SellerOpsPageScaffold(title = "Seller Verification Status", onBack = onBack) {
        when {
            state.loading -> SellerOpsCenterSpinner()
            state.notSeller -> SellerOpsGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> SellerOpsOfflineEmpty(
                message = "No verification data saved yet — connect once to save it",
                onRetry = vm::retry,
            )
            else -> VerificationList(state)
        }
    }
}

@Composable
private fun VerificationList(state: SellerVerificationStatusUiState) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        state.progress?.let { progress ->
            item(key = "ver-progress", contentType = "progress-card") {
                ProgressCard(
                    verified = progress.verifiedRequired,
                    total = progress.totalRequired,
                    percent = progress.percent,
                )
            }
            if (progress.requiredTypes.isNotEmpty()) {
                item(key = "ver-checklist-header", contentType = "header") {
                    SellerOpsSectionHeader(
                        "Required documents",
                        "Latest submission per required type — only verified rows count",
                    )
                }
                items(
                    progress.requiredTypes,
                    key = { "req-$it" },
                    contentType = { "req-row" },
                ) { type ->
                    ChecklistRow(type, latestStatusFor(state.docs, type))
                }
            }
        }
        when {
            state.offline -> item(key = "ver-offline", contentType = "banner") {
                SellerOpsBanner("Connection lost — showing the last loaded verification data")
            }
            state.offlineFromCache -> item(key = "ver-cache", contentType = "banner") {
                SellerOpsBanner("Offline — showing saved verification data")
            }
        }
        if (state.refreshing) {
            item(key = "ver-refreshing", contentType = "progress") { SellerOpsRefreshingBar() }
        }
        if (state.docs.isEmpty()) {
            item(key = "ver-empty", contentType = "empty") {
                Text(
                    "No documents uploaded yet — verification uploads land here once reviewed by the platform.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            item(key = "ver-docs-header", contentType = "header") {
                SellerOpsSectionHeader(
                    "Uploaded documents",
                    "${state.docs.size} submission${if (state.docs.size != 1) "s" else ""} · newest first",
                )
            }
            items(
                state.docs,
                key = { "doc-${it.id ?: it.hashCode()}" },
                contentType = { "doc-row" },
            ) { doc ->
                DocumentCard(doc)
            }
        }
        item(key = "ver-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** Latest document row of [type] — the route orders newest-upload first. */
private fun latestStatusFor(docs: List<SellerOpsVerificationDoc>, type: String): SellerOpsVerificationDoc? =
    docs.firstOrNull { it.documentType == type }

/** The honest progress card: segmented strip + counts (no fake percent bar). */
@Composable
private fun ProgressCard(verified: Int, total: Int, percent: Int) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "Verification progress",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        "$verified of $total required documents verified",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Text(
                    "$percent%",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black,
                    color = if (verified >= total && total > 0) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    },
                )
            }
            if (total > 0) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 10.dp),
                ) {
                    repeat(total) { index ->
                        val done = index < verified
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(6.dp)
                                .background(
                                    color = if (done) {
                                        MaterialTheme.colorScheme.primary
                                    } else {
                                        MaterialTheme.colorScheme.surfaceVariant
                                    },
                                    shape = RoundedCornerShape(50),
                                ),
                        )
                    }
                }
            }
        }
    }
}

/** One required-type checklist line with its latest real status. */
@Composable
private fun ChecklistRow(type: String, latest: SellerOpsVerificationDoc?) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
    ) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .background(
                    color = sellerOpsStatusColor(latest?.status ?: "not_uploaded"),
                    shape = CircleShape,
                ),
        )
        Spacer(Modifier.width(8.dp))
        Column(Modifier.weight(1f)) {
            Text(
                type.replace('_', ' ').replaceFirstChar { it.uppercase() },
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                latest?.let { doc ->
                    val reviewed = doc.reviewedAt?.let { sellerOpsDate(it) }.orEmpty()
                    "Latest: ${doc.status?.replace('_', ' ') ?: "unknown"}" +
                        if (reviewed.isBlank()) "" else " · reviewed $reviewed"
                } ?: "Not uploaded",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        SellerOpsStatusBadge(
            latest?.status?.replace('_', ' ') ?: "Not uploaded",
            latest?.status ?: "not_uploaded",
        )
    }
}

/** One uploaded-document row: file, size, dates, rejection reason. */
@Composable
private fun DocumentCard(doc: SellerOpsVerificationDoc) {
    val uploadedLabel = remember(doc) { sellerOpsDateOrDash(doc.uploadedAt) }
    val reviewedLabel = remember(doc) { sellerOpsDateOrDash(doc.reviewedAt) }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        doc.documentType?.replace('_', ' ')?.replaceFirstChar { it.uppercase() }
                            ?: "Document",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        doc.fileName ?: "Unnamed file",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                SellerOpsStatusBadge(
                    doc.status?.replace('_', ' ') ?: "unknown",
                    doc.status.orEmpty(),
                )
            }
            doc.fileSize?.takeIf(String::isNotBlank)?.let {
                SellerOpsKeyValue("Size:", "$it bytes")
            }
            SellerOpsKeyValue("Uploaded:", uploadedLabel)
            if (doc.reviewedAt != null) {
                SellerOpsKeyValue("Reviewed:", reviewedLabel)
            }
            doc.rejectionReason?.takeIf(String::isNotBlank)?.let {
                SellerOpsKeyValue("Rejection reason:", it)
            }
        }
    }
}
