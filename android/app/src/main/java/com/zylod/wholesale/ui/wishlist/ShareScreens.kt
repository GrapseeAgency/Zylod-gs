package com.zylod.wholesale.ui.wishlist

import android.content.Intent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SharedWishlistItemDto
import com.zylod.wholesale.data.api.WishlistShareDto
import com.zylod.wholesale.ui.rewards.RewardsAuthGate
import com.zylod.wholesale.ui.rewards.RewardsEmptyCard
import com.zylod.wholesale.ui.rewards.RewardsErrorCard
import com.zylod.wholesale.ui.rewards.RewardsSkeleton

/**
 * The t262 share surfaces (ShareScreens):
 *
 *  - [ShareManageScreen] — pageIds wishlist-share + wishlist-share-page
 *    (chunk-misc.ts:210 + chunk-wishlist.ts:32 both load the SAME
 *    wishlist-share-page.tsx): the Share Status card (Active/Not Shared
 *    chip, the origin/shared?token= link with copy + rotate, the REAL
 *    viewCount / lastViewedAt counters), the settings card (the two
 *    toggles + Save Changes, one POST away) and the danger zone (revoke
 *    with the web's confirm copy). The web's decorative QR icon box is
 *    omitted (documented deviation: it renders an icon, never a real code).
 *  - [SharedWishlistViewScreen] — pageIds wishlist-shared +
 *    shared-wishlist (shared-wishlist-page.tsx: owner branch = the buyer's
 *    own link + copy + share intents; token branch = the PUBLIC read) and
 *    shared-wishlist-detail (shared-wishlist-detail-page.tsx: the same
 *    PUBLIC read with the "Wishlist Unavailable" failure card). The token
 *    branch NEVER gates on the session — the route is public and works
 *    signed-out, exactly like the web's header-less fetch. The "Save to My
 *    Wishlist" row action mirrors the web's own client-store toggle (the
 *    shared page never calls the API for it) with the toast texts verbatim.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareManageScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: ShareViewModel = viewModel(key = "native-wishlist-share-$pageId") {
        ShareViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.refresh() }

    // The revoke confirm (BankAccountsScreen pendingDelete pattern) —
    // screen-local; the VM stays dialog-free.
    var revokeAsked by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { ShareTopBar(title = "Sharing Settings", onBack = onBack) },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            when {
                state.needsAuth -> RewardsAuthGate(
                    // wishlist-share-page.tsx AccountGate copy, verbatim.
                    title = "Sign in to manage wishlist sharing",
                    body = "Wishlist share links and view counts belong to your account. Sign in to continue.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    RewardsErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> ShareManageBody(state = state, vm = vm, onRevoke = { revokeAsked = true })
            }
        }
    }

    if (revokeAsked) {
        AlertDialog(
            onDismissRequest = { revokeAsked = false },
            title = {
                Text("Revoke this share link?", fontSize = 16.sp, fontWeight = FontWeight.Black)
            },
            text = {
                // The web confirm's exact sentence (window.confirm argument).
                Text(
                    "Are you sure you want to revoke this link? Anyone with the link will no longer be able to view your wishlist.",
                    fontSize = 12.sp,
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        revokeAsked = false
                        vm.revokeShare()
                    },
                    enabled = !state.creating,
                ) {
                    Text(
                        "Revoke link",
                        color = MaterialTheme.colorScheme.error,
                        fontWeight = FontWeight.Bold,
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { revokeAsked = false }) {
                    Text("Keep sharing", fontWeight = FontWeight.Bold)
                }
            },
        )
    }
}

@Composable
private fun ShareManageBody(state: ShareUiState, vm: ShareViewModel, onRevoke: () -> Unit) {
    state.actionMessage?.let { message ->
        InlineShareNote(text = message, success = true, onDismiss = vm::consumeActionMessage)
    }
    state.actionError?.let { message ->
        InlineShareNote(text = message, success = false, onDismiss = vm::consumeActionError)
    }
    if (state.loading) {
        RewardsSkeleton()
        return
    }
    val share = state.share
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Share Status",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier.weight(1f),
                )
                Surface(
                    color = if (state.isActive) {
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant
                    },
                    shape = RoundedCornerShape(50),
                ) {
                    Text(
                        if (state.isActive) "Active" else "Not Shared",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (state.isActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                    )
                }
            }
            if (share == null) {
                Text(
                    "You haven't shared your wishlist yet.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                Button(
                    onClick = vm::createShare,
                    enabled = !state.creating,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Generate Share Link", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            } else {
                ShareLinkRow(share = share, onRotate = vm::createShare)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            "${share.viewCount}",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black,
                        )
                        Text(
                            "Total Views",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            wishlistDateLabel(share.lastViewedAt) ?: "Never",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "Last Viewed",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
    if (share != null) {
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Settings", fontSize = 13.sp, fontWeight = FontWeight.Black)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Allow adding to cart", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text(
                            "Viewers can add items to their cart",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Switch(checked = state.allowAddToCart, onCheckedChange = vm::setAllowAddToCart)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Show prices", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text(
                            "Display current prices to viewers",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Switch(checked = state.showPrices, onCheckedChange = vm::setShowPrices)
                }
                OutlinedButton(
                    onClick = vm::createShare,
                    enabled = !state.creating,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Save Changes", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        Surface(
            color = MaterialTheme.colorScheme.error.copy(alpha = 0.06f),
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.2f)),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.DeleteOutline,
                        null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "Danger Zone",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
                Text(
                    "Revoking the share link will immediately disable access for anyone who has the link.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.error,
                )
                OutlinedButton(
                    onClick = onRevoke,
                    enabled = !state.creating,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        "Revoke Share Link",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }
        }
    }
}

@Composable
private fun ShareLinkRow(share: WishlistShareDto?, onRotate: (() -> Unit)?) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val url = shareUrlFor(ServerConfig.cached(context), share?.token)
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(4.dp)) {
            Text(
                url ?: "Generate link...",
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            IconButton(
                onClick = { url?.let { clipboard.setText(AnnotatedString(it)) } },
                enabled = url != null,
            ) {
                Icon(
                    Icons.Outlined.ContentCopy,
                    "Copy share link",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(16.dp),
                )
            }
            if (onRotate != null) {
                IconButton(onClick = onRotate) {
                    Icon(
                        Icons.Outlined.Refresh,
                        "Rotate the share link",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
    }
}

/**
 * The PUBLIC shared-wishlist viewer (pageIds wishlist-shared +
 * shared-wishlist + shared-wishlist-detail — see the VM for the branch
 * truth). The token branch works signed-out; rows are read-only except the
 * "Save to My Wishlist" local toggle the web itself performs against its
 * client store (toast texts verbatim), never a fabricated write.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SharedWishlistViewScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SharedWishlistViewModel = viewModel(key = "native-shared-wishlist-$pageId") {
        SharedWishlistViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Entry resolve on EVERY entry (ReturnRequestViewModel.load convention).
    LaunchedEffect(Unit) { vm.load(query) }

    // The web's "Save to My Wishlist" rows toggle a client-side store on the
    // shared page (no API call there) — the same honest local set here, with
    // the verbatim result notes inline.
    var locallySaved by remember { mutableStateOf(setOf<String>()) }
    var savedNote by remember { mutableStateOf<String?>(null) }

    val isDetail = pageId == "shared-wishlist-detail"

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            ShareTopBar(
                title = when {
                    state.ownerMode -> "Share Wishlist"
                    state.ownerName != null -> "${state.ownerName}'s Wishlist"
                    isDetail -> "Shared Wishlist"
                    else -> "Shared Wishlist"
                },
                onBack = onBack,
            )
        },
    ) { padding ->
        when {
            state.loading -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            state.ownerMode -> OwnerShareBody(state = state, openPage = openPage)
            else -> Column(
                Modifier
                    .fillMaxSize()
                    .padding(padding),
            ) {
                savedNote?.let { note ->
                    Box(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                        InlineShareNote(
                            text = note,
                            success = true,
                            onDismiss = { savedNote = null },
                        )
                    }
                }
                SharedViewerBody(
                    state = state,
                    isDetail = isDetail,
                    locallySaved = locallySaved,
                    onToggleSave = { key ->
                        if (key in locallySaved) {
                            locallySaved = locallySaved - key
                            savedNote = "Removed from wishlist"
                        } else {
                            locallySaved = locallySaved + key
                            savedNote = "Saved to your wishlist"
                        }
                    },
                    openPage = openPage,
                )
            }
        }
    }
}

@Composable
private fun OwnerShareBody(
    state: SharedWishlistUiState,
    openPage: (pageId: String, query: String) -> Unit,
) {
    if (state.needsAuth) {
        RewardsAuthGate(
            // shared-wishlist-page.tsx owner AccountGate copy, verbatim.
            title = "Sign in to share your wishlist",
            body = "Wishlist sharing is tied to your account. Sign in to continue.",
            onSignIn = { openPage("login", "") },
        )
        return
    }
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val share = state.ownerShare
    val url = shareUrlFor(ServerConfig.cached(context), share?.token)
    val shareIntent = remember(share?.token, url) {
        Intent.createChooser(
            Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, "Shared Zylod Wishlist")
                putExtra(Intent.EXTRA_TEXT, url ?: "Check out this wishlist on Zylod")
            },
            "Share wishlist link",
        )
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // The web owner branch's inline red note for load failures.
        state.error?.let { message ->
            item(key = "owner-error", contentType = "error") {
                Surface(
                    color = MaterialTheme.colorScheme.error.copy(alpha = 0.06f),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.25f)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        message,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }
        }
        item(key = "link", contentType = "link") {
            Surface(
                color = MaterialTheme.colorScheme.surfaceContainer,
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        if (share != null) {
                            "Your wishlist link is live — anyone with it can view this list."
                        } else {
                            "Generate a link from the Sharing Settings page to share this list."
                        },
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    ShareLinkRow(share = share, onRotate = {})
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(
                            onClick = {
                                url?.let { clipboard.setText(AnnotatedString(it)) }
                            },
                            enabled = url != null,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f),
                        ) {
                            Icon(
                                Icons.Outlined.ContentCopy,
                                null,
                                modifier = Modifier.size(14.dp),
                            )
                            Spacer(Modifier.width(6.dp))
                            Text("Copy Link", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        OutlinedButton(
                            onClick = { context.startActivity(shareIntent) },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f),
                        ) {
                            Icon(
                                Icons.Outlined.Share,
                                null,
                                modifier = Modifier.size(14.dp),
                            )
                            Spacer(Modifier.width(6.dp))
                            Text("Share", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
        item(key = "hint", contentType = "hint") {
            Text(
                "The recipient opens the link signed-out — the shared page is public, exactly like the web.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun SharedViewerBody(
    state: SharedWishlistUiState,
    isDetail: Boolean,
    locallySaved: Set<String>,
    onToggleSave: (key: String) -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (state.error != null) {
            item(key = "error", contentType = "error") {
                if (isDetail) {
                    // shared-wishlist-detail-page.tsx failure card, verbatim
                    // copy + the route's own error text.
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceContainer,
                        shape = RoundedCornerShape(20.dp),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                "Wishlist Unavailable",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Black,
                            )
                            Text(
                                state.error.orEmpty(),
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center,
                            )
                            Button(
                                onClick = { openPage("home", "") },
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text("Go to Zylod Homepage", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                } else {
                    // shared-wishlist-page.tsx inline red note, verbatim sentence.
                    Surface(
                        color = MaterialTheme.colorScheme.error.copy(alpha = 0.06f),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.25f)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            state.error.orEmpty(),
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(12.dp),
                        )
                    }
                }
            }
        }
        val payload = state.payload
        if (payload != null) {
            if (isDetail) {
                item(key = "owner-banner", contentType = "owner") {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier
                                .size(56.dp)
                                .background(MaterialTheme.colorScheme.surfaceVariant, CircleShape),
                        ) {
                            Text(
                                state.ownerName?.take(1)?.uppercase().orEmpty(),
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Black,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Text(
                            "${state.ownerName.orEmpty()}'s Wishlist",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                        Text(
                            "${payload.items.size} items",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
            } else {
                item(key = "owner-card", contentType = "owner") {
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceContainer,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(12.dp)) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .size(40.dp)
                                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f), CircleShape),
                            ) {
                                Text(
                                    state.ownerName?.take(1)?.uppercase().orEmpty(),
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Black,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }
                            Spacer(Modifier.width(10.dp))
                            Column {
                                Text(
                                    state.ownerName.orEmpty(),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(
                                    "Shared with you",
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            }
            if (payload.items.isEmpty()) {
                item(key = "empty", contentType = "empty") {
                    RewardsEmptyCard(
                        icon = Icons.Outlined.FavoriteBorder,
                        title = "Nothing in this wishlist yet",
                        body = "The owner has no saved products right now.",
                    )
                }
            } else {
                // Two-column grid (the web's grid-cols-2), chunked rows for
                // the shared LazyColumn — real rows only, no placeholders.
                payload.items.chunked(2).forEachIndexed { index, pair ->
                    item(key = "grid-row-${pair.first().stableKey}-$index", contentType = "shared-grid-row") {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            pair.forEach { item ->
                                SharedProductCard(
                                    item = item,
                                    showPrices = state.showPrices,
                                    allowAddToCart = state.allowAddToCart,
                                    saved = locallySaved.contains(item.stableKey),
                                    onToggleSave = { onToggleSave(item.stableKey) },
                                    openPage = openPage,
                                    modifier = Modifier.weight(1f),
                                )
                            }
                            if (pair.size == 1) {
                                Spacer(Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
        }
        item(key = "shop-cta", contentType = "cta") {
            Button(
                onClick = { openPage("home", "") },
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Shop on Zylod", fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun SharedProductCard(
    item: SharedWishlistItemDto,
    showPrices: Boolean,
    allowAddToCart: Boolean,
    saved: Boolean,
    onToggleSave: () -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val product = item.product
    val name = product?.name?.takeIf(String::isNotBlank) ?: "Unnamed product"
    val productId = product?.effectiveId ?: item.productId
    val imageUrl = remember(product?.thumbnailUrl) { resolveSharedImageUrl(product?.thumbnailUrl) }
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = modifier.clickable(productId != null) { openPage("product-detail", "productId=$productId") },
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
            ) {
                if (imageUrl != null) {
                    // colorScheme is a @Composable getter — read it OUTSIDE remember.
                    val placeholderColor = MaterialTheme.colorScheme.surfaceVariant
                    val placeholder = remember(placeholderColor) { ColorPainter(placeholderColor) }
                    AsyncImage(
                        model = remember(imageUrl) { ImageRequest.Builder(context).data(imageUrl).crossfade(200).build() },
                        contentDescription = name,
                        placeholder = placeholder,
                        error = placeholder,
                        contentScale = ContentScale.Fit, // t277-1d: product art never crops (web object-contain parity)
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Text(
                        "No Image",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.align(Alignment.Center),
                    )
                }
                // Honest stock overlay from the route's own stockQuantity.
                if ((product?.stockQuantity ?: 0.0) <= 0.0) {
                    Surface(
                        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.8f),
                        shape = RoundedCornerShape(50),
                        modifier = Modifier.align(Alignment.Center),
                    ) {
                        Text(
                            "Out of Stock",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        )
                    }
                }
            }
            Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    name,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                // Prices render ONLY when the share's settings allow them —
                // the route omits basePrice entirely otherwise.
                if (showPrices) {
                    Text(
                        buildString {
                            append(product?.currency?.takeIf(String::isNotBlank)?.let { "$it " } ?: "")
                            append(wishlistBdtLabel(product?.basePrice))
                            append(" /${product?.unit?.takeIf(String::isNotBlank) ?: "unit"}")
                        },
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                if (allowAddToCart) {
                    Button(
                        // The web's Allow-adding-to-cart button routes to the
                        // PDP (shared-wishlist-page.tsx:193) — same here.
                        onClick = { productId?.let { openPage("product-detail", "productId=$it") } },
                        enabled = productId != null,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Add to Cart", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
                OutlinedButton(
                    onClick = onToggleSave,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(
                        if (saved) Icons.Outlined.Favorite else Icons.Outlined.FavoriteBorder,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(12.dp),
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        "Save to My Wishlist",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShareTopBar(title: String, onBack: (() -> Unit)?) {
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

/** Inline verbatim result note (share create/revoke, viewer save toggles). */
@Composable
private fun InlineShareNote(text: String, success: Boolean, onDismiss: (() -> Unit)?) {
    val color = if (success) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
    Surface(
        color = color.copy(alpha = 0.08f),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
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

private fun resolveSharedImageUrl(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    if (raw.startsWith("http")) return raw
    val base = ServerConfig.cached(com.zylod.wholesale.ZylodApp.instance) ?: return null
    return base.trimEnd('/') + raw
}
