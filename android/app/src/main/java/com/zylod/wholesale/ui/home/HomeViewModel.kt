package com.zylod.wholesale.ui.home

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CategoryDto
import com.zylod.wholesale.data.api.DealDto
import com.zylod.wholesale.data.api.ProductDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.StatsDto
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HomeUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val serverUrl: String = "",
    val categories: List<CategoryDto> = emptyList(),
    val deals: List<DealDto> = emptyList(),
    val products: List<ProductDto> = emptyList(),
    val stats: StatsDto? = null,
    val page: Int = 1,
    val totalPages: Int = 1,
    val loadingMore: Boolean = false,
)

class HomeViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state

    private var api: com.zylod.wholesale.data.api.ZylodApi? = null

    // Parallel section calls must never throw into the parent scope: an async
    // child failure cancels viewModelScope.launch and bypasses the try/catch,
    // crashing the app (FATAL HttpException on main). Failure here is data:
    // null = that section couldn't load, rendered as the error state.
    private suspend fun <T> safeCall(block: suspend () -> T): T? =
        try {
            block()
        } catch (ce: CancellationException) {
            throw ce
        } catch (_: Exception) {
            null
        }

    init {
        refresh()
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val baseUrl = ServerConfig.resolve(appContext)
                val client = api ?: ApiClient.create(baseUrl, appContext).also { api = it }

                var cat: com.zylod.wholesale.data.api.ApiEnvelope<List<CategoryDto>>? = null
                var deal: com.zylod.wholesale.data.api.ApiEnvelope<List<DealDto>>? = null
                var prod: com.zylod.wholesale.data.api.ApiEnvelope<List<ProductDto>>? = null
                var productTotal: com.zylod.wholesale.data.api.ApiEnvelope<kotlinx.serialization.json.JsonElement>? = null
                var supplierTotal: com.zylod.wholesale.data.api.ApiEnvelope<kotlinx.serialization.json.JsonElement>? = null

                coroutineScope {
                    val c = async { safeCall { client.categories() } }
                    val d = async { safeCall { client.flashDeals() } }
                    val p = async { safeCall { client.products(page = 1) } }
                    val pt = async { safeCall { client.productCount() } }
                    val st = async { safeCall { client.supplierCount() } }
                    cat = c.await()
                    deal = d.await()
                    prod = p.await()
                    productTotal = pt.await()
                    supplierTotal = st.await()
                }

                if (cat == null && prod == null) {
                    _state.update { it.copy(loading = false, error = "Can't reach Zylod servers") }
                    return@launch
                }
                if (cat?.success != true || prod?.success != true) {
                    _state.update { it.copy(loading = false, error = "Server error — the backend is unhealthy") }
                    return@launch
                }

                _state.update {
                    it.copy(
                        loading = false,
                        serverUrl = baseUrl,
                        categories = (cat?.data ?: emptyList()).take(12),
                        deals = (deal?.data ?: emptyList()).take(8),
                        products = prod?.data ?: emptyList(),
                        page = prod?.pagination?.page ?: 1,
                        totalPages = prod?.pagination?.totalPages ?: 1,
                        stats = StatsDto(
                            productCount = productTotal?.pagination?.total ?: 0,
                            supplierCount = supplierTotal?.pagination?.total ?: 0,
                        ),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Network error") }
            }
        }
    }

    fun loadMore() {
        val current = _state.value
        if (current.loadingMore || current.page >= current.totalPages || current.error != null) return
        _state.update { it.copy(loadingMore = true) }
        viewModelScope.launch {
            try {
                val client = api ?: return@launch
                val nextPage = current.page + 1
                val res = client.products(page = nextPage)
                _state.update {
                    it.copy(
                        loadingMore = false,
                        page = res.pagination?.page ?: nextPage,
                        totalPages = res.pagination?.totalPages ?: it.totalPages,
                        products = it.products + (res.data ?: emptyList()),
                    )
                }
            } catch (_: Exception) {
                _state.update { it.copy(loadingMore = false) }
            }
        }
    }
}
