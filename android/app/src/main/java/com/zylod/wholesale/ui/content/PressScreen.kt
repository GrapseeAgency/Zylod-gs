package com.zylod.wholesale.ui.content

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Folder
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import com.zylod.wholesale.data.api.MediaKitAssetDto
import com.zylod.wholesale.data.api.PressReleaseRowDto
import java.util.Locale

/**
 * SHARED typed press hub (pageId "press-media" — the ui/screens delegate
 * calls THIS, so the page keeps its own pageId-keyed PressViewModel).
 *
 * Data truth: press-media-page.tsx ported — the "Press & Media Hub"
 * header, the Corporate Newsroom hero (verbatim copy), the category chips
 * ("All News (n)" + the route's distinct categories with '_'→' ', the
 * web's exact client-side filter) and the release cards (category badge,
 * title, thumbnail ONLY when imageUrl is a real http(s) URL, summary,
 * date + "Read Release" footer → openPage("press-release-detail") with
 * the "slug=" pair — the t255 docs→policy-detail convention). The hero's
 * "Investor Relations" affordance is mirrored verbatim (the pageId is
 * natively registered). The web's Media Kit button opens its own SPA
 * page; the t263 batch owns no
 * separate media-kit pageId, so the section renders INLINE below the
 * releases (GET api/press/media-kit): each asset row shows the
 * thumbnailUrl image when it is a real http(s) URL, its real
 * format/size meta and the download affordance is an ACTION_VIEW on the
 * route's REAL fileUrl (http/https only, never a fabricated link).
 * PUBLIC content — signed-out renders exactly the same hub.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PressScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: PressViewModel = viewModel(key = "native-content-press-$pageId") {
        PressViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            "Press & Media Hub",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Text(
                            "Official News, Announcements & Media Assets",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(
                                Icons.AutoMirrored.Outlined.ArrowBack,
                                "Go back",
                                tint = MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Hero (the web's Corporate Newsroom card, verbatim copy).
            item(key = "hero") {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(18.dp),
                    ) {
                        Text(
                            "Corporate Newsroom",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Text(
                            "Latest Headlines & Industry Breakthroughs",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Text(
                            "Stay updated with corporate milestones, funding announcements, product innovations, and strategic logistics partnerships across Bangladesh.",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        // The web hero's second button, verbatim label — the
                        // investor-relations pageId is natively registered.
                        OutlinedButton(
                            onClick = { openPage("investor-relations", "") },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.align(Alignment.End),
                        ) {
                            Text("Investor Relations", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            if (state.offlineFromCache && !state.loading && state.releasesError == null) {
                item(key = "offline") {
                    ContentOfflineBanner("Offline — showing the last saved newsroom")
                }
            }

            // Category chips (web exact client-side filter — no refetch).
            if (state.releases.isNotEmpty() || state.categories.isNotEmpty()) {
                item(key = "chips") {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        item {
                            FilterChip(
                                selected = state.selectedCategory == "all",
                                onClick = { vm.selectCategory("all") },
                                label = { Text("All News (${state.releases.size})", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                                    selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
                                ),
                            )
                        }
                        items(state.categories, key = { it }) { cat ->
                            FilterChip(
                                selected = state.selectedCategory == cat,
                                onClick = { vm.selectCategory(cat) },
                                label = { Text(pressCategoryLabel(cat), fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                                    selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
                                ),
                            )
                        }
                    }
                }
            }

            when {
                state.loading -> items(count = 3, key = { "release-skeleton-$it" }) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(120.dp)
                            .clip(RoundedCornerShape(18.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant),
                    )
                }
                state.releasesError != null -> item(key = "release-error") {
                    ContentErrorCard(message = state.releasesError.orEmpty(), onRetry = vm::retryReleases)
                }
                state.filteredReleases.isEmpty() -> item(key = "release-empty") {
                    // The web's verbatim per-category empty card.
                    Surface(
                        color = MaterialTheme.colorScheme.surface,
                        shape = RoundedCornerShape(18.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            "No press releases found in this category.",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                        )
                    }
                }
                else -> items(state.filteredReleases, key = { it.stableKey }) { release ->
                    ReleaseCard(release = release) {
                        val slug = release.slug.orEmpty()
                        if (slug.isNotBlank()) openPage("press-release-detail", "slug=$slug")
                    }
                }
            }

            // ── Media kit section (inline — the web's separate media-kit page) ──
            item(key = "media-kit-header") {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.Folder,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "Media Kit",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            when {
                state.mediaKitLoading -> items(count = 2, key = { "kit-skeleton-$it" }) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(72.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant),
                    )
                }
                state.mediaKitError != null -> item(key = "kit-error") {
                    ContentErrorCard(message = state.mediaKitError.orEmpty(), onRetry = vm::retryMediaKit)
                }
                state.mediaKit?.assets.isNullOrEmpty() -> item(key = "kit-empty") {
                    Surface(
                        color = MaterialTheme.colorScheme.surface,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            "No media kit assets have been published yet.",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                        )
                    }
                }
                else -> items(state.mediaKit?.assets.orEmpty(), key = { it.stableKey }) { asset ->
                    MediaKitAssetRow(asset = asset)
                }
            }
        }
    }
}

/** One release card — badge, title, thumbnail (real URLs only), summary, footer. */
@Composable
private fun ReleaseCard(release: PressReleaseRowDto, onClick: () -> Unit) {
    val context = LocalContext.current
    val image = release.imageUrl?.takeIf { url ->
        url.startsWith("http://") || url.startsWith("https://")
    }
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .clickable(onClick = onClick),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(
                        pressCategoryLabel(release.category).uppercase(Locale.US),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        release.title.orEmpty(),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (image != null) {
                    Spacer(Modifier.width(10.dp))
                    AsyncImage(
                        model = ImageRequest.Builder(context).data(image).crossfade(200).build(),
                        contentDescription = release.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .size(width = 64.dp, height = 64.dp)
                            .clip(RoundedCornerShape(14.dp)),
                    )
                }
            }
            release.summary?.takeIf(String::isNotBlank)?.let { summary ->
                Spacer(Modifier.height(8.dp))
                Text(
                    summary,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.height(10.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(
                    Icons.Outlined.Schedule,
                    null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(13.dp),
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    contentDateString(release.publishedAt, "d MMM yyyy"),
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    "Read Release",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Icon(
                    Icons.Outlined.ChevronRight,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(13.dp),
                )
            }
        }
    }
}

/**
 * One media-kit asset row — the web media-kit-page's exact shape: the
 * thumbnailUrl image when it is a real http(s) URL (Coil AsyncImage), the
 * route's real meta and an ACTION_VIEW affordance on the REAL fileUrl
 * (http/https only; anything else renders without the button rather than
 * a fake link).
 */
@Composable
private fun MediaKitAssetRow(asset: MediaKitAssetDto) {
    val context = LocalContext.current
    val fileUrl = asset.fileUrl?.takeIf { url ->
        url.startsWith("http://") || url.startsWith("https://")
    }
    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
        ) {
            val thumbnail = asset.thumbnailUrl?.takeIf { url ->
                url.startsWith("http://") || url.startsWith("https://")
            }
            if (thumbnail != null) {
                AsyncImage(
                    model = ImageRequest.Builder(context).data(thumbnail).crossfade(200).build(),
                    contentDescription = asset.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(12.dp)),
                )
                Spacer(Modifier.width(10.dp))
            }
            Column(Modifier.weight(1f)) {
                Text(
                    asset.title.orEmpty(),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                asset.description?.takeIf(String::isNotBlank)?.let { description ->
                    Spacer(Modifier.height(2.dp))
                    Text(
                        description,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Spacer(Modifier.height(4.dp))
                val meta = listOf(
                    pressCategoryLabel(asset.assetType),
                    asset.fileFormat?.takeIf(String::isNotBlank),
                    asset.fileSizeMB?.takeIf { it > 0 }?.let { "${it}MB" },
                ).filterNotNull().filter(String::isNotBlank)
                if (meta.isNotEmpty()) {
                    Text(
                        meta.joinToString(" · "),
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (fileUrl != null) {
                Spacer(Modifier.width(10.dp))
                Button(
                    onClick = {
                        runCatching {
                            context.startActivity(
                                Intent(Intent.ACTION_VIEW, android.net.Uri.parse(fileUrl)),
                            )
                        }
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                    ),
                ) {
                    Icon(Icons.Outlined.Download, null, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Open", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
