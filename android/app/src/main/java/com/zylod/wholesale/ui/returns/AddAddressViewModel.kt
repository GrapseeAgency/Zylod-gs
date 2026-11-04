package com.zylod.wholesale.ui.returns

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.AddressDto
import com.zylod.wholesale.data.api.AddressSaveBody
import com.zylod.wholesale.data.api.ApiClient
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
 * Add-address VM — POST api/addresses (AddressesApi.create, the exact
 * endpoint add-address-page.tsx:60 calls) plus the edit surface's PUT /
 * DELETE api/addresses/{id} (AddressesApi.update/delete — the web
 * edit-address-page.tsx:78/:109 calls, which the native address-book
 * pencil reaches by opening THIS page with the addressId in the query).
 * Payload of record for the native add-address pageId in both modes.
 *
 *  - FORM (web parity, field for field): fullName*, businessName (optional),
 *    phone*, country* (the web COUNTRIES list), streetLine1* (+ the
 *    optional second line), city*, postalCode*, setAsDefault checkbox —
 *    with the web's exact per-field validation messages.
 *  - WIRE BODY: the web page's exact snake_case payload — label = fullName,
 *    contact_name = fullName, contact_phone = phone, address_line1/2,
 *    city, postal_code, country, is_default (company_name only when the
 *    business name is non-blank). Optional strings are omitted
 *    (explicitNulls) exactly like the web `|| undefined` fallbacks. The
 *    SAME body goes to PUT (task contract: "PUT api/addresses/{id} (same
 *    body)") — its server-side required trio (address_line1/city/
 *    postal_code) is exactly the form's required set.
 *  - EDITING: an entry query carrying "addressId=…" (or a bare id pair,
 *    the web edit-address-page's `addressId || id` resolution) flips the
 *    VM into edit mode: PUT api/addresses/{addressId} on save and DELETE
 *    on the delete affordance, mirroring the web edit page. PREFILL: the
 *    web edit page GETs api/addresses/{id} — a route the server does NOT
 *    implement (405; its form starts blank) — so the native address-book
 *    pencil attaches the FULL wire row it already holds via
 *    [AddressEditDraft] and the form opens PRE-FILLED. A PUT from a blank
 *    form would silently null every optional field the buyer did not
 *    retype (company_name/contact_name are written from the body, `??
 *    null`). No draft (process death / a cold external link) → the honest
 *    blank edit form, same as the web.
 *  - ERRORS: client validation first; then the routes' REAL 400 text
 *    ("Missing required field(s): …" / "address_line1, city and
 *    postal_code are required") is surfaced verbatim in the server error
 *    line; a network failure shows the web's retry copy. 401 → the honest
 *    sign-in gate (the web gates guests BEFORE they type).
 *  - SUCCESS: the web just calls goBack() for both create and update —
 *    the native screen pops back, and the address book re-reads the fresh
 *    book on re-entry. Delete success jumps back to the address book (the
 *    web edit page's navigate('shipping-address')).
 */
/**
 * Process-lifetime edit draft — the address-book pencil hands the FULL wire
 * row to the add-address form (the book's display model drops postalCode /
 * addressLine2, and the server exposes no GET-by-id to prefill from). The
 * old pencil opened a BLANK edit form whose PUT silently nulled every field
 * the buyer did not retype. Consumed once by the first matching load; a
 * process death mid-edit falls back to the honest blank edit form.
 */
object AddressEditDraft {
    @Volatile
    var row: AddressDto? = null

    /** One-shot consume: returns the row ONLY when it matches the target id. */
    fun take(addressId: String): AddressDto? {
        val current = row ?: return null
        return if (current.id == addressId) {
            row = null
            current
        } else {
            null
        }
    }
}

data class AddAddressForm(
    val fullName: String = "",
    val businessName: String = "",
    val phone: String = "",
    val country: String = "",
    val streetLine1: String = "",
    val streetLine2: String = "",
    val city: String = "",
    val postalCode: String = "",
    val setAsDefault: Boolean = false,
)

data class AddAddressUiState(
    /** Signed out (no token) — the gate BEFORE the buyer types anything. */
    val needsAuth: Boolean = false,
    /** Non-blank → edit mode: the REAL address being updated/deleted. */
    val addressId: String = "",
    val form: AddAddressForm = AddAddressForm(),
    /** Field key → validation message; key "_server" → the server line. */
    val errors: Map<String, String> = emptyMap(),
    /** Save in flight — the Save button is disabled (route rate limits). */
    val saving: Boolean = false,
    /** Real 201/200 → the screen pops back (web goBack()). */
    val saved: Boolean = false,
    /** Delete in flight — the Delete button is disabled. */
    val deleting: Boolean = false,
    /** Real DELETE 200 → the screen jumps back to the address book. */
    val deleted: Boolean = false,
) {
    /** Edit mode = the entry query carried an addressId (web edit parity). */
    val isEdit: Boolean get() = addressId.isNotBlank()

    /** The red server line above the form (web errors._server). */
    val serverError: String? get() = errors["_server"]
}

class AddAddressViewModel(
    private val appContext: Context,
) : ViewModel() {

    private val _state = MutableStateFlow(AddAddressUiState())
    val state: StateFlow<AddAddressUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var saveJob: Job? = null
    private var deleteJob: Job? = null
    private var lastQuery: String = ""

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (TrackOrderViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(needsAuth = true)
                }
            }
        }
    }

    /**
     * Entry resolve — guests are gated before they type (web parity); the
     * query's addressId selects add vs edit mode (a NEW addressId resets
     * the form — the VM survives on the saved back stack like the
     * TrackOrderViewModel does across entries).
     */
    fun load(entryQuery: String? = null) {
        if (entryQuery != null) lastQuery = entryQuery
        val addressId = addressIdFromQuery(lastQuery).orEmpty()
        if (addressId != _state.value.addressId) {
            // Different target → a fresh form for the new mode. Edit forms
            // prefill from the in-memory draft the address-book pencil
            // attached (the server exposes no GET-by-id; the draft carries
            // the full row the book already holds). No draft → the honest
            // blank edit form (web parity).
            val draft = addressId.takeIf(String::isNotBlank)?.let { AddressEditDraft.take(it) }
            _state.value = AddAddressUiState(
                addressId = addressId,
                form = draft?.let(::prefillFrom) ?: AddAddressForm(),
            )
        }
        // The gate tracks the LIVE token (a signed-out state clears itself
        // on re-entry with a fresh session, like the web authChecking probe).
        _state.update { it.copy(needsAuth = SessionManager.token() == null) }
    }

    /** The pencil's wire row → the form's exact field set. */
    private fun prefillFrom(d: AddressDto) = AddAddressForm(
        fullName = d.contactName?.takeIf(String::isNotBlank) ?: d.label.orEmpty(),
        businessName = d.companyName.orEmpty(),
        phone = d.contactPhone.orEmpty(),
        country = d.country.orEmpty(),
        streetLine1 = d.addressLine1.orEmpty(),
        streetLine2 = d.addressLine2.orEmpty(),
        city = d.city.orEmpty(),
        postalCode = d.postalCode.orEmpty(),
        setAsDefault = d.isDefault,
    )

    /** One typed keystroke — clears that field's validation error (web). */
    fun setField(key: String, value: String) {
        _state.update { s ->
            s.copy(
                form = updateField(s.form, key, value),
                errors = s.errors - key,
            )
        }
    }

    fun setDefault(checked: Boolean) {
        _state.update { it.copy(form = it.form.copy(setAsDefault = checked)) }
    }

    /**
     * Validate → POST (create) or PUT (edit). Double-submit guard: the
     * Save button is disabled while [AddAddressUiState.saving] (the routes
     * rate-limit at 20/min create and 30/min update).
     */
    fun save() {
        val s = _state.value
        if (s.saving || s.saved) return
        val validation = validate(s.form)
        if (validation.isNotEmpty()) {
            _state.update { it.copy(errors = validation) }
            return
        }
        saveJob?.cancel()
        _state.update { it.copy(saving = true, errors = emptyMap()) }
        saveJob = viewModelScope.launch {
            try {
                val form = s.form
                Log.i(TAG, "save address city=${form.city}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val body = AddressSaveBody(
                    label = form.fullName.trim(),
                    companyName = form.businessName.trim().takeIf(String::isNotBlank),
                    contactName = form.fullName.trim(),
                    contactPhone = form.phone.trim(),
                    addressLine1 = form.streetLine1.trim(),
                    addressLine2 = form.streetLine2.trim().takeIf(String::isNotBlank),
                    city = form.city.trim(),
                    postalCode = form.postalCode.trim(),
                    country = form.country.trim(),
                    isDefault = form.setAsDefault,
                )
                val response = if (s.isEdit) {
                    Log.i(TAG, "update address ${s.addressId.takeLast(6)} city=${form.city}")
                    ApiClient.addressesApi(base).update(s.addressId, body)
                } else {
                    Log.i(TAG, "create address city=${form.city}")
                    ApiClient.addressesApi(base).create(body)
                }
                if (response.code() == 401) {
                    Log.i(TAG, "save rejected (http=401) — session ended")
                    _state.update { it.copy(saving = false, needsAuth = true) }
                    return@launch
                }
                val payload = response.body()
                if (response.isSuccessful && payload?.success == true) {
                    Log.i(TAG, "address saved id=${payload.data?.id ?: "--"}")
                    _state.update { it.copy(saving = false, saved = true) }
                    return@launch
                }
                // The routes' REAL 400 text lists the missing fields —
                // surface it verbatim (web shows a generic fallback because
                // it reads `message`; the native shows the honest `error`).
                val fallback = if (s.isEdit) "Failed to update address" else "Failed to save address"
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: fallback
                Log.w(TAG, "save failed: $message")
                _state.update { it.copy(saving = false, errors = mapOf(SERVER_ERROR_KEY to message)) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "save failed: ${e.message}")
                _state.update {
                    it.copy(saving = false, errors = mapOf(SERVER_ERROR_KEY to "Network error. Please try again."))
                }
            }
        }
    }

    /**
     * DELETE api/addresses/{addressId} — the web edit page's delete
     * affordance, verbatim: disabled while deleting, failure surfaces the
     * web's error text, success jumps back to the address book (the server
     * promotes a remaining address to default when none is flagged).
     */
    fun delete() {
        val s = _state.value
        if (!s.isEdit || s.deleting || s.deleted || s.saved) return
        deleteJob?.cancel()
        _state.update { it.copy(deleting = true, errors = emptyMap()) }
        deleteJob = viewModelScope.launch {
            try {
                Log.i(TAG, "delete address ${s.addressId.takeLast(6)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.addressesApi(base).delete(s.addressId)
                if (response.code() == 401) {
                    Log.i(TAG, "delete rejected (http=401) — session ended")
                    _state.update { it.copy(deleting = false, needsAuth = true) }
                    return@launch
                }
                val payload = response.body()
                if (response.isSuccessful && payload?.success == true) {
                    Log.i(TAG, "address deleted id=${payload.data?.id ?: "--"}")
                    _state.update { it.copy(deleting = false, deleted = true) }
                    return@launch
                }
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Failed to delete address."
                Log.w(TAG, "delete failed: $message")
                _state.update { it.copy(deleting = false, errors = mapOf(SERVER_ERROR_KEY to message)) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "delete failed: ${e.message}")
                _state.update {
                    it.copy(deleting = false, errors = mapOf(SERVER_ERROR_KEY to "Network error. Please try again."))
                }
            }
        }
    }

    /** The web validate() — same required set, same messages, same keys. */
    private fun validate(form: AddAddressForm): Map<String, String> {
        val errors = mutableMapOf<String, String>()
        if (form.fullName.isBlank()) errors["fullName"] = "Full name is required"
        if (form.phone.isBlank()) errors["phone"] = "Phone number is required"
        if (form.country.isBlank()) errors["country"] = "Country/Region is required"
        if (form.streetLine1.isBlank()) errors["streetLine1"] = "Street address is required"
        if (form.city.isBlank()) errors["city"] = "City is required"
        if (form.postalCode.isBlank()) errors["postalCode"] = "Postal/Zip code is required"
        return errors
    }

    private fun updateField(form: AddAddressForm, key: String, value: String) = when (key) {
        "fullName" -> form.copy(fullName = value)
        "businessName" -> form.copy(businessName = value)
        "phone" -> form.copy(phone = value)
        "country" -> form.copy(country = value)
        "streetLine1" -> form.copy(streetLine1 = value)
        "streetLine2" -> form.copy(streetLine2 = value)
        "city" -> form.copy(city = value)
        "postalCode" -> form.copy(postalCode = value)
        else -> form
    }

    private companion object {
        const val TAG = "ZylodAddresses"
        const val SERVER_ERROR_KEY = "_server"
    }
}

/** The web COUNTRIES dropdown — the exact option list, verbatim order. */
val ADDRESS_COUNTRIES = listOf(
    "Bangladesh", "India", "Pakistan", "China", "USA", "UK", "UAE",
    "Germany", "Japan", "South Korea", "Turkey", "Malaysia", "Singapore",
)

/**
 * Extracts an address id from the page's entry query, mirroring the native
 * key=value query convention and the web edit-address-page's
 * `pageParams.addressId || pageParams.id || ''` resolution: "addressId=x"
 * first, then a bare "&id=x" pair, then a bare single token without any
 * "=". Null when nothing usable is present (→ create mode).
 */
fun addressIdFromQuery(query: String?): String? {
    val raw = query?.trim().orEmpty()
    if (raw.isEmpty()) return null
    val named = Regex("addressId=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!named.isNullOrBlank()) return named
    val bare = Regex("(?:^|&)id=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!bare.isNullOrBlank()) return bare
    return raw.takeIf { !it.contains('=') }
}
