package com.zylod.wholesale.ui.content

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.NewsletterSubscribeBody
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Newsletter VM — the record for the native "newsletter" pageId.
 *
 * Data truth: the web's SPA maps the 'newsletter' pageId onto the
 * promotions feed (chunk-misc.ts:318) — an auth-gated surface that is NOT
 * a subscribe form; the REAL newsletter surface in the web is the footer
 * subscription bar (footer.tsx handleSubscribe → POST api/newsletter with
 * source 'footer'). The native screen mirrors THAT surface honestly:
 * the footer bar's verbatim copy ("Get wholesale deals & market updates" /
 * "Subscribe to our newsletter for exclusive offers, new supplier
 * listings, and market insights."), the "your@email.com" placeholder and
 * the Subscribe button. There is NO GET on api/newsletter (the subscriber
 * list is private) — so no fabricated "your subscription" readback, and
 * no fabricated benefits list.
 *
 * Validation + messages, branch for branch with the web + the route:
 *  - client gate (web footer): empty email → 'Please enter a valid email
 *    address'; the native gate additionally runs the route's own
 *    EMAIL_RE (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/) so the 400 text can
 *    never surprise a formatted-but-invalid address.
 *  - 200 with alreadySubscribed=true → 'You are already subscribed.'
 *  - 201 (or 200 with alreadySubscribed=false) → 'Successfully
 *    subscribed!'
 *  - 400/429/500 → the route's error text verbatim ('Please enter a
 *    valid email address' / 'Too many requests. Try again in Ns.' /
 *    'Internal server error') || the web's fallback 'Subscription
 *    failed. Please try again later.'
 *  - network exception → the web's verbatim 'Network error — could not
 *    reach the subscription service.'
 * Rate limit 5/min — a second submit inside the window shows the 429 text
 * verbatim. PUBLIC route: works signed-out.
 */
class NewsletterViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(NewsletterUiState())
    val state: StateFlow<NewsletterUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var submitJob: Job? = null

    fun setEmail(value: String) = _state.update {
        it.copy(email = value, error = null, successMessage = null)
    }

    /**
     * Subscribe — client gate first, then ONE wire call (the submitting
     * flag is set before the call and only cleared when it settles, so a
     * double tap can never double-post past the 5/min window).
     */
    fun subscribe() {
        val current = _state.value
        if (current.submitting) return
        val email = current.email.trim().lowercase()
        if (email.isEmpty() || !NEWSLETTER_EMAIL_REGEX.matches(email)) {
            _state.update { it.copy(error = "Please enter a valid email address") }
            return
        }
        _state.update { it.copy(submitting = true, error = null, successMessage = null) }
        submitJob?.cancel()
        submitJob = viewModelScope.launch {
            try {
                Log.i(TAG, "newsletter subscribe pageId=$pageId")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.contentApi(base).subscribeNewsletter(
                    NewsletterSubscribeBody(email = email, source = "footer"),
                )
                val payload = response.body()
                if (response.isSuccessful && payload?.success == true) {
                    val already = payload.data?.alreadySubscribed == true
                    Log.i(TAG, "newsletter subscribed already=$already")
                    _state.update {
                        it.copy(
                            submitting = false,
                            successMessage = if (already) {
                                "You are already subscribed."
                            } else {
                                "Successfully subscribed!"
                            },
                            email = "",
                            error = null,
                        )
                    }
                } else {
                    // 400/429/500 carry { error } — the route's text verbatim.
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: payload?.error?.takeIf(String::isNotBlank)
                        ?: "Subscription failed. Please try again later."
                    Log.w(TAG, "newsletter error: $message")
                    _state.update { it.copy(submitting = false, error = message) }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "newsletter network failed: ${e.message}")
                _state.update {
                    it.copy(
                        submitting = false,
                        error = "Network error — could not reach the subscription service.",
                    )
                }
            }
        }
    }

    private companion object {
        const val TAG = "ZylodContent"
    }
}
