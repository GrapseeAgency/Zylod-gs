package com.zylod.wholesale.ui.cart

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.AddCartRequest
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CartItemData
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.UpdateCartRequest
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.api.toCartItemData
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.serialization.decodeFromString
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Cart VM — orchestrates the local [CartStore] against the server cart
 * (spec §3.10 dual-source truth, mirroring web cart-store.ts semantics):
 *
 *  - Authenticated: GET /api/cart is authoritative. Server rows are merged in
 *    with their real cartItem ids (PUT/DELETE target them); local-only rows
 *    whose `productId::variantId` key has no server counterpart are kept and
 *    pushed via POST /api/cart (web `syncWithApiBackground` 'add' parity).
 *  - Unauthenticated: local cart only — the screen shows the soft
 *    "Sign in to sync" CTA (no redirect, web `mobile-bottom-nav.tsx:43-45`).
 *  - Qty updates on server rows: optimistic local recompute, then
 *    PUT /api/cart/{itemId} {quantity}; a 400 carrying {stockAvailable}/{moq}
 *    reverts and surfaces an inline per-item error (web checkout fields).
 *  - Deletes on server rows: optimistic remove, then DELETE /api/cart/{itemId};
 *    failure re-inserts the row and surfaces the error.
 *
 * All network calls are best-effort: offline/local-cart behavior always keeps
 * working (web parity — cart is NOT in the offline exclusion list).
 */
class CartViewModel(private val appContext: Context) : ViewModel() {

    val items: StateFlow<CartStore.State> = CartStore.state

    private val _authed = MutableStateFlow(SessionManager.token() != null)
    val authed: StateFlow<Boolean> = _authed.asStateFlow()

    /** Per-item inline errors keyed by cartItem id (MOQ / stock from the 400 body). */
    private val _itemErrors = MutableStateFlow<Map<String, String>>(emptyMap())
    val itemErrors: StateFlow<Map<String, String>> = _itemErrors.asStateFlow()

    /** Transient snackbar-level notices (delete failures, session dropped). */
    private val _notice = MutableStateFlow<String?>(null)
    val notice: StateFlow<String?> = _notice.asStateFlow()

    private val _syncing = MutableStateFlow(false)
    val syncing: StateFlow<Boolean> = _syncing.asStateFlow()

    private var baseUrl: String? = null

    init {
        refresh()
        // 401→refresh→logout chain: drop the authenticated UI state live.
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                val tokenNow = SessionManager.token() != null
                if (!tokenNow) _notice.value = "Your session ended — showing your local cart"
                _authed.value = tokenNow
            }
        }
    }

    fun consumeNotice() {
        _notice.value = null
    }

    fun clearItemError(itemId: String) {
        _itemErrors.update { it - itemId }
    }

    /** Pulls the server cart and merges it into [CartStore]. Safe to call again. */
    fun refresh() {
        if (SessionManager.token() == null) {
            _authed.value = false
            return
        }
        viewModelScope.launch {
            _syncing.value = true
            pullServerCart(depth = 0)
            _syncing.value = false
        }
    }

    private suspend fun pullServerCart(depth: Int) {
        try {
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.cartApi(base).getCart()
            if (response.code() == 401) {
                _authed.value = false
                return
            }
            val cart = response.body()?.takeIf { it.success }?.data ?: return
            _authed.value = true

            val serverItems = cart.suppliers.flatMap { supplier ->
                supplier.items.mapNotNull { it.toCartItemData(supplier.supplierName ?: "") }
            }
            // Merge (web syncWithApi L187-195): server rows win their merge key —
            // the surviving row carries the real server id for PUT/DELETE — and
            // local rows with no server counterpart are preserved.
            val serverKeys = serverItems.mapTo(HashSet()) { it.mergeKey }
            val keptLocal = CartStore.state.value.items.filter {
                CartStore.isServerItem(it) && it.mergeKey !in serverKeys
            }
            CartStore.replaceItems(serverItems + keptLocal)

            // Background-sync local-only rows (web syncWithApiBackground 'add').
            val pending = CartStore.state.value.items.filter { !CartStore.isServerItem(it) }
            var anyPosted = false
            for (item in pending) {
                if (postAddItem(item)) anyPosted = true
            }
            // Adopt the server-assigned ids exactly once after successful posts.
            if (anyPosted && depth < 1) pullServerCart(depth + 1)
        } catch (ce: CancellationException) {
            throw ce
        } catch (_: Exception) {
            // Offline — local cart keeps working (web parity, silent).
        }
    }

    private suspend fun postAddItem(item: CartItemData): Boolean {
        return try {
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.cartApi(base).addItem(
                AddCartRequest(
                    buyerId = currentBuyerId(),
                    productId = item.productId,
                    variantId = item.variantId,
                    quantity = item.quantity,
                    supplierId = item.supplierId,
                ),
            )
            response.isSuccessful
        } catch (ce: CancellationException) {
            throw ce
        } catch (_: Exception) {
            false
        }
    }

    private fun currentBuyerId(): String? = SessionManager.userJson()?.let { raw ->
        runCatching {
            ApiClient.json.decodeFromString(
                com.zylod.wholesale.data.api.UserProfileSeed.serializer(),
                raw,
            )
        }.getOrNull()?.id
    }

    /** cart-page.tsx handleQtyChange: step = max(1, round(moq/5)), floor = MOQ. */
    fun stepFor(item: CartItemData): Int =
        maxOf(1, Math.round(item.moq.coerceAtLeast(1) / 5.0f).toInt())

    fun changeQuantity(item: CartItemData, delta: Int) {
        val step = if (delta < 0) -stepFor(item) else stepFor(item)
        setQuantity(item, item.quantity + step)
    }

    fun setQuantity(item: CartItemData, rawQuantity: Int) {
        val quantity = maxOf(item.moq.coerceAtLeast(1), rawQuantity)
        clearItemError(item.id)
        val isServer = CartStore.isServerItem(item)
        if (!isServer) {
            CartStore.updateQuantity(item.id, quantity)
            // Was added while offline/unauthenticated — push it now if we can.
            if (_authed.value) {
                viewModelScope.launch {
                    val updated = item.copy(quantity = quantity)
                    if (postAddItem(updated)) pullServerCart(depth = 1)
                }
            }
            return
        }
        // Optimistic update, then PUT; revert + inline error on failure.
        CartStore.updateQuantity(item.id, quantity)
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.cartApi(base).updateItem(item.id, UpdateCartRequest(quantity))
                if (!response.isSuccessful) {
                    CartStore.updateQuantity(item.id, item.quantity)
                    val err = parseErrorBody(response.errorBody())
                    _itemErrors.update {
                        it + (item.id to when {
                            err.stockAvailable != null -> "Only ${err.stockAvailable} available in stock"
                            err.moq != null -> "Minimum order quantity is ${err.moq}"
                            else -> err.error ?: "Could not update quantity"
                        })
                    }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                CartStore.updateQuantity(item.id, item.quantity)
                _itemErrors.update { it + (item.id to "Network error — quantity restored") }
            }
        }
    }

    fun removeItem(item: CartItemData) {
        clearItemError(item.id)
        if (!CartStore.isServerItem(item)) {
            CartStore.removeItem(item.id)
            return
        }
        // Optimistic remove, then DELETE; re-insert on failure.
        CartStore.removeItem(item.id)
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.cartApi(base).deleteItem(item.id)
                if (!response.isSuccessful) {
                    CartStore.addItem(item)
                    _notice.value = parseErrorBody(response.errorBody()).error ?: "Could not remove the item"
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                CartStore.addItem(item)
                _notice.value = "Network error — item kept in cart"
            }
        }
    }
}
