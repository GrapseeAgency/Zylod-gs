package com.zylod.wholesale.ui.complaints

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Seller-order-disputes VM — an HONESTLY STATIC surface.
 *
 * WEB TRUTH (seller-order-disputes-page.tsx, verified): the web component
 * fetches NOTHING. Its own header comment says it all — "there is no
 * disputes backend yet (no model, no API). Showing any dispute here would
 * be fabricated data — so this page renders a truthful empty state until
 * the arbitration system is wired to the DB." There is no supplier-scoped
 * disputes route to compose (the complaints GET is buyer-scoped by
 * buyerId, and no seller-role filter exists on it), so there is no 403
 * gate to mirror either — the page has no endpoint to be denied.
 *
 * The native mirror therefore holds ONLY the static state below: no wire
 * calls, no fabricated dispute rows, no invented fetches. When a real
 * seller-disputes endpoint appears, its GET lands here.
 */
class SellerOrderDisputesViewModel(
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(SellerDisputesUiState())
    val state: StateFlow<SellerDisputesUiState> = _state.asStateFlow()

    /** No-op — there is nothing to fetch (see the class KDoc). */
    fun load() = Unit

    /** No-op — nothing can be retried (no endpoint exists). */
    fun retry() = Unit
}
