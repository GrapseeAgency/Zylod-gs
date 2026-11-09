package com.zylod.wholesale.ui.screens

import android.content.Context
import android.util.Log
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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
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
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.painter.ColorPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ProductDto
import com.zylod.wholesale.data.api.ProductDetailApi
import com.zylod.wholesale.data.api.ProductQaItemDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.apiQty
import com.zylod.wholesale.ui.finance.RouteQueryHelper
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.wallet.formatBdt
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t282 — NATIVE Kotlin screen for the SPA pageId "product-qa".
 *
 * The t233-era wrong-data body is GONE (it rendered GET api/products — a
 * generic catalog grid that had nothing to do with questions & answers).
 * This screen is the typed port of the REAL product-scoped Q&A browser
 * (src/components/pages/product-qa-page.tsx, source of truth GET
 * /api/products/[id]/qa — the public Task 93 rail):
 *
 *  - `productId` (or `id`) from the page query → the product's REAL
 *    questions (asker display name, real answers, real helpful counts)
 *    with the All / Answered / Unanswered filter derived from the answer
 *    field and the web's text filter;
 *  - no productId → the web's honest "no product selected" gate with a
 *    REAL product search picker (GET api/products?search=) — tap a result
 *    to browse its Q&A;
 *  - asking & answering live on the PDP rail (the write surface) — this
 *    screen deep-links there exactly like the web.
 */
data object ProductQaPageMeta : NativePageMeta() {
    override val pageId = "product-qa"
    override val title = "Product QA"
    override val category = "Shopping & Products"
    override val kind = NativePageKind.CONTENT
    override val endpoint = "api/products/{id}/qa" // typed VM below owns the calls
    override val summary =
        "The real product Q&A browser: GET api/products/{id}/qa — questions with real " +
            "askers, answers and helpful counts, All/Answered/Unanswered filters, and a " +
            "product search picker when no product is in the query."
    override val tabHint = ""
    override val bullets = listOf(
        "Questions stream from the public GET api/products/{id}/qa (the PDP rail's own source).",
        "Asking/answering happen on the product page — this screen deep-links there (web parity).",
        "No product in the query → pick one with the live product search (no fabricated defaults).",
    )
    override val related = listOf(
        NativePageLink("product-reviews", "Product Reviews"),
        NativePageLink("product-detail", "Product Detail"),
        NativePageLink("all-products", "All Products"),
    )
}

/* ─── ViewModel ──────────────────────────────────────────────────────────── */

enum class QaFilter(val label: String) {
    ALL("All"),
    ANSWERED("Answered"),
    UNANSWERED("Unanswered"),
}

data class ProductQaUiState(
    /** The product whose Q&A is on screen (blank = picker mode). */
    val productId: String = "",
    val productName: String? = null,
    val productImage: String? = null,
    val productPrice: Double = 0.0,
    val loading: Boolean = false,
    val error: String? = null,
    val qas: List<ProductQaItemDto> = emptyList(),
    val filter: QaFilter = QaFilter.ALL,
    val searchText: String = "",
    // Product picker mode (no productId in the query).
    val pickerQuery: String = "",
    val pickerResults: List<ProductDto> = emptyList(),
    val pickerSearching: Boolean = false,
    val pickerTouched: Boolean = false,
)

class ProductQaViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(ProductQaUiState())
    val state: StateFlow<ProductQaUiState> = _state.asStateFlow()

    private var api: ProductDetailApi? = null
    private var baseUrl: String? = null

    private suspend fun client(): ProductDetailApi {
        val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
        return api ?: ApiClient.productDetailApi(base).also { api = it }
    }

    /** Entry resolution — re-runs on every entry (TrackOrderScreen convention). */
    fun load(query: String) {
        val productId = RouteQueryHelper.queryParam(query, "productId")
            .ifBlank { RouteQueryHelper.queryParam(query, "id") }
        if (productId.isBlank()) {
            // Picker mode — keep any in-memory product already browsed this
            // session (Back from the PDP keeps the list on screen), else the
            // honest gate.
            val already = _state.value.productId
            if (already.isBlank()) {
                _state.update { it.copy(loading = false, error = null, productId = "") }
            }
            return
        }
        if (productId == _state.value.productId && _state.value.qas.isNotEmpty()) return
        _state.update { it.copy(loading = true, error = null, productId = productId, qas = emptyList()) }
        viewModelScope.launch { fetchProduct(productId) }
    }

    fun setFilter(filter: QaFilter) {
        _state.update { it.copy(filter = filter) }
    }

    fun setSearchText(text: String) {
        _state.update { it.copy(searchText = text) }
    }

    fun onPickerQueryChange(value: String) {
        _state.update { it.copy(pickerQuery = value, pickerTouched = true) }
    }

    /** Picker submit — GET api/products?search=<q> (the real catalog search). */
    fun pickerSearch() {
        val q = _state.value.pickerQuery.trim()
        if (q.isEmpty()) return
        if (_state.value.pickerSearching) return
        _state.update { it.copy(pickerSearching = true) }
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.create(base, appContext).products(search = q, page = 1)
                val rows = response.data.orEmpty().filter { it.id.isNotBlank() }
                _state.update { it.copy(pickerSearching = false, pickerResults = rows) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "qa picker search failed: ${e.message}")
                _state.update { it.copy(pickerSearching = false, pickerResults = emptyList()) }
            }
        }
    }

    /** Picker tap — browse that product's Q&A (picker query state resets). */
    fun pick(productId: String) {
        if (productId.isBlank()) return
        _state.update { it.copy(loading = true, error = null, productId = productId, qas = emptyList(), pickerResults = emptyList(), pickerQuery = "") }
        viewModelScope.launch { fetchProduct(productId) }
    }

    private suspend fun fetchProduct(productId: String) {
        try {
            val client = client()
            // Header card: the web fetches the product row for name/image.
            val productResponse = client.product(productId)
            val product = productResponse.body()?.takeIf { it.success }?.data
            val qaResponse = client.qa(productId)
            val qas = qaResponse.body()?.takeIf { it.success }?.data.orEmpty()
            if (!qaResponse.isSuccessful) {
                _state.update {
                    it.copy(
                        loading = false,
                        error = "Could not load the questions for this product" +
                            (if (!productResponse.isSuccessful) "" else " (HTTP ${qaResponse.code()})"),
                    )
                }
                return
            }
            if (product != null) {
                _state.update {
                    it.copy(
                        loading = false,
                        error = null,
                        productName = product.name,
                        productImage = product.thumbnailUrl,
                        productPrice = product.basePrice,
                        qas = qas,
                    )
                }
            } else {
                _state.update {
                    it.copy(
                        loading = false,
                        error = null,
                        qas = qas,
                    )
                }
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "qa load failed: ${e.message}")
            _state.update { it.copy(loading = false, error = "Network error — check your connection and retry") }
        }
    }

    private companion object {
        const val TAG = "ZylodProductQa"
    }
}

/* ─── Screen ─────────────────────────────────────────────────────────────── */

/**
 * Typed Product Q&A (t282). Sub-page: back arrow present; picker when the
 * query carries no productId.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductQaScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: ProductQaViewModel = viewModel(key = "native-product-qa") {
        ProductQaViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-resolve on EVERY entry (ReviewsListScreen parity — a question asked
    // on the PDP shows up on the way back).
    LaunchedEffect(query) { vm.load(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Product Q&A",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
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
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                // No product in the query and none browsed yet → the picker.
                state.productId.isBlank() -> QaPicker(state = state, vm = vm)
                state.error != null -> QaError(
                    message = state.error.orEmpty(),
                    onRetry = { vm.load("productId=${state.productId}") },
                )
                else -> QaContent(state = state, vm = vm, openPage = openPage)
            }
        }
    }
}

/* ─── picker (no productId) ──────────────────────────────────────────────── */

@Composable
private fun QaPicker(state: ProductQaUiState, vm: ProductQaViewModel) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(72.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
        ) {
            Icon(
                Icons.Outlined.Forum,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(32.dp),
            )
        }
        Text(
            "Pick a product to browse its Q&A",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 14.dp),
        )
        Text(
            "Search the live catalog, then read the real questions buyers asked about it.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp),
        )
        OutlinedTextField(
            value = state.pickerQuery,
            onValueChange = vm::onPickerQueryChange,
            singleLine = true,
            placeholder = { Text("Search products…", fontSize = 13.sp) },
            leadingIcon = { Icon(Icons.Outlined.Search, null, tint = MaterialTheme.colorScheme.primary) },
            trailingIcon = {
                if (state.pickerSearching) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                }
            },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { vm.pickerSearch() }),
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
            ),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp),
        )
        LazyColumn(
            contentPadding = PaddingValues(vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxSize(),
        ) {
            items(state.pickerResults, key = { "pick-${it.id}" }, contentType = { "picker-row" }) { product ->
                PickerRow(product = product, onPick = { vm.pick(product.id) })
            }
            if (state.pickerTouched && state.pickerQuery.isNotBlank() && !state.pickerSearching && state.pickerResults.isEmpty()) {
                item(key = "picker-empty", contentType = "empty") {
                    Text(
                        "No products matched \"${state.pickerQuery.trim()}\".",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun PickerRow(product: ProductDto, onPick: () -> Unit) {
    val context = LocalContext.current
    val url = remember(product.firstImage) { resolveUrl(product.firstImage) }
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onPick),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(10.dp)) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(48.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(10.dp)),
            ) {
                if (url != null) {
                    val placeholderColor = MaterialTheme.colorScheme.surfaceVariant
                    val placeholder = remember(placeholderColor) { ColorPainter(placeholderColor) }
                    AsyncImage(
                        model = remember(url) { ImageRequest.Builder(context).data(url).crossfade(200).build() },
                        contentDescription = product.name,
                        placeholder = placeholder,
                        error = placeholder,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Text(
                        product.name.take(1).uppercase(),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    product.name,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    formatBdt(product.basePrice),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

/* ─── Q&A content (productId present) ────────────────────────────────────── */

@Composable
private fun QaContent(
    state: ProductQaUiState,
    vm: ProductQaViewModel,
    openPage: (pageId: String, query: String) -> Unit,
) {
    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        // Header card — the product context (tap → PDP, web parity).
        item(key = "qa-header", contentType = "header") {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surfaceContainer,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { openPage("product-detail", "productId=${state.productId}") },
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(10.dp)) {
                    val context = LocalContext.current
                    val url = remember(state.productImage) { resolveUrl(state.productImage) }
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .size(52.dp)
                            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(10.dp)),
                    ) {
                        if (url != null) {
                            val placeholderColor = MaterialTheme.colorScheme.surfaceVariant
                            val placeholder = remember(placeholderColor) { ColorPainter(placeholderColor) }
                            AsyncImage(
                                model = remember(url) { ImageRequest.Builder(context).data(url).crossfade(200).build() },
                                contentDescription = state.productName,
                                placeholder = placeholder,
                                error = placeholder,
                                contentScale = ContentScale.Fit,
                                modifier = Modifier.fillMaxSize(),
                            )
                        } else {
                            Icon(
                                Icons.Outlined.Forum,
                                null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(20.dp),
                            )
                        }
                    }
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            state.productName ?: "Product",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
                            Text(
                                formatBdt(state.productPrice),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                                color = MaterialTheme.colorScheme.primary,
                            )
                            Spacer(Modifier.weight(1f))
                            Text(
                                "${state.qas.size} question${if (state.qas.size == 1) "" else "s"}",
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }

        // Filter chips — All / Answered / Unanswered (web parity).
        item(key = "qa-filters", contentType = "filters") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                QaFilter.entries.forEach { filter ->
                    FilterChip(
                        selected = state.filter == filter,
                        onClick = { vm.setFilter(filter) },
                        label = { Text(filter.label, fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                            selectedLabelColor = MaterialTheme.colorScheme.primary,
                        ),
                    )
                }
            }
        }

        // Text filter — the web's search box over questions/answers.
        item(key = "qa-search", contentType = "search") {
            OutlinedTextField(
                value = state.searchText,
                onValueChange = vm::setSearchText,
                singleLine = true,
                placeholder = { Text("Filter questions…", fontSize = 13.sp) },
                leadingIcon = { Icon(Icons.Outlined.Search, null, tint = MaterialTheme.colorScheme.onSurfaceVariant) },
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                ),
                modifier = Modifier.fillMaxWidth(),
            )
        }

        val visible = remember(state.qas, state.filter, state.searchText) {
            val text = state.searchText.trim()
            state.qas.filter { qa ->
                val matchesFilter = when (state.filter) {
                    QaFilter.ALL -> true
                    QaFilter.ANSWERED -> !qa.answer.isNullOrBlank()
                    QaFilter.UNANSWERED -> qa.answer.isNullOrBlank()
                }
                val matchesText = text.isEmpty() ||
                    qa.question.contains(text, ignoreCase = true) ||
                    qa.answer.orEmpty().contains(text, ignoreCase = true)
                matchesFilter && matchesText
            }
        }

        if (visible.isEmpty()) {
            item(key = "qa-empty", contentType = "empty") {
                Text(
                    if (state.qas.isEmpty()) {
                        "No questions yet — be the first to ask one on the product page."
                    } else if (state.searchText.isBlank()) {
                        "No ${state.filter.label.lowercase()} questions."
                    } else {
                        "No questions match \"${state.searchText.trim()}\"."
                    },
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 32.dp),
                )
            }
        } else {
            items(visible, key = { "qa-${it.stableKey}" }, contentType = { "qa-row" }) { qa ->
                QaRow(qa = qa, openPage = openPage, productId = state.productId)
            }
        }

        // The web routes asking to the PDP rail — this button is that hop.
        item(key = "qa-ask", contentType = "footer") {
            Button(
                onClick = { openPage("product-detail", "productId=${state.productId}") },
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 6.dp)
                    .height(48.dp),
            ) {
                Text("Ask a question on the product page", fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** stableKey for the shared ProductQaItemDto (id, hash fallback). */
private val ProductQaItemDto.stableKey: String
    get() = id.takeIf(String::isNotBlank) ?: "qa-${hashCode()}"

@Composable
private fun QaRow(
    qa: ProductQaItemDto,
    openPage: (pageId: String, query: String) -> Unit,
    productId: String,
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Icon(
                    Icons.Outlined.Forum,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        qa.question,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        buildString {
                            append(qa.askedBy ?: "Buyer")
                            val askedAt = qa.askedAt
                            if (!askedAt.isNullOrBlank()) append(" · ${formatQaDate(askedAt)}")
                        },
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
            val answer = qa.answer
            if (answer.isNullOrBlank()) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                    Text(
                        "Not answered yet",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.weight(1f))
                    Text(
                        "Answer on the product page",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.clickable { openPage("product-detail", "productId=$productId") },
                    )
                }
            } else {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                ) {
                    Column(Modifier.padding(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Outlined.CheckCircle,
                                null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(14.dp),
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "Supplier answer",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                            val answeredAt = qa.answeredAt
                            if (!answeredAt.isNullOrBlank()) {
                                Spacer(Modifier.weight(1f))
                                Text(
                                    formatQaDate(answeredAt),
                                    fontSize = 9.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        Text(
                            answer,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
            }
            if (qa.helpful > 0) {
                Text(
                    "${qa.helpful} found this helpful",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun QaError(message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Icon(
            Icons.Outlined.CloudOff,
            null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(36.dp),
        )
        Text(
            message,
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 12.dp),
        )
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Retry", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** "02 Oct 2026" — the web page's fmt() convention (t282 shared util). */
private fun formatQaDate(iso: String): String =
    com.zylod.wholesale.util.formatIsoDate(iso)

private fun resolveUrl(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    if (raw.startsWith("http")) return raw
    val base = com.zylod.wholesale.data.api.ServerConfig.cached(com.zylod.wholesale.ZylodApp.instance) ?: return null
    return base.trimEnd('/') + raw
}
