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
import kotlinx.coroutines.async
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

    init {
        refresh()
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val baseUrl = ServerConfig.resolve(appContext)
                val client = api ?: ApiClient.create(baseUrl, appContext).also { api = it }
                val categories = async { client.categories() }
                val deals = async { client.flashDeals() }
                val products = async { client.products(page = 1) }
                val productTotal = async { client.productCount() }
                val supplierTotal = async { client.supplierCount() }

                val cat = categories.await()
                val deal = deals.await()
                val prod = products.await()
                if (!cat.success || !prod.success) {
                    _state.update { it.copy(loading = false, error = "Server returned an error") }
                    return@launch
                }

                _state.update {
                    it.copy(
                        loading = false,
                        serverUrl = baseUrl,
                        categories = (cat.data ?: emptyList()).take(12),
                        deals = (deal.data ?: emptyList()).take(8),
                        products = prod.data ?: emptyList(),
                        page = prod.pagination?.page ?: 1,
                        totalPages = prod.pagination?.totalPages ?: 1,
                        stats = StatsDto(
                            productCount = productTotal.await().pagination?.total ?: 0,
                            supplierCount = supplierTotal.await().pagination?.total ?: 0,
                        ),
                    )
                }
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
