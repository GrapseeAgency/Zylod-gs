package com.zylod.wholesale.ui.checkout

import android.content.Context
import android.util.Log
import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.AddressDto
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CheckoutCouponValidated
import com.zylod.wholesale.data.api.CheckoutCreateItem
import com.zylod.wholesale.data.api.CheckoutCreatePayload
import com.zylod.wholesale.data.api.CheckoutCreatedOrder
import com.zylod.wholesale.data.api.CheckoutQuoteOption
import com.zylod.wholesale.data.api.CheckoutSessionUser
import com.zylod.wholesale.data.api.CheckoutShippingChoice
import com.zylod.wholesale.data.api.CartItemData
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseCheckoutError
import com.zylod.wholesale.data.session.SessionManager
import com.zylod.wholesale.ui.cart.CartStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * t273 — CHECKOUT VM (pageIds "checkout" + "checkout-page"): the honest
 * Kotlin port of checkout-page.tsx against the verified server contracts
 * (POST api/orders / GET api/shipping/quote / POST api/coupons/validate —
 * data/api/CheckoutApi.kt).
 *
 *  - GATE: resolved ONCE at init — no token → SignedOut (the web gate is
 *    only the 401 from GET api/addresses; there is NO buyer-only UI gate).
 *    A later 401 from addresses or orders flips [CheckoutUiState.needsAuth]
 *    instead (web parity), and SessionManager.expiredTick does the same.
 *    The session user is parsed to compute the COD lock:
 *    userType=="buyer" && !isEmailVerified && !isPhoneVerified.
 *  - CART: the VM COLLECTS CartStore.state — items live there, never cached
 *    here. Supplier groups + per-group weight (null when ANY line has no
 *    weightKg on file) are derived in the state; a signature change re-quotes
 *    and a subtotal change re-validates the applied coupon.
 *  - QUOTES: one GET api/shipping/quote per quotable group (district from
 *    the selected address, weightKg + subtotal as strings). Groups without
 *    weight get an honest empty state and NO request. Choices whose methodId
 *    is no longer offered are pruned. quoteTick increments per run (retry).
 *  - MONEY: subtotal = totalPrice when non-zero else unitPrice × quantity;
 *    shippingFee = Σ selected option prices; orderTotal = subtotal +
 *    shippingFee; payableTotal = max(0, orderTotal − couponDiscount).
 *  - PLACE ORDER: the client pre-checks verbatim (empty cart / address /
 *    payment method / COD lock), then POSTs the EXACT web payload (items
 *    carry only productId/variantId/quantity — no supplierId, no prices;
 *    shippingChoices omitted entirely when empty) and mirrors the web's
 *    response ladder branch-for-branch with VERBATIM messages.
 *  - After order placed the cart is cleared and quotes/addresses are NOT
 *    reloaded — the screen switches to the success panel.
 */
data class CheckoutSupplierGroup(
    val supplierId: String,
    val supplierName: String,
    val items: List<CartItemData>,
    /** Σ(quantity × weightKg) — null when ANY line has no weight on file. */
    val weightKg: Double?,
)

/** Session gate states (Checking never lingers — native reads the session synchronously). */
sealed interface CheckoutAuthState {
    data object Checking : CheckoutAuthState
    data object SignedOut : CheckoutAuthState
    data object Allowed : CheckoutAuthState
}

/** Per-supplier shipping-quote fetch state (loading / options / error). */
@Immutable
data class CheckoutQuoteState(
    val loading: Boolean = false,
    val options: List<CheckoutQuoteOption> = emptyList(),
    val error: String = "",
)

@Immutable
data class CheckoutUiState(
    val authState: CheckoutAuthState = CheckoutAuthState.Checking,
    /** Set on an addresses/orders 401 (or session expiry) — the sign-in wall. */
    val needsAuth: Boolean = false,
    /** Live cart lines — mirrored from CartStore, never cached separately. */
    val items: List<CartItemData> = emptyList(),
    val addressesLoading: Boolean = false,
    val addressesError: String = "",
    val addresses: List<AddressDto> = emptyList(),
    val selectedAddressId: String = "",
    /** null = unknown → the wallet option stays hidden (courtesy probe). */
    val walletBalance: Double? = null,
    /** "" | "wallet" | "bank_transfer" | "mobile_banking" | "cod" — no default. */
    val paymentMethod: String = "",
    val codLocked: Boolean = false,
    val quotes: Map<String, CheckoutQuoteState> = emptyMap(),
    /** supplierId → methodId, pruned when the offer disappears. */
    val shippingChoices: Map<String, String> = emptyMap(),
    val couponInput: String = "",
    val couponApplied: CheckoutCouponValidated? = null,
    val couponAppliedDiscount: Double = 0.0,
    val couponError: String = "",
    val couponChecking: Boolean = false,
    val submitting: Boolean = false,
    val error: String = "",
    val orderPlaced: Boolean = false,
    val placedOrder: CheckoutCreatedOrder? = null,
    /** Increments per quote run — the retry affordance's stability key. */
    val quoteTick: Int = 0,
) {
    /** Web: `i.totalPrice || i.unitPrice * i.quantity` — totalPrice when non-zero. */
    val subtotal: Double
        get() = items.sumOf { it.totalPrice.takeIf { t -> t > 0.0 } ?: (it.unitPrice * it.quantity) }

    /** Items grouped by supplierId — the per-supplier shipment blocks. */
    val groups: List<CheckoutSupplierGroup>
        get() = items.groupBy { it.supplierId }.map { (supplierId, groupItems) ->
            CheckoutSupplierGroup(
                supplierId = supplierId,
                supplierName = groupItems.first().supplierName.ifBlank { "Supplier" },
                items = groupItems,
                weightKg = checkoutGroupWeight(groupItems),
            )
        }

    val selectedAddress: AddressDto?
        get() = addresses.firstOrNull { it.id != null && it.id == selectedAddressId }

    /** Σ over groups WITH a choice of the selected option's price. */
    val shippingFee: Double
        get() = groups.sumOf { group ->
            val methodId = shippingChoices[group.supplierId] ?: return@sumOf 0.0
            quotes[group.supplierId]?.options?.firstOrNull { it.methodId == methodId }?.price ?: 0.0
        }

    val hasAnyShippingChoice: Boolean get() = shippingChoices.isNotEmpty()

    val orderTotal: Double get() = subtotal + shippingFee

    val payableTotal: Double get() = maxOf(0.0, orderTotal - couponAppliedDiscount)

    val walletCanCover: Boolean
        get() {
            val balance = walletBalance
            return balance != null && balance >= payableTotal
        }
}

/** Σ(quantity × weightKg) — null the moment ANY line lacks a weight. */
private fun checkoutGroupWeight(items: List<CartItemData>): Double? {
    var total = 0.0
    for (item in items) {
        val weight = item.weightKg ?: return null
        total += item.quantity * weight
    }
    return total
}

class CheckoutViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(CheckoutUiState())
    val state: StateFlow<CheckoutUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var quoteJob: Job? = null
    private var couponJob: Job? = null
    private var lastGroupsSignature: String = ""
    private var lastValidatedSubtotal: Double? = null

    init {
        resolveGate()
        // The cart store is the source of truth — the VM only mirrors it.
        viewModelScope.launch {
            CartStore.state.collect { cart ->
                _state.update { it.copy(items = cart.items) }
                onCartChanged()
            }
        }
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in wall (TrackOrderViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.update { it.copy(needsAuth = true) }
                }
            }
        }
    }

    /* ─── Session gate ─── */

    /**
     * Web mirror: the checkout gate is ONLY the token (the web page's own
     * gate is the 401 from GET api/addresses). The session user is still
     * parsed for the COD verification lock; an unreadable user object never
     * locks COD (nothing proven unverified).
     */
    private fun resolveGate() {
        val token = SessionManager.token()
        if (token == null) {
            _state.update { it.copy(authState = CheckoutAuthState.SignedOut) }
            return
        }
        val sessionUser = SessionManager.userJson()?.let { raw ->
            runCatching { ApiClient.json.decodeFromString(CheckoutSessionUser.serializer(), raw) }
                .getOrNull()
        }
        val userType = sessionUser?.userType?.trim().orEmpty()
        val codLocked = userType == "buyer" && sessionUser != null &&
            !sessionUser.isEmailVerified && !sessionUser.isPhoneVerified
        Log.i(TAG, "gate: allowed codLocked=$codLocked")
        _state.update { it.copy(authState = CheckoutAuthState.Allowed, codLocked = codLocked) }
        loadAddresses()
        loadWallet()
    }

    /** Re-entry hook: signing in on the login page pushed over the wall. */
    fun recheckGate() {
        if (_state.value.authState == CheckoutAuthState.Allowed) return
        resolveGate()
    }

    private fun resolveBase(): String =
        baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }

    /* ─── Addresses ─── */

    /** GET api/addresses — 401 flips needsAuth (the web's only real gate). */
    fun loadAddresses() {
        if (_state.value.authState != CheckoutAuthState.Allowed) return
        if (_state.value.addressesLoading) return
        _state.update { it.copy(addressesLoading = true) }
        viewModelScope.launch {
            try {
                val base = resolveBase()
                val response = ApiClient.addressesApi(base).list()
                if (response.code() == 401) {
                    Log.w(TAG, "addresses http=401 — needsAuth")
                    _state.update {
                        it.copy(
                            addressesLoading = false,
                            needsAuth = true,
                            addressesError = "You must be signed in as a buyer before checking out.",
                        )
                    }
                    return@launch
                }
                val body = response.body()
                val rows = body?.takeIf { response.isSuccessful && it.success }?.data.orEmpty()
                if (!response.isSuccessful || body?.success != true) {
                    val message = parseCheckoutError(response.errorBody()?.string())
                        ?: "Could not load addresses (HTTP ${response.code()})"
                    Log.w(TAG, "addresses http=${response.code()}: $message")
                    _state.update { it.copy(addressesLoading = false, addressesError = message) }
                    return@launch
                }
                if (rows.isEmpty()) {
                    _state.update {
                        it.copy(
                            addressesLoading = false,
                            addresses = emptyList(),
                            selectedAddressId = "",
                            addressesError = "No shipping address on file. Add a real delivery address to continue.",
                        )
                    }
                    return@launch
                }
                val preferred = rows.firstOrNull { it.isDefault } ?: rows.first()
                val preferredId = preferred.id.orEmpty()
                Log.i(TAG, "addresses loaded rows=${rows.size} default=$preferredId")
                _state.update {
                    val keep = it.selectedAddressId
                    val nextSelected =
                        if (keep.isNotEmpty() && rows.any { row -> row.id == keep }) keep else preferredId
                    it.copy(
                        addressesLoading = false,
                        addresses = rows,
                        addressesError = "",
                        selectedAddressId = nextSelected,
                    )
                }
                refreshQuotes()
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "addresses fetch failed: ${e.message}")
                _state.update {
                    it.copy(
                        addressesLoading = false,
                        addressesError = "Network error while loading your addresses. Check your connection and retry.",
                    )
                }
            }
        }
    }

    /** Courtesy wallet probe — ANY failure leaves null and never blocks checkout. */
    private fun loadWallet() {
        viewModelScope.launch {
            try {
                val base = resolveBase()
                val response = ApiClient.walletApi(base).balance()
                val available = response.body()
                    ?.takeIf { response.isSuccessful && it.success }
                    ?.data
                    ?.availableBalance
                if (available != null) {
                    Log.i(TAG, "wallet balance available=$available")
                    _state.update { it.copy(walletBalance = available) }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.i(TAG, "wallet balance unavailable — wallet option hidden (${e.message})")
            }
        }
    }

    fun selectAddress(id: String) {
        if (_state.value.selectedAddressId == id) return
        _state.update { it.copy(selectedAddressId = id) }
        refreshQuotes()
    }

    /* ─── Shipping quotes ─── */

    /**
     * One quote request per QUOTABLE group (weightKg != null). Groups without
     * weight get an honest empty state and NO request. Called when the
     * selected address district or the supplier groups change.
     */
    fun refreshQuotes() {
        quoteJob?.cancel()
        val snapshot = _state.value
        if (snapshot.authState != CheckoutAuthState.Allowed) return
        if (snapshot.orderPlaced) return
        val district = snapshot.selectedAddress?.district?.takeIf(String::isNotBlank)
        if (district == null) {
            Log.i(TAG, "quotes skipped — no address district yet")
            return
        }
        val groups = snapshot.groups
        val subtotal = snapshot.subtotal
        _state.update { st ->
            st.copy(
                quotes = groups.associate { group ->
                    val previous = st.quotes[group.supplierId] ?: CheckoutQuoteState()
                    group.supplierId to if (group.weightKg == null) {
                        CheckoutQuoteState()
                    } else {
                        previous.copy(loading = true, error = "")
                    }
                },
                quoteTick = st.quoteTick + 1,
            )
        }
        quoteJob = viewModelScope.launch {
            try {
                val base = resolveBase()
                for (group in groups) {
                    val weight = group.weightKg ?: continue
                    try {
                        val response = ApiClient.checkoutApi(base)
                            .quote(district, weight.toString(), subtotal.toString())
                        val body = response.body()
                        if (response.isSuccessful && body?.success == true) {
                            applyQuoteResult(
                                group.supplierId,
                                CheckoutQuoteState(loading = false, options = body.data.orEmpty(), error = ""),
                            )
                        } else {
                            val message = parseCheckoutError(response.errorBody()?.string())
                                ?: "Could not quote shipping (HTTP ${response.code()})"
                            Log.w(TAG, "quote http=${response.code()} supplier=${group.supplierId}: $message")
                            applyQuoteResult(
                                group.supplierId,
                                CheckoutQuoteState(loading = false, options = emptyList(), error = message),
                            )
                        }
                    } catch (ce: CancellationException) {
                        throw ce
                    } catch (e: Exception) {
                        Log.w(TAG, "quote failed supplier=${group.supplierId}: ${e.message}")
                        applyQuoteResult(
                            group.supplierId,
                            CheckoutQuoteState(loading = false, options = emptyList(), error = "Network error while quoting shipping."),
                        )
                    }
                }
            } catch (ce: CancellationException) {
                throw ce
            }
        }
    }

    /** Error-card retry — full re-run (quoteTick increments inside). */
    fun retryQuotes() {
        refreshQuotes()
    }

    /** Stores one group's quote result and prunes dead shipping choices. */
    private fun applyQuoteResult(supplierId: String, result: CheckoutQuoteState) {
        _state.update { st ->
            val current = st.shippingChoices[supplierId]
            val offered = result.options.map { it.methodId }
            st.copy(
                quotes = st.quotes + (supplierId to result),
                shippingChoices = if (current != null && current !in offered) {
                    st.shippingChoices - supplierId
                } else {
                    st.shippingChoices
                },
            )
        }
    }

    fun selectShipping(supplierId: String, methodId: String) {
        _state.update { it.copy(shippingChoices = it.shippingChoices + (supplierId to methodId)) }
    }

    fun clearShipping(supplierId: String) {
        _state.update { it.copy(shippingChoices = it.shippingChoices - supplierId) }
    }

    /* ─── Payment ─── */

    /** Only sets "wallet" when the balance actually covers the order. */
    fun selectPaymentMethod(method: String) {
        if (method == "wallet" && !_state.value.walletCanCover) return
        _state.update { it.copy(paymentMethod = method) }
    }

    /* ─── Coupon ─── */

    fun setCouponInput(value: String) {
        _state.update { it.copy(couponInput = value) }
    }

    /**
     * Trim + uppercase, then POST api/coupons/validate against the CURRENT
     * subtotal. Manual entry (the Apply button) and the automatic
     * subtotal-change revalidation share this one path.
     */
    fun applyCoupon(rawCode: String) {
        val code = rawCode.trim().uppercase(Locale.US)
        if (code.isEmpty()) {
            _state.update { it.copy(couponError = "Enter a coupon code first.") }
            return
        }
        if (_state.value.couponChecking) return
        val orderAmount = _state.value.subtotal
        _state.update { it.copy(couponChecking = true, couponError = "") }
        couponJob?.cancel()
        couponJob = viewModelScope.launch {
            try {
                val base = resolveBase()
                val response = ApiClient.checkoutApi(base)
                    .validateCoupon(CheckoutCouponValidatePayload(code = code, orderAmount = orderAmount))
                val body = response.body()
                if (!response.isSuccessful || body?.valid != true) {
                    val message = parseCheckoutError(response.errorBody()?.string())
                        ?: "Coupon could not be validated (HTTP ${response.code()})."
                    Log.w(TAG, "coupon rejected http=${response.code()}: $message")
                    _state.update {
                        it.copy(
                            couponChecking = false,
                            couponApplied = null,
                            couponAppliedDiscount = 0.0,
                            couponError = message,
                        )
                    }
                    return@launch
                }
                val validated = body.data
                val discount = validated?.discountAmount ?: 0.0
                Log.i(TAG, "coupon accepted code=${validated?.code} discount=$discount")
                lastValidatedSubtotal = orderAmount
                _state.update {
                    it.copy(
                        couponChecking = false,
                        couponApplied = validated,
                        couponAppliedDiscount = discount,
                        couponError = "",
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "coupon validate failed: ${e.message}")
                _state.update {
                    it.copy(
                        couponChecking = false,
                        couponError = "Network error while validating the coupon. Check your connection and retry.",
                    )
                }
            }
        }
    }

    fun removeCoupon() {
        lastValidatedSubtotal = null
        _state.update {
            it.copy(
                couponApplied = null,
                couponAppliedDiscount = 0.0,
                couponError = "",
                couponChecking = false,
            )
        }
    }

    /** Web parity: a coupon that was applied is silently re-validated when the subtotal moves. */
    private fun maybeRevalidateCoupon(snapshot: CheckoutUiState) {
        val applied = snapshot.couponApplied ?: return
        val code = applied.code
        if (code.isBlank()) return
        val last = lastValidatedSubtotal
        if (last != null && last == snapshot.subtotal) return
        applyCoupon(code)
    }

    /* ─── Cart mirror ─── */

    /**
     * CartStore just emitted a new snapshot. A supplier-group signature
     * change re-quotes; a subtotal change re-validates an applied coupon.
     * After the order is placed NOTHING reloads (success panel owns the
     * screen and the cart is empty).
     */
    private fun onCartChanged() {
        if (_state.value.orderPlaced) return
        val snapshot = _state.value
        val signature = snapshot.groups.joinToString("|") { group ->
            group.supplierId + ":" + group.items.joinToString(",") { item ->
                "${item.productId}:${item.variantId}:${item.quantity}:${item.weightKg}"
            }
        }
        val groupsChanged = signature != lastGroupsSignature
        lastGroupsSignature = signature
        maybeRevalidateCoupon(snapshot)
        if (groupsChanged) refreshQuotes()
    }

    /* ─── Place order ─── */

    /**
     * The client pre-checks VERBATIM in order, then POSTs the exact web
     * payload and mirrors the web's response ladder branch-for-branch.
     */
    fun placeOrder() {
        val snapshot = _state.value
        if (snapshot.submitting) return
        if (snapshot.items.isEmpty()) {
            _state.update { it.copy(error = "Your cart is empty — add products before placing an order.") }
            return
        }
        if (snapshot.selectedAddress == null) {
            _state.update { it.copy(error = "Select a real shipping address before placing the order.") }
            return
        }
        if (snapshot.paymentMethod.isEmpty()) {
            _state.update {
                it.copy(error = "Select a payment method — wallet, bank transfer, mobile banking or cash on delivery.")
            }
            return
        }
        if (snapshot.paymentMethod == "cod" && snapshot.codLocked) {
            _state.update {
                it.copy(error = "Cash on Delivery requires a verified account — verify your email or phone in your profile first.")
            }
            return
        }
        val addressId = snapshot.selectedAddress?.id.orEmpty()
        val choices = snapshot.shippingChoices.entries
            .map { (supplierId, methodId) -> CheckoutShippingChoice(supplierId = supplierId, methodId = methodId) }
        val payload = CheckoutCreatePayload(
            shippingAddressId = addressId,
            paymentMethod = snapshot.paymentMethod,
            couponCode = snapshot.couponApplied?.code,
            // Only sent when a choice exists — null (omitted by explicitNulls) otherwise.
            shippingChoices = choices.ifEmpty { null },
            // The web Zod schema carries ONLY productId/variantId/quantity.
            items = snapshot.items.map { item ->
                CheckoutCreateItem(productId = item.productId, variantId = item.variantId, quantity = item.quantity)
            },
        )
        _state.update { it.copy(submitting = true, error = "") }
        viewModelScope.launch {
            try {
                val base = resolveBase()
                val response = ApiClient.checkoutApi(base).createOrder(payload)
                val code = response.code()
                if (code == 401) {
                    val message = parseCheckoutError(response.errorBody()?.string())
                        ?: "Your session has expired. Sign in again to place this order."
                    Log.w(TAG, "order 401: $message")
                    _state.update { it.copy(needsAuth = true, error = message) }
                    return@launch
                }
                if (code == 402) {
                    val message = parseCheckoutError(response.errorBody()?.string())
                        ?: "Insufficient wallet balance."
                    Log.w(TAG, "order 402: $message")
                    _state.update { it.copy(paymentMethod = "", error = message) }
                    return@launch
                }
                if (code == 409 || code == 400) {
                    val parsed = parseCheckoutError(response.errorBody()?.string())
                    val lowered = parsed.orEmpty().lowercase(Locale.US)
                    if (code == 409 && lowered.contains("coupon")) {
                        _state.update {
                            it.copy(
                                couponApplied = null,
                                couponAppliedDiscount = 0.0,
                                couponError = parsed ?: "Coupon could not be applied.",
                            )
                        }
                        return@launch
                    }
                    if (code == 409 && lowered.contains("promotion")) {
                        _state.update {
                            it.copy(error = parsed ?: "A promotion just reached its limit — place the order again to price it without it.")
                        }
                        return@launch
                    }
                    if (lowered.contains("shipping") || lowered.contains("method")) {
                        retryQuotes()
                        Log.w(TAG, "order $code shipping/method mismatch — quotes re-run")
                        _state.update {
                            it.copy(error = parsed ?: "Shipping options changed — pick a method again.")
                        }
                        return@launch
                    }
                }
                if (code == 403) {
                    val message = parseCheckoutError(response.errorBody()?.string())
                        ?: "Order failed (HTTP 403). Please try again."
                    Log.w(TAG, "order 403: $message")
                    _state.update { it.copy(error = message) }
                    return@launch
                }
                val body = response.body()
                if (!response.isSuccessful || body?.success != true) {
                    val message = parseCheckoutError(response.errorBody()?.string())
                        ?: "Order failed (HTTP ${code}). Please try again."
                    Log.w(TAG, "order failed http=$code: $message")
                    _state.update { it.copy(error = message) }
                    return@launch
                }
                val created = body.data
                CartStore.clear()
                Log.i(TAG, "order placed id=${created?.orderId} orderNumber=${created?.orderNumber}")
                _state.update {
                    it.copy(
                        submitting = false,
                        placedOrder = created,
                        orderPlaced = true,
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "order network failure: ${e.message}")
                _state.update {
                    it.copy(error = "Network error while placing the order. Check your connection and retry.")
                }
            } finally {
                _state.update { it.copy(submitting = false) }
            }
        }
    }

    private companion object {
        const val TAG = "ZylodCheckout"
    }
}
