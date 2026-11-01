package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.PaymentMethodCreateBody
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
 * Add-payment-method VM — POST api/payment-methods (FinanceApi
 * .createPaymentMethod, payment-methods/route.ts:32) as the payload of
 * record for the native add-payment-method pageId. The route has TWO
 * families and this form mirrors both:
 *
 *  - MOBILE WALLET (type bKash|Nagad|Upay|Rocket): a label is REQUIRED and
 *    the accountNumber must match the route's Bangladeshi phone regex
 *    ^(\+8801|8801|01)[3-9]\d{8}$ — mirrored client-side as a hint, with
 *    the route's REAL 400 text still surfacing verbatim when it fires.
 *  - CARD (type debit|credit): a holderName is REQUIRED and the
 *    accountNumber must be the TOKENIZED LAST 4 ONLY (^\d{4}$ — "Card must
 *    be tokenized"; the raw PAN is never persisted on this rail). The form
 *    accepts a full number for convenience and sends the derived last4,
 *    matching the route's documented tokenized storage. Expiry, when
 *    given, must be MM/YY.
 *
 *  - GUARDS: submit disabled while saving; double-submits ignored (the
 *    route rate-limits at 10/min). 401 → the honest sign-in gate.
 *  - SUCCESS: 201 → the screen shows an honest confirmation snackbar and
 *    pops back; the payment-methods list re-fetches on re-entry.
 */
data class AddPaymentMethodForm(
    /** "wallet" | "card" — the segmented toggle. */
    val family: String = FAMILY_WALLET,
    val provider: String = "bKash",
    val walletLabel: String = "",
    val walletAccount: String = "",
    val cardNumber: String = "",
    val holderName: String = "",
    val expiry: String = "",
    val isDebit: Boolean = false,
    val cardNetwork: String = "Visa",
) {
    /** "debit" | "credit" — the wire value for the card family. */
    val cardType: String get() = if (isDebit) "debit" else "credit"

    companion object {
        const val FAMILY_WALLET = "wallet"
        const val FAMILY_CARD = "card"
    }
}

data class AddPaymentMethodUiState(
    /** Signed out (no token) — the gate BEFORE the buyer types anything. */
    val needsAuth: Boolean = false,
    val form: AddPaymentMethodForm = AddPaymentMethodForm(),
    /** Field key → validation message; key "_server" → the server line. */
    val errors: Map<String, String> = emptyMap(),
    /** Submit in flight — the button is disabled (route rate limits). */
    val saving: Boolean = false,
    /** Real 201 → the screen shows the snackbar and pops back. */
    val saved: Boolean = false,
    /** The honest success line (the created row's real label). */
    val successMessage: String = "",
) {
    /** The red server line above the form. */
    val serverError: String? get() = errors["_server"]

    /** Digit-grouped live display of the card number field. */
    val displayCardNumber: String get() = groupCardDigits(form.cardNumber)
}

class AddPaymentMethodViewModel(
    private val appContext: Context,
) : ViewModel() {

    private val _state = MutableStateFlow(AddPaymentMethodUiState())
    val state: StateFlow<AddPaymentMethodUiState> = _state.asStateFlow()

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

    /** Segmented toggle — switching families clears the validation lines. */
    fun setFamily(family: String) {
        _state.update {
            it.copy(
                form = it.form.copy(family = family),
                errors = emptyMap(),
            )
        }
    }

    fun setProvider(provider: String) {
        _state.update { it.copy(form = it.form.copy(provider = provider)) }
    }

    fun setField(key: String, value: String) {
        _state.update { s ->
            val next = when (key) {
                "walletLabel" -> s.form.copy(walletLabel = value)
                "walletAccount" -> s.form.copy(walletAccount = value)
                "cardNumber" -> s.form.copy(cardNumber = value.filter(Char::isDigit).take(19))
                "expiry" -> s.form.copy(expiry = formatExpiryInput(value))
                "holderName" -> s.form.copy(holderName = value)
                else -> s.form
            }
            s.copy(form = next, errors = s.errors - key)
        }
    }

    fun setCardFamilyType(isDebit: Boolean) {
        _state.update { it.copy(form = it.form.copy(isDebit = isDebit)) }
    }

    fun setCardNetwork(network: String) {
        _state.update { it.copy(form = it.form.copy(cardNetwork = network)) }
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
                val body = if (form.family == AddPaymentMethodForm.FAMILY_WALLET) {
                    Log.i(TAG, "create wallet method ${form.provider}")
                    // Wallet family: the provider IS the type (the route's
                    // exact whitelist casing), the phone goes verbatim.
                    PaymentMethodCreateBody(
                        type = form.provider,
                        accountNumber = form.walletAccount.trim(),
                        label = form.walletLabel.trim(),
                    )
                } else {
                    Log.i(TAG, "create card method ${form.cardType} last4=…${form.cardNumber.takeLast(4)}")
                    // Card family: the route's tokenized contract — ONLY the
                    // last 4 digits go on the wire (^\d{4}$ server-side).
                    PaymentMethodCreateBody(
                        type = form.cardType,
                        accountNumber = form.cardNumber.takeLast(4),
                        holderName = form.holderName.trim(),
                        expiry = form.expiry.trim().takeIf(String::isNotBlank),
                        cardNetwork = form.cardNetwork.takeIf(String::isNotBlank),
                    )
                }
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.financeApi(base).createPaymentMethod(body)
                if (response.code() == 401) {
                    Log.i(TAG, "save rejected (http=401) — session ended")
                    _state.update { it.copy(saving = false, needsAuth = true) }
                    return@launch
                }
                val payload = response.body()
                if (response.isSuccessful && payload?.success == true) {
                    val label = payload.data?.label?.takeIf(String::isNotBlank)
                        ?: payload.message?.takeIf(String::isNotBlank)
                        ?: "Payment method added"
                    Log.i(TAG, "payment method saved id=${payload.data?.id ?: "--"}")
                    _state.update { it.copy(saving = false, saved = true, successMessage = label) }
                    return@launch
                }
                // The route's REAL 400 text — surface it verbatim.
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Failed to save the payment method"
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

    /** The route's per-family validations (payment-methods/route.ts:47-69). */
    private fun validate(form: AddPaymentMethodForm): Map<String, String> {
        val errors = mutableMapOf<String, String>()
        if (form.family == AddPaymentMethodForm.FAMILY_WALLET) {
            if (form.walletLabel.isBlank()) errors["walletLabel"] = "A label is required (e.g. My bKash)"
            when {
                form.walletAccount.isBlank() ->
                    errors["walletAccount"] = "Enter a valid Bangladeshi mobile number (e.g. 01XXXXXXXXX)"
                !isValidBdMobile(form.walletAccount) ->
                    errors["walletAccount"] = "Enter a valid Bangladeshi mobile number (e.g. 01XXXXXXXXX)"
            }
        } else {
            if (form.cardNumber.length < 4) {
                errors["cardNumber"] = "Card must be tokenized — provide the last 4 digits only"
            }
            if (form.holderName.isBlank()) errors["holderName"] = "Cardholder name is required"
            if (form.expiry.isNotBlank() && !isValidExpiry(form.expiry)) {
                errors["expiry"] = "Expiry must be in MM/YY format"
            }
        }
        return errors
    }

    private companion object {
        const val TAG = "ZylodFinance"
        const val SERVER_ERROR_KEY = "_server"
    }
}
