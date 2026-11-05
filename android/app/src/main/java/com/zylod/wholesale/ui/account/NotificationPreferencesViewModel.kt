package com.zylod.wholesale.ui.account

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.NotificationPrefsRow
import com.zylod.wholesale.data.api.ServerConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * t280 — advanced notification preferences (notification-preferences-page
 * port). The Notifications screen's "Preferences" chip landed on a curated
 * essay; the server contract is real: GET api/profile/notifications (prefs
 * row) + PATCH with the categories/quietHours body.
 *
 * Honesty rules (web parity, notification-preferences-page:69-74):
 *  - only SIX category ids persist (order_updates, shipping_logistics,
 *    payment_finance, price_alerts, promotions, security_alerts — the route's
 *    known map); every other category renders the "not saved on your account
 *    yet" marker so a toggle never pretends to persist;
 *  - the server silently drops the WhatsApp channel value — the switch is
 *    not rendered at all instead of faking a dead control;
 *  - restore maps the prefs row onto exactly the six persisted categories
 *    (web :399-417 mapping verbatim).
 */
data class NotifCategory(
    val id: String,
    val label: String,
    val description: String,
    val push: Boolean,
    val email: Boolean,
    val sms: Boolean,
    /** True for the six ids the server actually persists. */
    val persisted: Boolean,
)

data class NotificationPreferencesUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val error: String? = null,
    val categories: List<NotifCategory> = defaultCategories(),
    val quietHoursEnabled: Boolean = false,
    val quietStart: String = "22:00",
    val quietEnd: String = "07:00",
    val saving: Boolean = false,
    val saveError: String? = null,
    val savedTick: Int = 0,
) {
    companion object {
        fun defaultCategories(): List<NotifCategory> = listOf(
            NotifCategory("order_updates", "Order Status & Updates", "Confirmations, processing, dispatched, and delivery milestones.", push = true, email = true, sms = false, persisted = true),
            NotifCategory("shipping_logistics", "Freight & Shipment Tracking", "Live GPS updates, ETA changes, customs clearance, and delivery confirmation.", push = true, email = true, sms = true, persisted = true),
            NotifCategory("payment_finance", "Payments & Financial Events", "Payment verification updates, order status changes, and payment receipts.", push = true, email = true, sms = false, persisted = true),
            NotifCategory("price_alerts", "Price Drop & Restock Alerts", "Notify when a watched product drops in price or comes back in stock.", push = true, email = false, sms = false, persisted = true),
            NotifCategory("rfq_quotes", "RFQ & Quote Activity", "New quote responses from suppliers, counter-offers, and quote expiry warnings.", push = true, email = true, sms = false, persisted = false),
            NotifCategory("promotions", "Promotions & Flash Sales", "Flash sale windows, coupon drops, and seasonal campaign announcements.", push = false, email = true, sms = false, persisted = true),
            NotifCategory("reviews_feedback", "Reviews & Buyer Feedback", "Responses to your reviews and supplier feedback requests.", push = true, email = true, sms = false, persisted = false),
            NotifCategory("kyc_verification", "KYC & Account Verification", "Identity document review outcomes and re-verification requests.", push = true, email = true, sms = true, persisted = false),
            NotifCategory("dispute_escrow", "Support & Dispute Updates", "Complaint threads, escrow decisions, and resolution milestones.", push = true, email = true, sms = true, persisted = false),
            NotifCategory("inventory_alerts", "Inventory & Stock Warnings", "Low-stock and out-of-stock warnings on products you follow.", push = true, email = false, sms = false, persisted = false),
            NotifCategory("freight_milestones", "Freight Milestone Alerts", "Departure, port arrival, and final-mile delivery milestones.", push = true, email = true, sms = false, persisted = false),
            NotifCategory("security_alerts", "Security & Account Safety", "Sign-in alerts, password changes, and 2FA events.", push = true, email = true, sms = true, persisted = true),
            NotifCategory("analytics_reports", "Analytics & Weekly Reports", "Weekly storefront performance digests.", push = false, email = true, sms = false, persisted = false),
            NotifCategory("platform_updates", "Platform & System Updates", "Maintenance windows and marketplace policy changes.", push = false, email = true, sms = false, persisted = false),
        )
    }
}

class NotificationPreferencesViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(NotificationPreferencesUiState())
    val state: StateFlow<NotificationPreferencesUiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        if (!_state.value.loading && _state.value.error == null) return
        _state.update { it.copy(loading = true, error = null, needsAuth = false) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.profileSettingsApi(base).notificationPrefs()
                if (response.code() == 401) {
                    _state.update { it.copy(loading = false, needsAuth = true) }
                    return@launch
                }
                val prefs = response.body()?.takeIf { it.success }?.prefs
                if (!response.isSuccessful || prefs == null) {
                    _state.update { it.copy(loading = false, error = "Could not load your saved notification settings (HTTP ${response.code()})") }
                    return@launch
                }
                val (cats, quiet) = restored(prefs)
                _state.update {
                    it.copy(
                        loading = false,
                        categories = cats,
                        quietHoursEnabled = quiet.enabled,
                        quietStart = quiet.start,
                        quietEnd = quiet.end,
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Network error — tap retry") }
            }
        }
    }

    /** Web :399-417 mapping — only the six persisted categories adopt saved values. */
    private fun restored(prefs: NotificationPrefsRow): Pair<List<NotifCategory>, QuietHours> {
        val savedPush = mapOf(
            "order_updates" to prefs.pushOrderUpdates,
            "shipping_logistics" to prefs.pushDelivery,
            "payment_finance" to prefs.pushChat,
            "price_alerts" to prefs.pushPriceDrops,
            "promotions" to prefs.pushPromotions,
            "security_alerts" to prefs.pushSystem,
        )
        val cats = _state.value.categories.map { cat ->
            if (cat.persisted) cat.copy(push = savedPush[cat.id] ?: cat.push) else cat
        }
        val quiet = QuietHours(
            enabled = prefs.quietHoursEnabled,
            start = prefs.quietHoursStart?.takeIf { it.isNotBlank() } ?: "22:00",
            end = prefs.quietHoursEnd?.takeIf { it.isNotBlank() } ?: "07:00",
        )
        return cats to quiet
    }

    private data class QuietHours(val enabled: Boolean, val start: String, val end: String)

    fun setPush(categoryId: String, value: Boolean) = _state.update { s ->
        s.copy(categories = s.categories.map { if (it.id == categoryId) it.copy(push = value) else it }, saveError = null)
    }

    fun setEmail(categoryId: String, value: Boolean) = _state.update { s ->
        s.copy(categories = s.categories.map { if (it.id == categoryId) it.copy(email = value) else it }, saveError = null)
    }

    fun setSms(categoryId: String, value: Boolean) = _state.update { s ->
        s.copy(categories = s.categories.map { if (it.id == categoryId) it.copy(sms = value) else it }, saveError = null)
    }

    fun setQuietHoursEnabled(value: Boolean) = _state.update { it.copy(quietHoursEnabled = value, saveError = null) }
    fun setQuietStart(value: String) = _state.update { it.copy(quietStart = value.trim(), saveError = null) }
    fun setQuietEnd(value: String) = _state.update { it.copy(quietEnd = value.trim(), saveError = null) }

    fun muteAll(mute: Boolean) = _state.update { s ->
        s.copy(categories = s.categories.map { it.copy(push = !mute) })
    }

    /** PATCH — the web's exact payload (notification-preferences-page:466-491). */
    fun save() {
        val s = _state.value
        if (s.saving) return
        val timeRegex = Regex("^([01]?\\d|2[0-3]):[0-5]\\d$")
        if (s.quietHoursEnabled && (!timeRegex.matches(s.quietStart) || !timeRegex.matches(s.quietEnd))) {
            _state.update { it.copy(saveError = "Quiet hours must be HH:MM times (e.g. 22:00)") }
            return
        }
        _state.update { it.copy(saving = true, saveError = null) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val body = buildJsonObject {
                    put(
                        "categories",
                        buildJsonObject {
                            s.categories.forEach { cat ->
                                put(
                                    cat.id,
                                    buildJsonObject {
                                        put("push", JsonPrimitive(cat.push))
                                        put("email", JsonPrimitive(cat.email))
                                        put("sms", JsonPrimitive(cat.sms))
                                        put("whatsapp", JsonPrimitive(false))
                                    },
                                )
                            }
                        },
                    )
                    put(
                        "quietHours",
                        buildJsonObject {
                            put("enabled", JsonPrimitive(s.quietHoursEnabled))
                            put("start", JsonPrimitive(s.quietStart))
                            put("end", JsonPrimitive(s.quietEnd))
                        },
                    )
                }
                val response = ApiClient.profileSettingsApi(base).updateNotificationPrefs(body)
                if (response.code() == 401) {
                    _state.update { it.copy(saving = false, needsAuth = true) }
                    return@launch
                }
                if (!response.isSuccessful || response.body()?.success != true) {
                    _state.update {
                        it.copy(
                            saving = false,
                            saveError = response.body()?.error
                                ?: "Saving failed — your changes were NOT saved. Please try again.",
                        )
                    }
                    return@launch
                }
                _state.update { it.copy(saving = false, savedTick = it.savedTick + 1) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                _state.update {
                    it.copy(saving = false, saveError = "Network error — your changes were NOT saved. Please try again.")
                }
            }
        }
    }
}
