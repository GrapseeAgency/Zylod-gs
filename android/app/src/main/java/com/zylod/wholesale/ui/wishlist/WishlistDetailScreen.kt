package com.zylod.wholesale.ui.wishlist

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material3.AlertDialog
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
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.painter.ColorPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.zylod.wholesale.ui.rewards.RewardsAuthGate
import com.zylod.wholesale.ui.rewards.RewardsErrorCard
import com.zylod.wholesale.ui.rewards.RewardsOfflineBanner

/**
 * SHARED typed wishlist-detail surface (pageId wishlist-detail).
 *
 * WEB TRUTH (wishlist-detail-page.tsx, mirrored 1:1 with documented
 * deviations): GET api/wishlist/{itemId} draws the full-bleed product
 * image, the name, the base price "/ unit", the supplier row with its
 * VERIFIED badge, the Personal Note editor (Save disabled while saving or
 * unchanged — the web's exact button condition; no success toast exists on
 * the web so none is invented), and the Remove-from-Wishlist ghost action
 * behind confirm('Remove from wishlist?') → DELETE api/wishlist/{itemId} →
 * goBack(). Documented deviations: the web's "-5% this week" price-drop
 * badge is a HARDCODED fake with no data behind it — not mirrored (zero
 * fabricated data); the web's dead "Move to Collection" button (no onClick,
 * no endpoint) is not mirrored; the row-level "Add to Cart" routes to the
 * native PDP where the real cart contract (supplier id, variants, MOQ)
 * lives.
 *
 * Honest states: no id in the entry query → the web's "Item not found."
 * card; 404 → the route's verbatim 'Wishlist item not found'; signed-out →
 * the sign-in gate (the web's fetch would silently fall into its not-found
 * card — the native surfaces the real reason); offline → the per-item disk
 * cache with the banner.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WishlistDetailScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: WishlistDetailViewModel = viewModel(key = "native-wishlist-detail-$pageId") {
        WishlistDetailViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Entry resolve on EVERY entry (ReturnRequestViewModel.load convention).
    LaunchedEffect(Unit) { vm.load(query) }

    // The remove confirm (BankAccountsScreen pendingDelete pattern) —
    // screen-local; the VM stays dialog-free.
    var removeAsked by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { DetailTopBar(onBack = onBack) },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            when {
                state.loading -> Box(
                    Modifier.fillMaxWidth().height(320.dp),
                    contentAlignment = Alignment.Center,
                ) { CircularProgressIndicator() }
                state.needsAuth -> RewardsAuthGate(
                    title = "Sign in to see this wishlist item",
                    body = "Wishlist items belong to your account — sign in to view the saved product, its note and its price.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    RewardsErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                state.notFound || !state.hasId -> NotFoundCard(onBack = onBack)
                else -> DetailBody(state = state, vm = vm, openPage = openPage, onAskRemove = { removeAsked = true })
            }
            Spacer(Modifier.height(24.dp))
        }
    }

    if (removeAsked) {
        AlertDialog(
            onDismissRequest = { removeAsked = false },
            title = {
                Text("Remove from wishlist?", fontSize = 16.sp, fontWeight = FontWeight.Black)
            },
            text = {
                // The web confirm's exact text (window.confirm argument).
                Text("Remove from wishlist?", fontSize = 12.sp)
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        removeAsked = false
                        vm.removeConfirmed(onRemoved = { onBack?.invoke() })
                    },
                    enabled = !state.removing,
                ) {
                    Text(
                        "Remove",
                        color = MaterialTheme.colorScheme.error,
                        fontWeight = FontWeight.Bold,
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { removeAsked = false }) {
                    Text("Keep it", fontWeight = FontWeight.Bold)
                }
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DetailTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Wishlist Item",
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

/** The web's not-found card — verbatim copy ("Item not found." + Go Back). */
@Composable
private fun NotFoundCard(onBack: (() -> Unit)?) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp, vertical = 96.dp),
    ) {
        Icon(
            Icons.Outlined.Inventory2,
            null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(36.dp),
        )
        Text(
            "Item not found.",
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 12.dp),
        )
        Button(
            onClick = { onBack?.invoke() },
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.padding(top = 16.dp),
        ) {
            Text("Go Back", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun DetailBody(
    state: WishlistDetailUiState,
    vm: WishlistDetailViewModel,
    openPage: (pageId: String, query: String) -> Unit,
    onAskRemove: () -> Unit,
) {
    val context = LocalContext.current
    val detail = state.detail
    if (detail == null) return
    val product = detail.product
    val name = product?.name?.takeIf(String::isNotBlank) ?: "Unnamed product"
    val imageUrl = remember(product?.firstImage) { resolveDetailImageUrl(product?.firstImage) }

    if (state.offlineFromCache) {
        RewardsOfflineBanner("Offline — showing the last saved item")
    }
    state.noteError?.let { message ->
        InlineDetailNote(text = message, success = false, onDismiss = vm::consumeNoteError)
    }
    state.removeError?.let { message ->
        InlineDetailNote(text = message, success = false, onDismiss = vm::consumeRemoveError)
    }

    val placeholderColor = MaterialTheme.colorScheme.surfaceVariant
    val placeholder = remember(placeholderColor) { ColorPainter(placeholderColor) }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .background(placeholderColor),
    ) {
        if (imageUrl != null) {
            AsyncImage(
                model = remember(imageUrl) { ImageRequest.Builder(context).data(imageUrl).crossfade(200).build() },
                contentDescription = name,
                placeholder = placeholder,
                error = placeholder,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Icon(
                Icons.Outlined.FavoriteBorder,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.align(Alignment.Center).size(36.dp),
            )
        }
    }

    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            name,
            fontSize = 17.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                wishlistBdtLabel(product?.basePrice),
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary,
            )
            Text(
                "/ ${product?.unit?.takeIf(String::isNotBlank) ?: "unit"}",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(10.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(10.dp)) {
                Text(
                    "Supplier:",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.width(70.dp),
                )
                Text(
                    product?.supplier?.companyName?.takeIf(String::isNotBlank) ?: "Unknown supplier",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                if (product?.supplier?.isVerified == true) {
                    Text(
                        "VERIFIED",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
        }
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Personal Note", fontSize = 13.sp, fontWeight = FontWeight.Black)
                OutlinedTextField(
                    value = state.note,
                    onValueChange = vm::setNote,
                    placeholder = {
                        Text(
                            "Add details like required size, color, or target price...",
                            fontSize = 12.sp,
                        )
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(96.dp),
                )
                Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                    if (state.savingNote) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(8.dp))
                    }
                    TextButton(
                        onClick = vm::saveNote,
                        enabled = !state.savingNote && state.note != (detail.note ?: ""),
                    ) {
                        Text(
                            if (state.savingNote) "Saving..." else "Save Note",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }
        Button(
            onClick = { detail.productId?.let { openPage("product-detail", "productId=$it") } },
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
        ) {
            Icon(Icons.Outlined.ShoppingCart, null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text("Add to Cart", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        OutlinedButton(
            onClick = onAskRemove,
            enabled = !state.removing,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
        ) {
            if (state.removing) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
            } else {
                Icon(
                    Icons.Outlined.DeleteOutline,
                    null,
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(16.dp),
                )
            }
            Spacer(Modifier.width(8.dp))
            Text(
                "Remove from Wishlist",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.error,
            )
        }
    }
}

/** Inline verbatim failure note (note save / remove). */
@Composable
private fun InlineDetailNote(text: String, success: Boolean, onDismiss: (() -> Unit)?) {
    val color = if (success) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
    Surface(
        color = color.copy(alpha = 0.08f),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
    ) {
        Row(
            Modifier.padding(start = 12.dp, top = 4.dp, bottom = 4.dp, end = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = color,
                modifier = Modifier.weight(1f),
            )
            if (onDismiss != null) {
                TextButton(onClick = onDismiss) {
                    Text("Dismiss", fontSize = 11.sp, color = color, fontWeight = FontWeight.Bold)
                }
            } else {
                Spacer(Modifier.width(8.dp))
            }
        }
    }
}

private fun resolveDetailImageUrl(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    if (raw.startsWith("http")) return raw
    val base = com.zylod.wholesale.data.api.ServerConfig.cached(com.zylod.wholesale.ZylodApp.instance) ?: return null
    return base.trimEnd('/') + raw
}
