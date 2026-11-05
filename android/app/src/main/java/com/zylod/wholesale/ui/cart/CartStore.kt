package com.zylod.wholesale.ui.cart

import android.content.Context
import android.util.Log
import com.zylod.wholesale.ZylodApp
import com.zylod.wholesale.data.api.CartItemData
import com.zylod.wholesale.data.api.calculatePrice
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString

/**
 * Local persisted cart store — a faithful port of src/store/cart-store.ts
 * semantics (Phase 1 native owns the cart; the WebView's b2b-cart-storage is
 * intentionally NOT shared):
 *
 *  - merge key `productId::variantId` (cart-store.ts:70-71);
 *  - tier-based calculatePrice on every add/update (cart-store.ts:43-56);
 *  - add clamps quantity to ≥ MOQ (L77-98);
 *  - badge count = distinct items, NOT summed quantity (L147-151);
 *  - server items carry real cartItem ids so updates/deletes PUT/DELETE
 *    /api/cart/[itemId]; local-only items get ids prefixed "local-".
 *
 * Persistence: SharedPreferences JSON under "zylod_cart" (native storage —
 * b2b-cart-storage key parity not required on native per the Phase 1 brief).
 */
object CartStore {

    private const val PREFS = "zylod_cart"
    private const val KEY_ITEMS = "items"
    private const val LOCAL_ID_PREFIX = "local-"

    data class State(val items: List<CartItemData> = emptyList())

    private val ioScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // t279 — the cold-start cart hydrate no longer runs inside object init on
    // whatever thread first touches CartStore (that was the UI thread during
    // root composition: a synchronous zylod_cart XML read + full JSON decode
    // — a StrictMode disk read on EVERY first frame, jank scaling with the
    // wholesale cart size). The flow seeds EMPTY and hydrates on Dispatchers.IO
    // from app start; the hydrate completes milliseconds before a human can
    // mutate anything, and a mutation that still wins the race is preserved
    // (persisted lines MERGE in; they never clobber non-empty state).
    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    val badgeCount: Int get() = _state.value.items.size

    init {
        ioScope.launch {
            runCatching {
                val persisted = loadPersisted()
                if (_state.value.items.isEmpty()) {
                    if (persisted.isNotEmpty()) _state.update { it.copy(items = persisted) }
                } else {
                    // A mutation won the race — merge the persisted lines in
                    // instead of clobbering live state.
                    persisted.forEach { line ->
                        if (_state.value.items.none { it.mergeKey == line.mergeKey }) {
                            _state.update { s -> s.copy(items = s.items + line) }
                        }
                    }
                }
            }.onFailure { Log.w("ZylodCart", "cart hydrate failed: ${it.message}") }
        }
    }

    private fun loadPersisted(): List<CartItemData> {
        return try {
            val prefs = ZylodApp.instance.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val raw = prefs.getString(KEY_ITEMS, null)
            if (raw.isNullOrBlank()) {
                emptyList()
            } else {
                runCatching {
                    ApiJson.json.decodeFromString(ListSerializer(CartItemData.serializer()), raw)
                }.getOrElse {
                    // t279 — a decode failure means the persisted payload no
                    // longer matches the DTO shape (schema drift) or is
                    // corrupt. DELETE it instead of leaving the dead string to
                    // fail every future launch (and never resurrect as a
                    // phantom line after a later format change).
                    Log.w("ZylodCart", "persisted cart failed to decode — purging: ${it.message}")
                    prefs.edit().remove(KEY_ITEMS).apply()
                    emptyList()
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun persist(items: List<CartItemData>) {
        try {
            ZylodApp.instance.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_ITEMS, ApiJson.json.encodeToString(ListSerializer(CartItemData.serializer()), items))
                .apply()
        } catch (_: Exception) {
            // Storage failure must never break cart interactions.
        }
    }

    /** cart-store.ts addItem — merge by productId::variantId, recompute tier price. */
    fun addItem(item: CartItemData): CartItemData {
        // t229 LAST-RESORT MONEY WALL (web cart-store.ts t197 parity): the cart
        // is account-scoped. The PDP wall (t201/t214) already routes guests to
        // the native login screen BEFORE this runs, but any future call site
        // that forgets the wall can no longer silently grow a guest cart —
        // a logged-out write is refused outright (no state mutation, no
        // persistence). The untouched argument is returned so the caller's
        // signature holds; no "Added" state can ever be observed for guests.
        if (SessionManager.token() == null) return item
        val existing = _state.value.items.firstOrNull { it.mergeKey == item.mergeKey }
        if (existing != null) {
            val newQuantity = maxOf(existing.quantity + item.quantity, item.moq)
            val newPrice = calculatePrice(item, newQuantity)
            val updated = existing.copy(
                quantity = newQuantity,
                totalPrice = newPrice,
                unitPrice = if (newQuantity > 0) newPrice / newQuantity else existing.unitPrice,
            )
            _state.update { s -> s.copy(items = s.items.map { if (it.mergeKey == item.mergeKey) updated else it }) }
            persist(_state.value.items)
            return updated
        }
        val adjustedQuantity = maxOf(item.quantity, item.moq)
        val adjustedPrice = calculatePrice(item, adjustedQuantity)
        val stored = item.copy(
            id = LOCAL_ID_PREFIX + System.nanoTime(),
            quantity = adjustedQuantity,
            totalPrice = adjustedPrice,
            unitPrice = if (adjustedQuantity > 0) adjustedPrice / adjustedQuantity else item.unitPrice,
        )
        _state.update { s -> s.copy(items = s.items + stored) }
        persist(_state.value.items)
        return stored
    }

    fun removeItem(itemId: String) {
        _state.update { s -> s.copy(items = s.items.filterNot { it.id == itemId }) }
        persist(_state.value.items)
    }

    /** cart-store.ts updateQuantity — tier price recomputed for the new qty. */
    fun updateQuantity(itemId: String, quantity: Double): CartItemData? {
        val item = _state.value.items.firstOrNull { it.id == itemId } ?: return null
        val newPrice = calculatePrice(item, quantity)
        val updated = item.copy(
            quantity = quantity,
            totalPrice = newPrice,
            unitPrice = if (quantity > 0) newPrice / quantity else item.unitPrice,
        )
        _state.update { s -> s.copy(items = s.items.map { if (it.id == itemId) updated else it }) }
        persist(_state.value.items)
        return updated
    }

    /** Replaces local state with the authoritative server cart merge result. */
    fun replaceItems(items: List<CartItemData>) {
        _state.update { s -> s.copy(items = items) }
        persist(items)
    }

    fun clear() {
        _state.update { State(emptyList()) }
        persist(emptyList())
    }

    fun isServerItem(item: CartItemData): Boolean = !item.id.startsWith(LOCAL_ID_PREFIX)

    /** Shared Json for cart persistence (same settings as ApiClient.json). */
    private object ApiJson {
        val json = com.zylod.wholesale.data.api.ApiClient.json
    }
}
