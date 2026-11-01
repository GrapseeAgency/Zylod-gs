package com.zylod.wholesale.ui.reviews

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CreateReviewBody
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Write-review VM — POST api/reviews (ReviewsApi.create) behind the
 * "rate-products" pageId, the wire behavior of write-review-page.tsx
 * ported 1:1:
 *
 *  - ENTRY: the buyer-only route gates BEFORE typing (t253 AddAddress
 *    convention) — no session token at all renders the honest sign-in
 *    gate, never a form that could only fail. A token that exists but is
 *    NOT a buyer surfaces the route's real 401 text on submit.
 *  - FIELDS: interactive 1-5 star input (default 5), Review Headline,
 *    Detailed Feedback and the durability choice ("high"/"medium"/"low" —
 *    the web page keeps the same state and sends it with every POST; the
 *    native surface renders the real selector instead of a silent
 *    constant). The web's image-upload affordance is deliberately NOT
 *    ported: the route only accepts urls already under
 *    /uploads/review-media/ and there is no native upload client —
 *    sending the images field would be a guaranteed 400, so the body
 *    OMITS it entirely (CreateReviewBody declares no images field).
 *  - VALIDATION (web parity, in the web's order): title+comment both
 *    required client-side ("Please provide a title and review
 *    description."), then the productId presence check ("No product
 *    selected — you can only review a real product page.").
 *  - SUBMIT: double-submit guarded (submitting flag + disabled button),
 *    success = HTTP 201 + success envelope → the "Review Submitted!"
 *    view; failures surface the REAL error text verbatim — 400 ("Rating
 *    must be an integer between 1 and 5" / "Review text is required" /
 *    "A real productId is required to review"), 404 ("Product not found
 *    — you can only review real catalog products"), 409 ("You have
 *    already reviewed this product — one review per buyer per
 *    product."), 429 ("Too many requests. Try again in <n>s."), the 401
 *    buyer-gate text, the web's "Review failed (HTTP n)" fallback and
 *    its network-error copy.
 *  - Nothing is cached: there is no read payload on this surface.
 */
data class WriteReviewUiState(
    /** The product being reviewed — blank mirrors the web's missing id. */
    val productId: String = "",
    /** Interactive star input (web default 5). */
    val rating: Int = 5,
    val title: String = "",
    val comment: String = "",
    /** The durability wire value — "high" | "medium" | "low". */
    val durability: String = "high",
    /** POST in flight — also the double-submit guard. */
    val submitting: Boolean = false,
    /** Real 201 → the "Review Submitted!" view (web setSubmitted). */
    val submitted: Boolean = false,
    /** Server/validation error text (web error state, verbatim copy). */
    val error: String? = null,
    /** Signed out before typing — the honest gate (AddAddress convention). */
    val needsAuth: Boolean = false,
)

class WriteReviewViewModel(
    private val appContext: Context,
) : ViewModel() {

    private val _state = MutableStateFlow(WriteReviewUiState())
    val state: StateFlow<WriteReviewUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var submitJob: Job? = null

    /** Entry resolve (called on EVERY entry; resets the form like the web). */
    fun load(query: String?) {
        if (submitJob?.isActive == true) return
        val productId = productIdFromQuery(query).orEmpty()
        if (SessionManager.token() == null) {
            _state.value = WriteReviewUiState(productId = productId, needsAuth = true)
            return
        }
        _state.value = WriteReviewUiState(productId = productId)
    }

    fun setRating(rating: Int) {
        _state.update { it.copy(rating = rating.coerceIn(1, 5), error = null) }
    }

    fun setTitle(title: String) {
        _state.update { it.copy(title = title) }
    }

    fun setComment(comment: String) {
        _state.update { it.copy(comment = comment) }
    }

    fun setDurability(durability: String) {
        _state.update { it.copy(durability = durability) }
    }

    /** Submit tap — web handleSubmit's exact order of checks. */
    fun submit() {
        val current = _state.value
        if (current.submitting || current.submitted) return // double-submit guard

        // Web validation order: text first, then the productId presence check.
        if (current.title.isBlank() || current.comment.isBlank()) {
            _state.update { it.copy(error = "Please provide a title and review description.") }
            return
        }
        if (current.productId.isBlank()) {
            _state.update { it.copy(error = "No product selected — you can only review a real product page.") }
            return
        }

        _state.update { it.copy(submitting = true, error = null) }
        submitJob = viewModelScope.launch { create(current) }
    }

    private suspend fun create(form: WriteReviewUiState) {
        try {
            Log.i(TAG, "submit review productId=${form.productId} rating=${form.rating}")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.reviewsApi(base).create(
                CreateReviewBody(
                    productId = form.productId,
                    rating = form.rating,
                    title = form.title.trim().takeIf(String::isNotBlank),
                    comment = form.comment.trim().takeIf(String::isNotBlank),
                    durability = form.durability.takeIf(String::isNotBlank),
                ),
            )
            val payload = response.body()
            if (response.isSuccessful && payload?.success == true) {
                Log.i(TAG, "review created id=${payload?.data?.id}")
                _state.value = _state.value.copy(submitting = false, submitted = true)
                return
            }
            if (response.code() == 401) {
                // Buyer-only route: a session that died mid-flow lands on the
                // gate; a live NON-buyer session gets the route's real text.
                if (SessionManager.token() == null) {
                    _state.value = WriteReviewUiState(productId = form.productId, needsAuth = true)
                } else {
                    _state.update {
                        it.copy(
                            submitting = false,
                            error = parseErrorBody(response.errorBody()).error
                                ?.takeIf(String::isNotBlank)
                                ?: "You must be signed in as a buyer to submit a review.",
                        )
                    }
                }
                return
            }
            // REAL backend error — shown verbatim, never masked as success
            // (400/404/409/429 all arrive as { error }).
            val message = parseErrorBody(response.errorBody()).error
                ?.takeIf(String::isNotBlank)
                ?: "Review failed (HTTP ${response.code()}). Please try again."
            Log.w(TAG, "review rejected: $message")
            _state.update { it.copy(submitting = false, error = message) }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "review submit failed: ${e.message}")
            _state.update {
                it.copy(
                    submitting = false,
                    error = "Network error while submitting your review. Check your connection and retry.",
                )
            }
        }
    }

    private companion object {
        const val TAG = "ZylodReviews"
    }
}
