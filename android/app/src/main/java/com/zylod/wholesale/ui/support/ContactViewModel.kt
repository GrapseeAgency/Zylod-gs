package com.zylod.wholesale.ui.support

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SupportContactBody
import com.zylod.wholesale.data.api.parseErrorBody
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Contact VM — POST api/support/contact (SupportPublicApi.submitContact)
 * as the record for the native "contact-page" pageId
 * (contact-us-page.tsx ported 1:1):
 *
 *  - VALIDATION is the web form's `required` attrs: name, email, subject,
 *    message (the route's own 400 contract — its verbatim error string is
 *    shown client-side before the wire; phone is optional, category
 *    defaults to the web's "general").
 *  - DOUBLE-SUBMIT GUARD: the in-flight [submitting] flag disables the
 *    button (the web's disabled={loading}); a second tap can never send.
 *  - The owner-published support.email (GET api/settings/public) renders
 *    the email card — when nothing is published the card says so honestly
 *    (the t187-d rule), never an invented address.
 *  - FAILURE: the server's verbatim `{ error }` (400 "Name, email,
 *    subject, and message are required" / 429 rate limit / 500), the web's
 *    fallback "Failed to submit inquiry", or the web's network line.
 *  - SUCCESS: 201 { success, message: "Your inquiry has been submitted..." }
 *    → the web's "Inquiry Received" view with "Send Another Message".
 *
 * PUBLIC route (optional auth): no sign-in gate — the web form renders for
 * guests and so does this one.
 */
data class ContactUiState(
    val name: String = "",
    val email: String = "",
    val phone: String = "",
    /** Web default category "general". */
    val category: String = "general",
    val subject: String = "",
    val message: String = "",
    /** POST in flight — the submit button's disabled state. */
    val submitting: Boolean = false,
    /** 201 → the web's submitted view. */
    val submitted: Boolean = false,
    /** Real error line (server copy verbatim). */
    val error: String? = null,
    /** The owner-published support email (empty → honest absence copy). */
    val supportEmail: String = "",
    /** GET api/settings/public resolve failed (honest "could not load"). */
    val contactsError: Boolean = false,
)

class ContactViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(ContactUiState())
    val state: StateFlow<ContactUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var submitJob: Job? = null
    private var settingsJob: Job? = null

    /** Entry resolve: the published support email + a fresh form state. */
    fun load() {
        fetchSettings()
    }

    fun setName(value: String) = _state.update { it.copy(name = value, error = null) }
    fun setEmail(value: String) = _state.update { it.copy(email = value, error = null) }
    fun setPhone(value: String) = _state.update { it.copy(phone = value, error = null) }
    fun setCategory(value: String) = _state.update { it.copy(category = value, error = null) }
    fun setSubject(value: String) = _state.update { it.copy(subject = value, error = null) }
    fun setMessage(value: String) = _state.update { it.copy(message = value, error = null) }

    /** Web "Send Another Message" — clears the form back to the web defaults. */
    fun reset() {
        _state.update {
            it.copy(
                name = "",
                email = "",
                phone = "",
                category = "general",
                subject = "",
                message = "",
                submitted = false,
                error = null,
            )
        }
    }

    /**
     * Submit — client-side required gate first (the route's own 400 text),
     * then ONE wire call: the submitting flag is set before the call and
     * only cleared when it settles, so a double tap can never double-post.
     */
    fun submit() {
        val current = _state.value
        if (current.submitting) return
        val missing = current.name.isBlank() || current.email.isBlank() ||
            current.subject.isBlank() || current.message.isBlank()
        if (missing) {
            _state.update { it.copy(error = "Name, email, subject, and message are required") }
            return
        }
        _state.update { it.copy(submitting = true, error = null) }
        submitJob?.cancel()
        submitJob = viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.supportPublicApi(base).submitContact(
                    SupportContactBody(
                        name = current.name.trim(),
                        email = current.email.trim(),
                        phone = current.phone.trim(),
                        category = current.category,
                        subject = current.subject.trim(),
                        message = current.message.trim(),
                        // attachmentUrl omitted — no native upload client, nothing faked.
                    ),
                )
                val payload = response.body()
                if (response.isSuccessful && payload?.success == true) {
                    Log.i(TAG, "contact submitted pageId=$pageId")
                    _state.update { it.copy(submitting = false, submitted = true, error = null) }
                } else {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Failed to submit inquiry"
                    Log.w(TAG, "contact submit failed: $message")
                    _state.update { it.copy(submitting = false, error = message) }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "contact submit network failed: ${e.message}")
                _state.update {
                    it.copy(submitting = false, error = "Network error. Please check connection and try again.")
                }
            }
        }
    }

    /** GET api/settings/public — support.email for the email card. */
    private fun fetchSettings() {
        settingsJob?.cancel()
        settingsJob = viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.supportPublicApi(base).publicSettings()
                val payload = response.body()
                val data = payload?.data?.takeIf { response.isSuccessful && payload?.success == true }
                if (data == null) {
                    _state.update { it.copy(contactsError = true) }
                    return@launch
                }
                _state.update {
                    it.copy(supportEmail = data.settings.stringSetting("support.email"), contactsError = false)
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "contact settings fetch failed: ${e.message}")
                _state.update { it.copy(contactsError = true) }
            }
        }
    }

    private companion object {
        const val TAG = "ZylodSupport"
    }
}

/** The web categories constant — verbatim values and labels. */
internal data class ContactCategory(val value: String, val label: String)

internal val CONTACT_CATEGORIES = listOf(
    ContactCategory("order_issue", "Order & Consignment Issue"),
    ContactCategory("payment_issue", "Payments & Verification"),
    ContactCategory("seller_issue", "Supplier Onboarding / Verification"),
    ContactCategory("product_issue", "Product Specifications / RFQ"),
    ContactCategory("general", "General Commercial Inquiry"),
)
