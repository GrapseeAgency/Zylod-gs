package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CardCreateBody
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
 * Add-card VM — POST api/cards (FinanceApi.createCard, cards/route.ts:41)
 * as the payload of record for the native add-card pageId.
 *
 *  - FORM (route parity, field for field): cardNumber* (displayed with
 *    digit grouping, sent as the FULL number — the SERVER tokenizes it to
 *    last4, cards/route.ts:61-62), holderName*, expiry* (MM/YY), the
 *    debit/credit toggle (the route's cardType column value) and the
 *    brand picker (Visa/Mastercard/Amex → the brand/cardNetwork column),
 *    plus the set-as-default switch (the server demotes the user's other
 *    card rows when true).
 *  - ERRORS: the client guard mirrors the route's required trio (number /
 *    holder / expiry) and the MM/YY shape; then the route's REAL 400 text
 *    surfaces verbatim in the server error line. 401 → the honest
 *    sign-in gate.
 *  - GUARDS: the submit button is disabled while saving and the VM ignores
 *    submits while one is in flight or already saved (the route rate-limits
 *    at 10/min).
 *  - SUCCESS: the wire's real message ("Card added securely") becomes the
 *    screen's snackbar; the screen then pops back and the cards list
 *    re-reads the fresh list on re-entry.
 */
data class AddCardForm(
    val cardNumber: String = "",
    val holderName: String = "",
    val expiry: String = "",
    val isDebit: Boolean = false,
    val brand: String = "Visa",
    val setAsDefault: Boolean = false,
)

data class AddCardUiState(
    /** Signed out (no token) — the gate BEFORE the buyer types anything. */
    val needsAuth: Boolean = false,
    val form: AddCardForm = AddCardForm(),
    /** Field key → validation message; key "_server" → the server line. */
    val errors: Map<String, String> = emptyMap(),
    /** Submit in flight — the button is disabled (route rate limits). */
    val saving: Boolean = false,
    /** Real 200 → the screen shows the snackbar and pops back. */
    val saved: Boolean = false,
    /** The REAL server message on success ("Card added securely"). */
    val successMessage: String = "",
) {
    /** The red server line above the form. */
    val serverError: String? get() = errors["_server"]

    /** Digit-grouped live display of the card number field. */
    val displayCardNumber: String get() = groupCardDigits(form.cardNumber)
}

class AddCardViewModel(
    private val appContext: Context,
) : ViewModel() {

    private val _state = MutableStateFlow(AddCardUiState())
    val state: StateFlow<AddCardUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var saveJob: Job? = null

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (AddBankAccountViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(needsAuth = true)
                }
            }
        }
    }

    /** Entry resolve — guests are gated before they type (web parity). */
    fun load() {
        _state.update { it.copy(needsAuth = SessionManager.token() == null) }
    }

    /**
     * One typed keystroke. The card number keeps ONLY the digits (the
     * grouped form is display sugar) and expiry is auto-formatted to
     * MM/YY. Clears that field's validation error.
     */
    fun setField(key: String, value: String) {
        _state.update { s ->
            val next = when (key) {
                "cardNumber" -> s.form.copy(cardNumber = value.filter(Char::isDigit).take(19))
                "expiry" -> s.form.copy(expiry = formatExpiryInput(value))
                "holderName" -> s.form.copy(holderName = value)
                else -> s.form
            }
            s.copy(form = next, errors = s.errors - key)
        }
    }

    fun setDebit(isDebit: Boolean) {
        _state.update { it.copy(form = it.form.copy(isDebit = isDebit)) }
    }

    fun setBrand(brand: String) {
        _state.update { it.copy(form = it.form.copy(brand = brand)) }
    }

    fun setDefault(checked: Boolean) {
        _state.update { it.copy(form = it.form.copy(setAsDefault = checked)) }
    }

    /**
     * Validate → POST. Double-submit guard: ignored while a save is in
     * flight or already completed; the Submit button is disabled meanwhile.
     */
    fun save() {
        val s = _state.value
        if (s.saving || s.saved) return
        if (SessionManager.token() == null) {
            _state.update { it.copy(needsAuth = true) }
            return
        }
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
                Log.i(TAG, "create card brand=${form.brand} last4=…${form.cardNumber.takeLast(4)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.financeApi(base).createCard(
                    CardCreateBody(
                        // The FULL number on the wire — the server tokenizes
                        // to last4 before storing (cards/route.ts:61-77).
                        cardNumber = form.cardNumber,
                        holderName = form.holderName.trim(),
                        expiry = form.expiry.trim(),
                        cardType = if (form.isDebit) "debit" else "credit",
                        brand = form.brand.takeIf(String::isNotBlank),
                        isDefault = form.setAsDefault,
                    ),
                )
                if (response.code() == 401) {
                    Log.i(TAG, "save rejected (http=401) — session ended")
                    _state.update { it.copy(saving = false, needsAuth = true) }
                    return@launch
                }
                val payload = response.body()
                if (response.isSuccessful && payload?.success == true) {
                    val message = payload.message?.takeIf(String::isNotBlank)
                        ?: "Card added securely"
                    Log.i(TAG, "card saved id=${payload.data?.id ?: "--"}")
                    _state.update { it.copy(saving = false, saved = true, successMessage = message) }
                    return@launch
                }
                // The route's REAL 400 text — surface it verbatim.
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Failed to add the card"
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
     * The route's required trio (cards/route.ts:57) + the honest MM/YY
     * shape check and a digits-length floor for the number.
     */
    private fun validate(form: AddCardForm): Map<String, String> {
        val errors = mutableMapOf<String, String>()
        if (form.cardNumber.length < 12) errors["cardNumber"] = "Enter the full card number"
        if (form.holderName.isBlank()) errors["holderName"] = "Cardholder name is required"
        when {
            form.expiry.isBlank() -> errors["expiry"] = "Expiry is required"
            !isValidExpiry(form.expiry) -> errors["expiry"] = "Expiry must be in MM/YY format"
        }
        return errors
    }

    private companion object {
        const val TAG = "ZylodFinance"
        const val SERVER_ERROR_KEY = "_server"
    }
}
