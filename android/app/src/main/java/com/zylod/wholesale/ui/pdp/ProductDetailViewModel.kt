package com.zylod.wholesale.ui.pdp

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.AddCartRequest
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
 * /api/cart when authenticated. Buy Now places NO inline order: the t190
 * server contract makes /api/orders/create-direct REQUIRE a buyer-owned
 * shippingAddressId (400 otherwise), so authed buyers are routed to the
 * WebView buy-now flow (auth + shipping address + payment enforced there) —
 * exactly the web PDP's handleBuyNow split (product-detail-page.tsx:621-631).
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
    val toast: String? = null,
    val authed: Boolean = false,
    val wishlistNeedsLogin: Boolean = false,
    /**
     * One-shot: [buyNow] validated and the screen should open the WebView
     * buy-now page (openPage("buy-now", "productId=…&quantity=…")) — consumed
     * by [consumeBuyNowRequested] BEFORE navigating so Back can never re-fire
     * it. Guest taps never raise it (they get the sign-in nudge instead).
     */
    val buyNowRequested: Boolean = false,
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

    /** Consumes the buy-now navigation request (screen opens the buy-now page). */
    fun consumeBuyNowRequested() {
        _state.update { it.copy(buyNowRequested = false) }
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
        // t195 ACCOUNT WALL (web parity — product-detail-page.tsx handleAddToCart):
        // the cart is account-scoped (server sync, MOQ enforcement, checkout).
        // The OLD flow stored the line in the local CartStore FIRST and only
        // skipped the server sync for guests — a guest could build a whole
        // cart, buy and never once sign in. The gate now runs FIRST: no
        // token, no stored item — the established sign-in nudge instead.
        if (SessionManager.token() == null) {
            _state.update { it.copy(wishlistNeedsLogin = true, toast = "Sign in to add products to your cart") }
            return
        }
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

    /**
     * Buy Now — validation only, NO order placement. The old one-click handler
     * POSTed /api/orders/create-direct with paymentMethod 'cod' and no
     * shippingAddressId — a real order with no login wall, no shipping address
     * and no payment step; the t190 server contract now REQUIRES a
     * buyer-owned shippingAddressId and rejects that body with 400.
     *
     * Guest → the established sign-in nudge (toast + login prompt). Authed →
     * raises [PdpUiState.buyNowRequested]; the screen routes to the WebView
     * buy-now page (openPage("buy-now", …) → RouteOwnership.resolve →
     * Destination.Web, since "buy-now" is not in the native ownership set),
     * which enforces the buyer session, a real shipping address and payment —
     * web handleBuyNow parity (product-detail-page.tsx:621-631).
     */
    fun buyNow() {
        val product = _state.value.product ?: return
        if (SessionManager.token() == null) {
            _state.update { it.copy(wishlistNeedsLogin = true, toast = "Sign in to place an order") }
            return
        }
        if (product.stockQuantity == 0) {
            _state.update { it.copy(toast = "This product is out of stock") }
            return
        }
        val quantity = _state.value.quantity
        if (quantity < product.moq) {
            _state.update { it.copy(toast = "Minimum order quantity is ${product.moq}") }
            return
        }
        _state.update { it.copy(buyNowRequested = true) }
    }
}
