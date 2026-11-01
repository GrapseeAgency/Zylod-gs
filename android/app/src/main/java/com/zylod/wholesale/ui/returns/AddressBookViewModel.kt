package com.zylod.wholesale.ui.returns

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.AddressDto
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer

/**
 * Address-book VM — GET api/addresses (AddressesApi.list, the exact
 * endpoint shipping-address-page.tsx:47 fetches — the web maps the
 * address-book pageId to that component, src/lib/page-chunks/chunk-misc.ts)
 * as the payload of record for the native address-book pageId.
 *
 *  - AUTH: no token → no call at all, the honest sign-in gate (the web
 *    t216 honesty fix: a guest's 401 must NEVER render as "empty address
 *    book"). A 401 on the fetch means a real end of session (the shared
 *    OkHttp authenticator has already attempted one token refresh by then)
 *    → needsAuth.
 *  - SELECTION (web parity): the default address pre-selects, else the
 *    first row, else nothing — a radio circle on each card and the bottom
 *    "Shipping to:" line follow it. Rows come ordered isDefault DESC,
 *    label ASC straight from the server.
 *  - FAILURE: honest error card + Retry when nothing renderable; the last
 *    saved snapshot (SharedPreferences "zylod_config",
 *    "native_addresses_cache") renders with the offline banner otherwise.
 *
 * CARD CONTENT is the web page's exact projection (its ShippingAddress
 * interface): label (|| 'Address'), Default badge on isDefault, the bold
 * company line, "Attn: contactName", streetLine1, the district line, the
 * "city, country" line and the phone row. The web page has NO delete
 * affordance (deleting lives on the separate edit-address page) and no
 * postalCode line — none is invented here.
 */
data class AddressRow(
    /** Stable LazyColumn key (address id, hash fallback). */
    val key: String,
    /** The REAL address id — the edit affordance hands it to the editor. */
    val id: String,
    /** label || 'Address' (web fallback chain). */
    val label: String,
    /** isDefault → the "Default" badge. */
    val isDefault: Boolean,
    val companyName: String,
    /** Null → the "Attn:" line drops. */
    val contactName: String?,
    val streetLine1: String,
    /** The web `area` — district on the wire; null → the line drops. */
    val area: String?,
    val city: String,
    /** country || 'Bangladesh' (web fallback). */
    val country: String,
    /** Null → the phone row drops. */
    val phone: String?,
)

data class AddressBookUiState(
    /** Resolving / fetching the book (skeleton cards while empty). */
    val loading: Boolean = true,
    val addresses: List<AddressRow> = emptyList(),
    /** Radio selection — default row first, else first row (web parity). */
    val selectedId: String = "",
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible book came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
) {
    /** The web "Shipping to:" line — null when nothing is selected. */
    val selected: AddressRow?
        get() = addresses.firstOrNull { it.id == selectedId }
}

class AddressBookViewModel(
    private val appContext: Context,
) : ViewModel() {

    private val _state = MutableStateFlow(AddressBookUiState())
    val state: StateFlow<AddressBookUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (TrackOrderViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(
                        loading = false,
                        needsAuth = true,
                    )
                }
            }
        }
    }

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load() {
        if (initJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = AddressBookUiState(loading = false, needsAuth = true)
            return
        }
        initJob?.cancel()
        _state.update {
            it.copy(
                loading = it.addresses.isEmpty(),
                error = null,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        initJob = viewModelScope.launch { fetchAddresses() }
    }

    /** Radio-circle tap (web setSelected). */
    fun select(addressId: String) {
        _state.update { it.copy(selectedId = addressId) }
    }

    private suspend fun fetchAddresses() {
        try {
            Log.i(TAG, "fetch addresses")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.addressesApi(base).list()
            if (gateOn401(response.code())) return
            val payload = response.body()
            val rows = payload?.data
                ?.takeIf { response.isSuccessful && it.success }
                ?.map { it.toRow() }
                .orEmpty()
            if (!response.isSuccessful || payload?.success != true) {
                // The web page logs the failure and honestly refuses to
                // render a fake empty book (t216 fix) — same here, with the
                // saved snapshot as the degrade path.
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your addresses (HTTP ${response.code()})."
                Log.w(TAG, "addresses error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "addresses loaded rows=${rows.size}")
            _state.value = AddressBookUiState(
                loading = false,
                addresses = rows,
                selectedId = defaultSelection(rows),
            )
            persistCache(payload?.data.orEmpty())
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "addresses fetch failed: ${e.message}")
            degrade("Network error while loading your addresses. Check your connection and retry.")
        }
    }

    private fun gateOn401(code: Int): Boolean {
        if (code != 401) return false
        Log.i(TAG, "not permitted (http=401) — session ended")
        _state.value = _state.value.copy(loading = false, needsAuth = true)
        return true
    }

    /**
     * Failure path: keep renderable data (banner state) — the saved book
     * cache; with none, the honest error card. Mapped on the MAIN thread
     * after the IO cache read (RfqModels convention).
     */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            AddressCacheStore.read(appContext, AddressCacheKeys.BOOK, CachedAddressBook.serializer())
        }
        val rows = cached?.rows.orEmpty().map { it.toRow() }
        if (rows.isNotEmpty()) {
            Log.i(TAG, "degrade → cache rows=${rows.size}")
            _state.value = AddressBookUiState(
                loading = false,
                addresses = rows,
                selectedId = defaultSelection(rows),
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the book's wire DTOs — the offline render matches the live one. */
    private fun persistCache(rows: List<AddressDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            AddressCacheStore.write(
                appContext,
                AddressCacheKeys.BOOK,
                CachedAddressBook.serializer(),
                CachedAddressBook(rows = rows),
            )
        }
    }

    /** The web selection seed: default row, else the first row, else none. */
    private fun defaultSelection(rows: List<AddressRow>): String =
        rows.firstOrNull { it.isDefault }?.id ?: rows.firstOrNull()?.id.orEmpty()

    private companion object {
        const val TAG = "ZylodAddresses"
    }
}

/** Wire row → render row (the web page's exact projection + fallbacks). */
private fun AddressDto.toRow() = AddressRow(
    key = stableKey,
    id = id?.takeIf(String::isNotBlank) ?: stableKey,
    label = label?.takeIf(String::isNotBlank) ?: "Address",
    isDefault = isDefault,
    companyName = companyName.orEmpty(),
    contactName = contactName?.takeIf(String::isNotBlank),
    streetLine1 = addressLine1.orEmpty(),
    area = district?.takeIf(String::isNotBlank),
    city = city.orEmpty(),
    country = country?.takeIf(String::isNotBlank) ?: "Bangladesh",
    phone = contactPhone?.takeIf(String::isNotBlank),
)

/* ─── offline cache (t252 LogisticsCacheStore convention) ────────────────── */

/** The device-saved address-book key — SharedPreferences "zylod_config". */
internal object AddressCacheKeys {
    const val PREFS = "zylod_config"
    const val BOOK = "native_addresses_cache"
}

/** Address-book snapshot (the raw wire DTOs — offline render matches live). */
@kotlinx.serialization.Serializable
data class CachedAddressBook(val rows: List<AddressDto> = emptyList())

/**
 * On-device saved payloads — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the [AddressCacheKeys] keys.
 */
internal object AddressCacheStore {
    private const val TAG = "ZylodAddresses"

    fun <T> read(context: Context, key: String, serializer: KSerializer<T>): T? = runCatching {
        val raw = context.getSharedPreferences(AddressCacheKeys.PREFS, Context.MODE_PRIVATE)
            .getString(key, null) ?: return null
        ApiClient.json.decodeFromString(serializer, raw)
    }.onFailure { Log.w(TAG, "address cache read failed: ${it.message}") }.getOrNull()

    fun <T> write(context: Context, key: String, serializer: KSerializer<T>, value: T) {
        runCatching {
            val raw = ApiClient.json.encodeToString(serializer, value)
            context.getSharedPreferences(AddressCacheKeys.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(key, raw)
                .apply()
        }.onFailure { Log.w(TAG, "address cache write failed: ${it.message}") }
    }
}
