package com.zylod.wholesale.ui.cart

import android.content.Context
import com.zylod.wholesale.ZylodApp
import com.zylod.wholesale.data.api.CartItemData
import com.zylod.wholesale.data.api.calculatePrice
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
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

    private val _state = MutableStateFlow(State(loadPersisted()))
    val state: StateFlow<State> = _state.asStateFlow()

    val badgeCount: Int get() = _state.value.items.size

    private fun loadPersisted(): List<CartItemData> {
        return try {
            val raw = ZylodApp.instance.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_ITEMS, null)
            if (raw.isNullOrBlank()) emptyList()
            else runCatching {
                ApiJson.json.decodeFromString(ListSerializer(CartItemData.serializer()), raw)
            }.getOrDefault(emptyList())
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
    fun updateQuantity(itemId: String, quantity: Int): CartItemData? {
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
