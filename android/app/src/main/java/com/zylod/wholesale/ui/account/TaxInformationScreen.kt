package com.zylod.wholesale.ui.account

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.TaxDocument
import com.zylod.wholesale.data.api.TaxUpdate
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t303 — Tax Information (tax-information-page.tsx port, real wire):
 * GET/PATCH api/profile/tax. Honesty contract from the web page verbatim:
 *  - the tax profile is the SIGNED-IN account's real credentials — guests get
 *    the account gate, never an editable-looking empty form;
 *  - the server returns taxId "Not Set" / vatNumber "N/A" sentinels — the
 *    form shows empty fields for those, never the sentinel text;
 *  - PATCH for BUYERS honestly returns 501 (no buyer tax storage) — the
 *    screen surfaces that as "not implemented yet", not a fake success;
 *  - supplier documents list renders when the account has rows.
 */
data class TaxInformationUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val loadError: String? = null,
    val taxId: String = "",
    val vatNumber: String = "",
    val businessEntityType: String = "",
    val documents: List<TaxDocument> = emptyList(),
    val saving: Boolean = false,
    val saveError: String? = null,
    val notSupported: Boolean = false,
    val savedTick: Int = 0,
)

class TaxInformationViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(TaxInformationUiState())
    val state: StateFlow<TaxInformationUiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        _state.update { it.copy(loading = true, loadError = null, needsAuth = false) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.accountSettingsApi(base).tax()
                if (response.code() == 401 || response.code() == 403) {
                    _state.update { it.copy(loading = false, needsAuth = true) }
                    return@launch
                }
                if (!response.isSuccessful) {
                    _state.update {
                        it.copy(loading = false, loadError = "Could not load your saved tax information (HTTP ${response.code()}).")
                    }
                    return@launch
                }
                val d = response.body()?.data
                _state.update {
                    it.copy(
                        loading = false,
                        taxId = d?.taxId?.takeUnless { t -> t == "Not Set" } ?: "",
                        vatNumber = d?.vatNumber?.takeUnless { v -> v == "N/A" } ?: "",
                        businessEntityType = d?.businessEntityType ?: "",
                        documents = d?.documents ?: emptyList(),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, loadError = "Network error while loading your tax information. Check your connection and retry.") }
            }
        }
    }

    fun save(taxId: String, vatNumber: String) {
        if (_state.value.saving) return
        val body = TaxUpdate(
            taxId = taxId.trim().takeIf { it.isNotEmpty() },
            vatNumber = vatNumber.trim().takeIf { it.isNotEmpty() },
        )
        if (body.taxId == null && body.vatNumber == null) {
            _state.update { it.copy(saveError = "Enter a tax ID or VAT number to save.") }
            return
        }
        _state.update { it.copy(saveError = null, notSupported = false, saving = true) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.accountSettingsApi(base).updateTax(body)
                if (response.code() == 401 || response.code() == 403) {
                    _state.update { it.copy(saving = false, needsAuth = true) }
                    return@launch
                }
                // Real contract: buyers honestly get 501 (no buyer tax storage).
                if (response.code() == 501) {
                    _state.update {
                        it.copy(
                            saving = false,
                            notSupported = true,
                            saveError = response.body()?.error ?: "Not implemented yet — requires backend support",
                        )
                    }
                    return@launch
                }
                if (!response.isSuccessful) {
                    _state.update { it.copy(saving = false, saveError = "Saving your tax information failed (HTTP ${response.code()}).") }
                    return@launch
                }
                val d = response.body()?.data
                _state.update {
                    it.copy(
                        saving = false,
                        savedTick = it.savedTick + 1,
                        taxId = d?.taxId ?: taxId.trim(),
                        vatNumber = d?.vatNumber ?: vatNumber.trim(),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(saving = false, saveError = "Network error while saving your tax information. Check your connection and retry.") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaxInformationScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: TaxInformationViewModel = viewModel(key = "native-tax-information") {
        TaxInformationViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    var taxId by remember { mutableStateOf("") }
    var vatNumber by remember { mutableStateOf("") }
    // Adopt server state into the fields when a load/save completes.
    LaunchedEffect(state.taxId, state.vatNumber) {
        taxId = state.taxId
        vatNumber = state.vatNumber
    }
    var lastToasted by remember { mutableIntStateOf(0) }
    LaunchedEffect(state.savedTick) {
        if (state.savedTick > lastToasted) {
            lastToasted = state.savedTick
            delay(2200)
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Tax Information", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        when {
            state.needsAuth -> AccountSettingsWall(padding) {
                AccountSignInGate(
                    title = "Sign in to manage your tax information",
                    message = "Your tax profile is the signed-in account's real credentials.",
                    onSignIn = { openPage("login", "") },
                )
            }
            state.loading -> AccountSettingsWall(padding) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("Loading your tax information…", fontSize = 12.sp)
            }
            state.loadError != null -> AccountSettingsWall(padding) {
                Text(state.loadError ?: "", fontSize = 13.sp, color = MaterialTheme.colorScheme.error)
                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = { vm.refresh() }) { Text("Retry", fontWeight = FontWeight.Bold) }
            }
            else -> Column(
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                AccountSettingsSection("Business Tax Identifiers") {
                    if (state.businessEntityType.isNotBlank()) {
                        Text(
                            "Entity: ${state.businessEntityType}",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(bottom = 8.dp),
                        )
                    }
                    OutlinedTextField(
                        value = taxId,
                        onValueChange = { taxId = it },
                        label = { Text("Tax ID (TIN)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                    )
                    OutlinedTextField(
                        value = vatNumber,
                        onValueChange = { vatNumber = it },
                        label = { Text("VAT Number") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                    )
                    Button(
                        onClick = { vm.save(taxId, vatNumber) },
                        enabled = !state.saving,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        if (state.saving) {
                            CircularProgressIndicator(Modifier.height(16.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                            Spacer(Modifier.height(0.dp))
                            Text("  Saving…", fontSize = 12.sp)
                        } else {
                            Text("Save tax information", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    if (state.saveError != null) {
                        Spacer(Modifier.height(8.dp))
                        Text(state.saveError ?: "", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                    }
                    Text(
                        "Tax identifiers persist for supplier accounts. Buyer accounts have no tax storage yet — saving honestly reports that instead of pretending.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
                if (state.documents.isNotEmpty()) {
                    AccountSettingsSection("Submitted Documents") {
                        for (doc in state.documents) {
                            Text(
                                listOfNotNull(doc.name, doc.date).joinToString(" · "),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 4.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}
