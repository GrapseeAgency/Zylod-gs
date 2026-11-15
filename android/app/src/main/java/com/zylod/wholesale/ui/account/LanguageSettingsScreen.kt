package com.zylod.wholesale.ui.account

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
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
import com.zylod.wholesale.data.api.LanguageUpdate
import com.zylod.wholesale.data.api.ServerConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t303 — Language & Currency (language-settings-page.tsx port, real wire):
 * GET/PATCH api/profile/language — 'bn' | 'en' are the ONLY backend-backed
 * languages (web honesty note verbatim: es/fr/ar were never persisted
 * anywhere, so they are not offered at all). No optimistic writes — the
 * selection PATCHes first and applies on 2xx. Currency is a real
 * DEVICE-LOCAL preference (zylod_config), labelled truthfully like the web.
 */
data class LanguageOption(
    val id: String,
    val name: String,
    val nativeName: String,
    val region: String,
)

data class CurrencyOption(val code: String, val symbol: String, val label: String)

data class LanguageSettingsUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val loadError: String? = null,
    val selectedLang: String = "bn",
    val configured: Boolean = false,
    val savingLang: String? = null,
    val saveError: String? = null,
)

class LanguageSettingsViewModel(private val appContext: Context) : ViewModel() {

    val languages = listOf(
        LanguageOption("bn", "Bengali", "বাংলা", "বাংলাদেশ (National)"),
        LanguageOption("en", "English (US)", "English", "Global B2B Standard"),
    )

    val currencies = listOf(
        CurrencyOption("BDT", "৳", "Bangladeshi Taka (BDT)"),
        CurrencyOption("USD", "$", "United States Dollar (USD)"),
        CurrencyOption("EUR", "€", "Euro (EUR)"),
        CurrencyOption("GBP", "£", "British Pound (GBP)"),
        CurrencyOption("AED", "د.إ", "UAE Dirham (AED)"),
    )

    /** Device-local currency preference (web: zustand persist, this device only). */
    private val _currency = MutableStateFlow(currencyStored())
    val currency: StateFlow<String> = _currency.asStateFlow()

    private val _state = MutableStateFlow(LanguageSettingsUiState())
    val state: StateFlow<LanguageSettingsUiState> = _state.asStateFlow()

    init { refresh() }

    private fun currencyStored(): String =
        runCatching {
            appContext.getSharedPreferences("zylod_config", android.content.Context.MODE_PRIVATE)
                .getString("catalog_currency", null)
        }.getOrNull()?.takeIf { it.isNotBlank() } ?: "BDT"

    fun setCurrency(code: String) {
        _currency.value = code
        runCatching {
            appContext.getSharedPreferences("zylod_config", android.content.Context.MODE_PRIVATE)
                .edit().putString("catalog_currency", code).apply()
        }
    }

    fun refresh() {
        _state.update { it.copy(loading = true, loadError = null, needsAuth = false) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.accountSettingsApi(base).language()
                if (response.code() == 401 || response.code() == 403) {
                    _state.update { it.copy(loading = false, needsAuth = true) }
                    return@launch
                }
                if (!response.isSuccessful) {
                    _state.update {
                        it.copy(loading = false, loadError = "Failed to load your saved language (HTTP ${response.code()}).")
                    }
                    return@launch
                }
                val body = response.body()
                if (body?.success != true) {
                    _state.update { it.copy(loading = false, loadError = body?.error ?: "Failed to load your saved language.") }
                    return@launch
                }
                val lang = if (body.data?.language == "en") "en" else "bn"
                _state.update {
                    it.copy(loading = false, selectedLang = lang, configured = body.data?.configured == true)
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, loadError = "Network error while loading your saved language. Check your connection and retry.") }
            }
        }
    }

    fun selectLanguage(lang: String) {
        if (_state.value.savingLang != null) return
        _state.update { it.copy(saveError = null, savingLang = lang) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.accountSettingsApi(base).updateLanguage(LanguageUpdate(lang))
                if (response.code() == 401 || response.code() == 403) {
                    _state.update {
                        it.copy(savingLang = null, needsAuth = true, saveError = "Your session ended — sign in to save your language.")
                    }
                    return@launch
                }
                if (!response.isSuccessful) {
                    _state.update {
                        it.copy(savingLang = null, saveError = "Saving your language failed (HTTP ${response.code()}).")
                    }
                    return@launch
                }
                val body = response.body()
                if (body?.success != true) {
                    _state.update { it.copy(savingLang = null, saveError = body?.error ?: "Saving your language failed.") }
                    return@launch
                }
                val confirmed = if (body.data?.language == "en") "en" else "bn"
                _state.update { it.copy(savingLang = null, selectedLang = confirmed, configured = true) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(savingLang = null, saveError = "Network error while saving your language. Check your connection and retry.") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LanguageSettingsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: LanguageSettingsViewModel = viewModel(key = "native-language-settings") {
        LanguageSettingsViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    val currency by vm.currency.collectAsState()

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Language & Currency", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
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
                Text("Sign in to manage your saved language", fontSize = 14.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(6.dp))
                Text("Language preferences are stored on your account.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(14.dp))
                OutlinedButton(onClick = { openPage("login", "") }) { Text("Sign in", fontWeight = FontWeight.Bold) }
            }
            state.loading -> AccountSettingsWall(padding) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("Loading your saved language…", fontSize = 12.sp)
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
                Text(
                    "Your interface language is saved to your account the moment you tap it.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                AccountSettingsSection("Interface Language") {
                    Text(
                        if (state.configured) "Customized for your account" else "Platform default — not customized yet",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                    for (lang in vm.languages) {
                        val selected = state.selectedLang == lang.id
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .border(
                                    1.dp,
                                    if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                                    RoundedCornerShape(16.dp),
                                )
                                .clickable(enabled = state.savingLang == null && !selected) { vm.selectLanguage(lang.id) }
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Column {
                                Text(
                                    "${lang.nativeName} (${lang.name})",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                                )
                                Text(lang.region, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Box(Modifier.size(24.dp), contentAlignment = Alignment.Center) {
                                if (state.savingLang == lang.id) {
                                    CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                                } else if (selected) {
                                    Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.primary) {
                                        Icon(Icons.Outlined.Check, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.padding(3.dp).size(14.dp))
                                    }
                                }
                            }
                        }
                    }
                    if (state.saveError != null) {
                        Text(state.saveError ?: "", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                    }
                    Text(
                        "Spanish, French, and Arabic were listed before but were never actually supported — they are not implemented yet and require backend support before they can be selected.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                AccountSettingsSection("Wholesale Catalog Currency") {
                    val grid = vm.currencies
                    for (row in grid.chunked(2)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            for (c in row) {
                                val selected = currency == c.code
                                Surface(
                                    shape = RoundedCornerShape(16.dp),
                                    color = if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.08f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                                    border = androidx.compose.foundation.BorderStroke(
                                        1.dp,
                                        if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                                    ),
                                    modifier = Modifier
                                        .weight(1f)
                                        .clickable { vm.setCurrency(c.code) },
                                ) {
                                    Column(Modifier.padding(12.dp)) {
                                        Text(c.symbol, fontSize = 14.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary)
                                        Text(
                                            c.code,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                                        )
                                    }
                                }
                            }
                            if (row.size == 1) Spacer(Modifier.weight(1f))
                        }
                        Spacer(Modifier.height(8.dp))
                    }
                    Text(
                        "Currency is stored on this device only (it is not part of your account settings).",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
