package com.zylod.wholesale.ui.cart

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.AddCartRequest
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CartItemData
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.UpdateCartRequest
import com.zylod.wholesale.data.api.apiQty
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
 *    a 404 is an idempotent SUCCESS (the row is gone server-side — the
 *    first tap of a rapid double-tap, or a delete from another surface);
 *    real failure re-inserts the row and surfaces the error. A per-item
 *    in-flight guard keeps a double-tap from firing a second DELETE whose
 *    404 would resurrect the row under a fresh "local-" id (which the sync
 *    loop then re-POSTs, recreating the server row the buyer just removed).
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

    /** DELETEs in flight (cartItem ids) — the remove double-tap guard. */
    private val removing = mutableSetOf<String>()

    /** t280 4-a#3: server-row PUTs in flight (cartItem ids) — rapid stepper
     *  taps used to launch N concurrent PUT /api/cart/{id} calls whose landing
     *  order is arbitrary, and each failure reverted to ITS OWN pre-tap
     *  snapshot — a late-failing old tap clobbered a newer successful one
     *  (server 15, store back to 5; checkout then ordered the clobbered 5). */
    private val updating = mutableSetOf<String>()

    /** t280 4-a#2: queue-drain single-flight — the screen fires refresh() on
     *  every composition, and two overlapping pullServerCart(0) runs read the
     *  same pending local rows before either adopts server ids, so both POST
     *  the same line to the ADDITIVE server route (2x quantity = money). */
    private val pulling = java.util.concurrent.atomic.AtomicBoolean(false)

    private var baseUrl: String? = null

    init {
        // t208: NO init-time pull. The screen's LaunchedEffect(Unit) re-pulls
        // on EVERY composition — this VM survives on the saved back stack
        // (tab destination with saveState/restoreState), so an init-only pull
        // went stale the moment the cart changed elsewhere (a WebView
        // add-to-cart POSTing /api/cart, a completed checkout emptying the
        // server cart, another device): the native cart screen showed ghost
        // rows and missed web-added lines until the process restarted.
        // 401→refresh→logout chain: drop the authenticated UI state live.
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                val tokenNow = SessionManager.token() != null
                // t206 B8: the guest state renders the sign-in WALL — the local
                // cart is deliberately unreachable there, so the old copy
                // ("showing your local cart") contradicted the screen.
                if (!tokenNow) _notice.value = "Your session ended — sign in to view your cart"
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
        // t280 4-a#2 single-flight: an in-flight drain must not be re-entered —
        // the pending-row push loop is inside, and a second concurrent pass
        // re-POSTs the same local rows to the additive cart route.
        if (!pulling.compareAndSet(false, true)) return
        viewModelScope.launch {
            _syncing.value = true
            try {
                pullServerCart(depth = 0)
            } finally {
                pulling.set(false)
                _syncing.value = false
            }
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
            // t200 FIX (was an inverted predicate): LOCAL ("local-" id) rows are
            // what must survive the merge — the previous filter kept SERVER-id
            // rows the server no longer returns (resurrecting rows deleted
            // elsewhere) and silently dropped every offline-added local row
            // before the push loop, so pending could never be non-empty.
            val serverKeys = serverItems.mapTo(HashSet()) { it.mergeKey }
            val keptLocal = CartStore.state.value.items.filter {
                !CartStore.isServerItem(it) && it.mergeKey !in serverKeys
            }
            CartStore.replaceItems(serverItems + keptLocal)

            // Background-sync local-only rows (web syncWithApiBackground 'add').
            // t280 4-a#2: one push per merge key at a time — a PDP delta POST
            // still in flight for the same line makes a second concurrent push
            // a double-count on the additive server route.
            val pending = CartStore.state.value.items.filter { !CartStore.isServerItem(it) }
            var anyPosted = false
            for (item in pending) {
                if (!CartStore.serverAddInFlight.add(item.mergeKey)) continue
                val posted = try {
                    postAddItem(item)
                } finally {
                    CartStore.serverAddInFlight.remove(item.mergeKey)
                }
                if (posted) anyPosted = true
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
        maxOf(1, Math.round(item.moq.coerceAtLeast(1.0) / 5.0).toInt())

    fun changeQuantity(item: CartItemData, delta: Int) {
        val step = if (delta < 0) -stepFor(item) else stepFor(item)
        setQuantity(item, item.quantity + step)
    }

    fun setQuantity(item: CartItemData, rawQuantity: Double) {
        val quantity = maxOf(item.moq.coerceAtLeast(1.0), rawQuantity)
        clearItemError(item.id)
        val isServer = CartStore.isServerItem(item)
        if (!isServer) {
            // t280 4-a#2: local rows stay local until the next cart entry —
            // web parity (cart-page.tsx handleQtyChange is local-only; only
            // addItem POSTs). The old code fired a FULL-quantity POST to the
            // ADDITIVE server route on every stepper tap (rapid taps q1,q2,q3
            // landed q1+q2+q3 server-side) and pullServerCart's merge then
            // adopted the inflated quantity, which checkout ordered. The
            // pending-row push in pullServerCart syncs the row (once) on the
            // next cart entry, and PDP adds POST their own delta.
            CartStore.updateQuantity(item.id, quantity)
            return
        }
        // t280 4-a#3: one PUT per row at a time — concurrent PUTs land in
        // arbitrary order and the losers' reverts clobber the winner.
        if (!updating.add(item.id)) return
        // Optimistic update, then PUT; revert + inline error on failure.
        CartStore.updateQuantity(item.id, quantity)
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.cartApi(base).updateItem(item.id, UpdateCartRequest(quantity))
                if (!response.isSuccessful) {
                    // Revert ONLY when the store still shows the value this PUT
                    // carried — a newer tap has since changed it, and reverting
                    // to this tap's pre-state would clobber the newer intent.
                    revertIfUnchanged(item, quantity)
                    val err = parseErrorBody(response.errorBody())
                    _itemErrors.update {
                        it + (item.id to when {
                            err.stockAvailable != null -> "Only ${err.stockAvailable.apiQty()} available in stock"
                            err.moq != null -> "Minimum order quantity is ${err.moq.apiQty()}"
                            else -> err.error ?: "Could not update quantity"
                        })
                    }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                revertIfUnchanged(item, quantity)
                _itemErrors.update { it + (item.id to "Network error — quantity restored") }
            } finally {
                updating.remove(item.id)
            }
        }
    }

    /** t280 4-a#3 helper — restore [from]'s pre-tap quantity only when the
     *  store still holds exactly the value the failed PUT carried. */
    private fun revertIfUnchanged(item: CartItemData, sentQuantity: Double) {
        val current = CartStore.state.value.items.firstOrNull { it.id == item.id } ?: return
        if (current.quantity == sentQuantity) {
            CartStore.updateQuantity(item.id, item.quantity)
        }
    }

    fun removeItem(item: CartItemData) {
        clearItemError(item.id)
        if (!CartStore.isServerItem(item)) {
            CartStore.removeItem(item.id)
            return
        }
        // Double-tap guard: without it the second tap of a rapid double-tap
        // fired a second DELETE after the first one succeeded; its 404 was
        // treated as failure and re-inserted the row with a fresh "local-"
        // id, which pullServerCart then re-POSTed — recreating the server
        // row the buyer had just removed.
        if (!removing.add(item.id)) return
        // Optimistic remove, then DELETE; re-insert on failure.
        CartStore.removeItem(item.id)
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.cartApi(base).deleteItem(item.id)
                if (!response.isSuccessful && response.code() != 404) {
                    CartStore.addItem(item)
                    _notice.value = parseErrorBody(response.errorBody()).error ?: "Could not remove the item"
                }
                // 404 → the row is already gone server-side: idempotent
                // success, NOT a failure — re-inserting would resurrect a
                // phantom the next sync re-POSTs.
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                CartStore.addItem(item)
                _notice.value = "Network error — item kept in cart"
            } finally {
                removing.remove(item.id)
            }
        }
    }
}
