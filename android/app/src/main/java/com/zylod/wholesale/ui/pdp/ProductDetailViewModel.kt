package com.zylod.wholesale.ui.pdp

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.AddCartRequest
import com.zylod.wholesale.data.api.CreateDirectRequest
import com.zylod.wholesale.data.api.CreateDirectData
import com.zylod.wholesale.data.api.PriceTierDto
import com.zylod.wholesale.data.api.ProductDetailApi
import com.zylod.wholesale.data.api.ProductDetailDto
import com.zylod.wholesale.data.api.ProductVariantDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SpecificationsDto
import com.zylod.wholesale.data.api.WishlistAddRequest
import com.zylod.wholesale.data.api.calculatePrice
import com.zylod.wholesale.data.session.SessionManager
import com.zylod.wholesale.ui.cart.CartStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.decodeFromString

/**
 * Product detail VM — GET /api/products/{id} (+ optional /specifications),
 * wishlist toggle via /api/wishlist, add-to-cart through CartStore + POST
 * /api/cart when authenticated, buy-now through /api/orders/create-direct
 * (web parity: COD, no shippingAddressId — product-detail-page.tsx:398-409).
 */
data class PdpUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val serverUrl: String = "",
    val product: ProductDetailDto? = null,
    val specifications: Map<String, String> = emptyMap(),
    val quantity: Int = 1,
    val selectedVariantId: String? = null,
    val wishlisted: Boolean = false,
    val addingToCart: Boolean = false,
    val justAdded: Boolean = false,
    val buyingNow: Boolean = false,
    val orderConfirmation: CreateDirectData? = null,
    val toast: String? = null,
    val authed: Boolean = false,
    val wishlistNeedsLogin: Boolean = false,
)

class ProductDetailViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(PdpUiState())
    val state: StateFlow<PdpUiState> = _state

    private var api: ProductDetailApi? = null
    private var baseUrl: String? = null

    private suspend fun client(): ProductDetailApi {
        val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
        return api ?: ApiClient.productDetailApi(base).also { api = it }
    }

    fun load(productId: String) {
        if (productId.isBlank()) {
            _state.update { it.copy(loading = false, error = "Product not found") }
            return
        }
        _state.update { it.copy(loading = true, error = null, authed = SessionManager.token() != null) }
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val client = client()
                val productResponse = client.product(productId)
                if (!productResponse.isSuccessful) {
                    _state.update {
                        it.copy(loading = false, error = if (productResponse.code() == 404) "Product not found" else "The server isn't responding. Check your connection and try again.")
                    }
                    return@launch
                }
                val body = productResponse.body()
                val product: ProductDetailDto? = body?.takeIf { it.success }?.data
                if (product == null) {
                    _state.update { it.copy(loading = false, error = "Product not found") }
                    return@launch
                }
                _state.update {
                    it.copy(
                        loading = false,
                        serverUrl = base,
                        product = product,
                        quantity = product.moq.coerceAtLeast(1),
                        selectedVariantId = null,
                    )
                }
                // Optional sub-fetch: specifications (mobile PDP L83-95).
                try {
                    val specResponse = client.specifications(productId)
                    val spec = specResponse.body()?.takeIf { it.success }?.data
                    _state.update { s ->
                        s.copy(specifications = flattenSpecifications(spec))
                    }
                } catch (_: Exception) {
                    // specs optional
                }
                if (SessionManager.token() != null) checkWishlist(client, productId)
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = "Can't reach Zylod servers") }
            }
        }
    }

    private fun flattenSpecifications(spec: SpecificationsDto?): Map<String, String> {
        if (spec == null) return emptyMap()
        val flat = LinkedHashMap<String, String>()
        for ((_, items) in spec.groupedSpecifications) {
            for (item in items) {
                val name = item.specName ?: continue
                val value = item.specValue ?: continue
                flat[name] = value
            }
        }
        return flat
    }

    private suspend fun checkWishlist(client: ProductDetailApi, productId: String) {
        try {
            // WishlistApi lives on the same retrofit; build through ApiClient.
            val response = ApiClient.wishlistApi(baseUrl ?: return).list(limit = 50)
            val wished = response.body()?.data?.any { it.productId == productId || it.product?.id == productId } ?: false
            _state.update { it.copy(wishlisted = wished) }
        } catch (_: Exception) {
            // membership probe is best-effort
        }
    }

    fun setQuantity(quantity: Int) {
        val product = _state.value.product ?: return
        _state.update { it.copy(quantity = quantity.coerceAtLeast(product.moq.coerceAtLeast(1))) }
    }

    fun adjustQuantity(delta: Int) {
        val product = _state.value.product ?: return
        _state.update { it.copy(quantity = (it.quantity + delta).coerceAtLeast(product.moq.coerceAtLeast(1))) }
    }

    fun selectVariant(variantId: String?) {
        _state.update { it.copy(selectedVariantId = variantId) }
    }

    fun consumeToast() {
        _state.update { it.copy(toast = null) }
    }

    fun dismissOrderConfirmation() {
        _state.update { it.copy(orderConfirmation = null) }
    }

    fun selectedVariant(): ProductVariantDto? =
        _state.value.product?.variants?.firstOrNull { it.id == _state.value.selectedVariantId }

    /** activeTier — mobile-product-detail-page.tsx:104-111 (last tier with minQty ≤ qty). */
    fun activeTier(): PriceTierDto? {
        val product = _state.value.product ?: return null
        val tiers = product.priceTiers
        if (tiers.isEmpty()) return null
        for (i in tiers.indices.reversed()) {
            if (_state.value.quantity >= tiers[i].minQty) return tiers[i]
        }
        return tiers.first()
    }

    fun applicablePrice(): Double {
        val product = _state.value.product ?: return 0.0
        val variant = selectedVariant()
        return variant?.priceOverride ?: activeTier()?.pricePerUnit ?: product.basePrice
    }

    fun toggleWishlist() {
        val product = _state.value.product ?: return
        if (SessionManager.token() == null) {
            _state.update { it.copy(wishlistNeedsLogin = true) }
            return
        }
        val nextState = !_state.value.wishlisted
        _state.update { it.copy(wishlisted = nextState) }
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = if (nextState) {
                    ApiClient.wishlistApi(base).add(WishlistAddRequest(productId = product.id))
                } else {
                    ApiClient.wishlistApi(base).remove(productId = product.id)
                }
                if (!response.isSuccessful) {
                    _state.update { it.copy(wishlisted = !nextState, toast = "Could not update wishlist") }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(wishlisted = !nextState, toast = "Could not update wishlist") }
            }
        }
    }

    fun consumeWishlistNeedsLogin() {
        _state.update { it.copy(wishlistNeedsLogin = false) }
    }

    /** mobile-product-detail-page.tsx handleAddToCart (L116-148) + server sync. */
    fun addToCart() {
        val product = _state.value.product ?: return
        val quantity = _state.value.quantity
        if (product.stockQuantity in 1 until quantity) {
            _state.update { it.copy(toast = "Quantity exceeds available stock (${product.stockQuantity})") }
            return
        }
        if (quantity < product.moq) {
            _state.update { it.copy(toast = "Minimum order quantity is ${product.moq}") }
            return
        }
        val variant = selectedVariant()
        val unitPrice = applicablePrice()
        val stored = CartStore.addItem(
            com.zylod.wholesale.data.api.CartItemData(
                id = "${product.id}-${System.currentTimeMillis()}",
                productId = product.id,
                productName = product.name,
                productSlug = product.slug.orEmpty(),
                productImage = product.thumbnailUrl ?: product.galleryImages.firstOrNull(),
                variantId = variant?.id,
                variantName = variant?.variantName,
                variantValue = variant?.variantValue,
                quantity = quantity,
                unitPrice = unitPrice,
                totalPrice = unitPrice * quantity,
                moq = product.moq,
                maxOrderQty = product.maxOrderQty ?: product.stockQuantity,
                supplierId = product.supplier?.id.orEmpty(),
                supplierName = product.supplier?.companyName.orEmpty(),
                supplierSlug = product.supplier?.slug.orEmpty(),
                unit = product.unit ?: "piece",
                priceTiers = product.priceTiers,
            ),
        )
        _state.update { it.copy(justAdded = true, toast = "Added to cart — ${product.name}") }
        viewModelScope.launch {
            kotlinx.coroutines.delay(2000)
            _state.update { it.copy(justAdded = false) }
        }
        if (SessionManager.token() == null) return
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val buyerId = SessionManager.userJson()?.let { raw ->
                    runCatching {
                        ApiClient.json.decodeFromString(
                            com.zylod.wholesale.data.api.UserProfileSeed.serializer(),
                            raw,
                        )
                    }.getOrNull()?.id
                }
                val response = ApiClient.cartApi(base).addItem(
                    AddCartRequest(
                        buyerId = buyerId,
                        productId = stored.productId,
                        variantId = stored.variantId,
                        quantity = stored.quantity,
                        supplierId = stored.supplierId,
                    ),
                )
                if (!response.isSuccessful) {
                    val err = com.zylod.wholesale.data.api.parseErrorBody(response.errorBody())
                    _state.update {
                        it.copy(
                            toast = when {
                                err.stockAvailable != null -> "Only ${err.stockAvailable} available in stock"
                                err.moq != null -> "Minimum order quantity is ${err.moq}"
                                else -> err.error ?: "Cart sync failed — kept locally"
                            },
                        )
                    }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                // Offline-tolerant: local cart keeps working (web parity).
            }
        }
    }

    /** Web buy-now handler (product-detail-page.tsx:392-427): COD direct order. */
    fun buyNow() {
        val product = _state.value.product ?: return
        if (SessionManager.token() == null) {
            _state.update { it.copy(wishlistNeedsLogin = true, toast = "Sign in to place an order") }
            return
        }
        val quantity = _state.value.quantity
        if (product.stockQuantity == 0) {
            _state.update { it.copy(toast = "This product is out of stock") }
            return
        }
        if (quantity < product.moq) {
            _state.update { it.copy(toast = "Minimum order quantity is ${product.moq}") }
            return
        }
        _state.update { it.copy(buyingNow = true) }
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.ordersApi(base).createDirect(
                    CreateDirectRequest(
                        productId = product.id,
                        quantity = quantity,
                        variantId = _state.value.selectedVariantId,
                        unitPrice = applicablePrice(),
                        supplierId = product.supplier?.id.orEmpty(),
                        paymentMethod = "cod",
                    ),
                )
                if (!response.isSuccessful) {
                    val err = com.zylod.wholesale.data.api.parseErrorBody(response.errorBody())
                    _state.update { it.copy(buyingNow = false, toast = err.error ?: "Could not place order") }
                    return@launch
                }
                val data = response.body()
                if (data?.success == true && data.data != null) {
                    _state.update { it.copy(buyingNow = false, orderConfirmation = data.data, toast = "Order ${data.data.orderNumber} placed successfully") }
                } else {
                    _state.update { it.copy(buyingNow = false, toast = data?.error ?: "Could not place order") }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(buyingNow = false, toast = "Could not place order. Please try again.") }
            }
        }
    }
}
