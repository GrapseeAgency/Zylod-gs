package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.BankAccountCreateBody
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
 * Add-bank-account VM — POST api/bank-accounts (FinanceApi.createBankAccount,
 * bank-accounts/route.ts:40) as the payload of record for the native
 * add-bank-account pageId.
 *
 *  - FORM (route parity, field for field): bankName*, accountNumber*,
 *    accountHolderName* (the route's required trio — 400 "Bank name,
 *    account number, and holder name are required"), branchName +
 *    routingNumber optional, set-as-default switch (the server demotes the
 *    user's other bank rows when true).
 *  - ERRORS: the client guard mirrors the route's required trio first;
 *    then the route's REAL 400 text surfaces verbatim in the server error
 *    line. 401 → the honest sign-in gate.
 *  - GUARDS: the submit button is disabled while saving and the VM ignores
 *    submits while one is in flight or already saved (the route rate-limits
 *    at 10/min).
 *  - SUCCESS: the wire's real message ("Bank account added successfully")
 *    becomes the screen's snackbar; the screen then pops back and the
 *    bank-accounts list re-reads the fresh book on re-entry.
 */
data class AddBankAccountForm(
    val bankName: String = "",
    val accountNumber: String = "",
    val accountHolderName: String = "",
    val branchName: String = "",
    val routingNumber: String = "",
    val setAsDefault: Boolean = false,
)

data class AddBankAccountUiState(
    /** Signed out (no token) — the gate BEFORE the buyer types anything. */
    val needsAuth: Boolean = false,
    val form: AddBankAccountForm = AddBankAccountForm(),
    /** Field key → validation message; key "_server" → the server line. */
    val errors: Map<String, String> = emptyMap(),
    /** Submit in flight — the button is disabled (route rate limits). */
    val saving: Boolean = false,
    /** Real 200 → the screen shows the snackbar and pops back. */
    val saved: Boolean = false,
    /** The REAL server message on success ("Bank account added successfully"). */
    val successMessage: String = "",
) {
    /** The red server line above the form. */
    val serverError: String? get() = errors["_server"]
}

class AddBankAccountViewModel(
    private val appContext: Context,
) : ViewModel() {

    private val _state = MutableStateFlow(AddBankAccountUiState())
    val state: StateFlow<AddBankAccountUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var saveJob: Job? = null

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (AddAddressViewModel convention).
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

    /** One typed keystroke — clears that field's validation error. */
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
     * Validate → POST. Double-submit guard: ignored while a save is in
     * flight or already completed; the Save button is disabled meanwhile.
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
                Log.i(TAG, "create bank account ${form.bankName}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.financeApi(base).createBankAccount(
                    BankAccountCreateBody(
                        bankName = form.bankName.trim(),
                        accountNumber = form.accountNumber.trim(),
                        accountHolderName = form.accountHolderName.trim(),
                        branchName = form.branchName.trim().takeIf(String::isNotBlank),
                        routingNumber = form.routingNumber.trim().takeIf(String::isNotBlank),
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
                        ?: "Bank account added successfully"
                    Log.i(TAG, "bank account saved id=${payload.data?.id ?: "--"}")
                    _state.update { it.copy(saving = false, saved = true, successMessage = message) }
                    return@launch
                }
                // The route's REAL 400 text — surface it verbatim.
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Failed to add the bank account"
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

    /** The route's required trio (bank-accounts/route.ts:56) mirrored. */
    private fun validate(form: AddBankAccountForm): Map<String, String> {
        val errors = mutableMapOf<String, String>()
        if (form.bankName.isBlank()) errors["bankName"] = "Bank name is required"
        if (form.accountNumber.isBlank()) errors["accountNumber"] = "Account number is required"
        if (form.accountHolderName.isBlank()) errors["accountHolderName"] = "Account holder name is required"
        return errors
    }

    private fun updateField(form: AddBankAccountForm, key: String, value: String) = when (key) {
        "bankName" -> form.copy(bankName = value)
        "accountNumber" -> form.copy(accountNumber = value)
        "accountHolderName" -> form.copy(accountHolderName = value)
        "branchName" -> form.copy(branchName = value)
        "routingNumber" -> form.copy(routingNumber = value)
        else -> form
    }

    private companion object {
        const val TAG = "ZylodFinance"
        const val SERVER_ERROR_KEY = "_server"
    }
}
