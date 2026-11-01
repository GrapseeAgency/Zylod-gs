package com.zylod.wholesale.ui.content

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
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import java.util.Locale

/**
 * SHARED typed blog-post detail (pageId "blog-post" — the ui/screens
 * delegate calls THIS, so the page keeps its own pageId-keyed
 * BlogPostViewModel).
 *
 * Data truth: the blog-page.tsx single-post branch ported. The entry
 * query's "slug=" pair seeds the GET api/blog/{slug} fetch; 200 renders
 * the category chip, the black title, the en-GB date, the cover image
 * (ONLY when coverImageUrl is a real http(s) URL — Coil AsyncImage), the
 * excerpt callout and the PLAIN-TEXT body split into one paragraph per
 * blank-line block (the web's content.split(/\n{2,}/), the payload's own
 * format — no HTML/markdown rendering exists on either side). 404 → the
 * verbatim "This article does not exist" card + "All articles" back to
 * the list. Back navigation pops the stack.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BlogPostScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: BlogPostViewModel = viewModel(key = "native-content-blog-post-$pageId") {
        BlogPostViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Outlined.Shield,
                            null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(14.dp),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            "Zylod Blog",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
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
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            Column(
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            ) {
                when {
                    state.loading -> PostSkeleton()
                    state.notFound -> NotFoundCard(openPage = openPage)
                    state.error != null -> ContentErrorCard(
                        message = state.error.orEmpty(),
                        onRetry = vm::retry,
                    )
                    else -> PostBody(state = state, openPage = openPage)
                }
            }
        }
    }
}

@Composable
private fun PostSkeleton() {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(
            Modifier
                .fillMaxWidth(0.75f)
                .height(28.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
        )
        Box(
            Modifier
                .fillMaxWidth(0.4f)
                .height(14.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
        )
        Box(
            Modifier
                .fillMaxWidth()
                .height(160.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
        )
    }
}

/** The web's verbatim 404 card + the "All articles" button back to the list. */
@Composable
private fun NotFoundCard(openPage: (pageId: String, query: String) -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
        ) {
            Icon(
                Icons.Outlined.Shield,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(40.dp),
            )
            Spacer(Modifier.height(10.dp))
            Text(
                "This article does not exist",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                "The link is wrong, or the piece was unpublished.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))
            OutlinedButton(
                onClick = { openPage("blog", "") },
                shape = RoundedCornerShape(12.dp),
            ) {
                Text("All articles", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun PostBody(state: BlogPostUiState, openPage: (pageId: String, query: String) -> Unit) {
    val context = LocalContext.current
    val post = state.post ?: return
    if (state.offlineFromCache) {
        ContentOfflineBanner("Offline — showing the last saved version of this article")
    }
    post.category?.takeIf(String::isNotBlank)?.let { category ->
        Text(
            category.uppercase(Locale.US),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier
                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.08f))
                .padding(horizontal = 6.dp, vertical = 2.dp),
        )
    }
    Text(
        post.title.orEmpty(),
        fontSize = 24.sp,
        fontWeight = FontWeight.Black,
        lineHeight = 30.sp,
        color = MaterialTheme.colorScheme.onSurface,
    )
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
            Icons.Outlined.Schedule,
            null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(12.dp),
        )
        Spacer(Modifier.width(4.dp))
        Text(
            contentDateString(post.publishedAt, "d MMMM yyyy"),
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
    post.coverImageUrl?.takeIf { url ->
        url.startsWith("http://") || url.startsWith("https://")
    }?.let { cover ->
        AsyncImage(
            model = ImageRequest.Builder(context).data(cover).crossfade(200).build(),
            contentDescription = post.title,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1.9f)
                .clip(RoundedCornerShape(16.dp)),
        )
    }
    post.excerpt?.takeIf(String::isNotBlank)?.let { excerpt ->
        Text(
            excerpt,
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .background(
                    MaterialTheme.colorScheme.primary.copy(alpha = 0.06f),
                    RoundedCornerShape(6.dp),
                )
                .padding(start = 10.dp, top = 6.dp, bottom = 6.dp),
        )
    }
    // The body: the payload's own plain-text paragraphs (web exact split).
    val paragraphs = blogBodyParagraphs(post.content)
    paragraphs.forEachIndexed { index, paragraph ->
        Text(
            paragraph,
            fontSize = 13.sp,
            lineHeight = 20.sp,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = if (index == 0) Modifier.padding(top = 2.dp) else Modifier,
        )
    }
    if (paragraphs.isEmpty() && post.content.isNullOrBlank()) {
        Text(
            "This article has no body text.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
    Button(
        onClick = { openPage("blog", "") },
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
        ),
        modifier = Modifier.padding(top = 8.dp),
    ) {
        Text("All articles", fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}
