package com.zylod.wholesale.ui.account

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.ZylodApp
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.ThemeUpdate
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * t280 — REAL account-settings (the web account-settings-page.tsx port).
 *
 * The Profile hub's "Account settings" row landed on a curated doc page while
 * the server exposes the full settings contract the web drives: the composite
 * GET /api/profile/settings (2FA state, privacy summary), GET/PATCH
 * /api/profile/notifications (the four account-level toggles + email digest),
 * PATCH /api/profile/privacy (directory visibility) and GET/PATCH
 * /api/profile/theme. None of it was reachable natively — a signed-in user
 * could not change notification, privacy or appearance preferences anywhere.
 *
 * Verbatim contracts (audited against the live routes, t280 4-c):
 *  - mount: Promise.all([GET settings, GET notifications]) parity — plus the
 *    theme GET for the "customized" badge (the web reads that on its separate
 *    theme page; one extra call is cheaper than a second screen);
 *  - save notifications: PATCH with the web's exact flat-group body
 *    (order/promotions/shipping);
 *  - save privacy: PATCH { profileVisibility: public|private };
 *  - appearance: applies LOCALLY first (ThemeController, instant) then PATCHes
 *    the server best-effort (cross-device sync).
 */
enum class AccountSettingsSection { SECURITY, NOTIFICATIONS, PRIVACY, APPEARANCE, DANGER }

data class AccountSettingsUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val error: String? = null,
    val section: AccountSettingsSection = AccountSettingsSection.SECURITY,
    // GET settings
    val twoFactorEnabled: Boolean = false,
    // Notifications form (web defaults → hydrated from prefs)
    val notifOrderPush: Boolean = true,
    val notifOrderEmail: Boolean = true,
    val notifOrderSms: Boolean = false,
    val notifShipPush: Boolean = true,
    val notifPricePush: Boolean = true,
    val notifPromoPush: Boolean = false,
    val savingNotifications: Boolean = false,
    val notifError: String? = null,
    /** Increments per successful save — the screen's toast trigger. */
    val savedNotificationsTick: Int = 0,
    // Privacy form
    val profilePublic: Boolean = true,
    val savingPrivacy: Boolean = false,
    val privacyError: String? = null,
    val savedPrivacyTick: Int = 0,
    // Appearance
    val themeMode: ThemeController.Mode = ThemeController.Mode.SYSTEM,
    val themeConfigured: Boolean = false,
    val savingTheme: Boolean = false,
    // Danger zone
    val signingOut: Boolean = false,
    /** Set when the local sign-out completed — the screen navigates to login. */
    val signedOutTick: Int = 0,
)

class AccountSettingsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(AccountSettingsUiState())
    val state: StateFlow<AccountSettingsUiState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        if (!_state.value.loading && _state.value.error == null) return
        _state.update { it.copy(loading = true, error = null, needsAuth = false) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val api = ApiClient.profileSettingsApi(base)
                coroutineScope {
                    // Promise.all parity (account-settings-page.tsx:204-207).
                    val settingsDeferred = async { runCatching { api.settings() } }
                    val notifDeferred = async { runCatching { api.notificationPrefs() } }
                    val themeDeferred = async { runCatching { api.theme() } }

                    val settingsRes = settingsDeferred.await().getOrNull()
                    if (settingsRes?.code() == 401) {
                        _state.update { it.copy(loading = false, needsAuth = true) }
                        return@coroutineScope
                    }
                    val notifRes = notifDeferred.await().getOrNull()
                    if (notifRes?.code() == 401) {
                        _state.update { it.copy(loading = false, needsAuth = true) }
                        return@coroutineScope
                    }
                    val themeRes = themeDeferred.await().getOrNull()

                    val settings = settingsRes?.body()?.takeIf { it.success }?.data
                    val prefs = notifRes?.body()?.takeIf { it.success }?.prefs
                    val themeData = themeRes?.body()?.takeIf { it.success }?.data

                    _state.update {
                        it.copy(
                            loading = false,
                            twoFactorEnabled = settings?.twoFactorEnabled ?: false,
                            profilePublic = settings?.privacy?.profileVisible ?: true,
                            // prefs hydration (:227-230 parity, ?? defaults)
                            notifOrderPush = prefs?.pushOrderUpdates ?: true,
                            notifPricePush = prefs?.pushPriceDrops ?: true,
                            notifShipPush = prefs?.pushDelivery ?: true,
                            notifPromoPush = prefs?.pushPromotions ?: false,
                            themeMode = ThemeController.fromWire(themeData?.theme),
                            themeConfigured = themeData?.configured ?: false,
                        )
                    }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Network error — tap retry") }
            }
        }
    }

    fun selectSection(section: AccountSettingsSection) =
        _state.update { it.copy(section = section) }

    fun setNotifOrderPush(v: Boolean) = _state.update { it.copy(notifOrderPush = v, notifError = null) }
    fun setNotifOrderEmail(v: Boolean) = _state.update { it.copy(notifOrderEmail = v, notifError = null) }
    fun setNotifShipPush(v: Boolean) = _state.update { it.copy(notifShipPush = v, notifError = null) }
    fun setNotifPricePush(v: Boolean) = _state.update { it.copy(notifPricePush = v, notifError = null) }

    /** PATCH api/profile/notifications — the web's exact body (:251-255). */
    fun saveNotifications() {
        val s = _state.value
        if (s.savingNotifications) return
        _state.update { it.copy(savingNotifications = true, notifError = null) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val body = buildJsonObject {
                    put(
                        "order",
                        buildJsonObject {
                            put("push", JsonPrimitive(s.notifOrderPush))
                            put("email", JsonPrimitive(s.notifOrderEmail))
                            put("sms", JsonPrimitive(s.notifOrderSms))
                        },
                    )
                    put(
                        "promotions",
                        buildJsonObject {
                            put("push", JsonPrimitive(s.notifPricePush))
                            put("email", JsonPrimitive(false))
                        },
                    )
                    put(
                        "shipping",
                        buildJsonObject {
                            put("push", JsonPrimitive(s.notifShipPush))
                            put("email", JsonPrimitive(true))
                            put("sms", JsonPrimitive(false))
                        },
                    )
                }
                val response = ApiClient.profileSettingsApi(base).updateNotificationPrefs(body)
                if (response.code() == 401) {
                    _state.update { it.copy(savingNotifications = false, needsAuth = true) }
                    return@launch
                }
                val ok = response.isSuccessful && response.body()?.success == true
                if (!ok) {
                    _state.update {
                        it.copy(
                            savingNotifications = false,
                            notifError = response.body()?.error
                                ?: "Saving notification preferences failed (HTTP ${response.code()}).",
                        )
                    }
                    return@launch
                }
                _state.update {
                    it.copy(savingNotifications = false, savedNotificationsTick = it.savedNotificationsTick + 1)
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                _state.update {
                    it.copy(
                        savingNotifications = false,
                        notifError = "Network error — please check your connection and try again.",
                    )
                }
            }
        }
    }

    fun setProfilePublic(v: Boolean) = _state.update { it.copy(profilePublic = v, privacyError = null) }

    /** PATCH api/profile/privacy — the web's exact body (:280-285). */
    fun savePrivacy() {
        val s = _state.value
        if (s.savingPrivacy) return
        _state.update { it.copy(savingPrivacy = true, privacyError = null) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.profileSettingsApi(base).updatePrivacy(
                    com.zylod.wholesale.data.api.PrivacyUpdate(
                        profileVisibility = if (s.profilePublic) "public" else "private",
                    ),
                )
                if (response.code() == 401) {
                    _state.update { it.copy(savingPrivacy = false, needsAuth = true) }
                    return@launch
                }
                val data = response.body()?.takeIf { it.success }?.data
                if (data == null) {
                    _state.update {
                        it.copy(
                            savingPrivacy = false,
                            privacyError = response.body()?.error
                                ?: "Saving your privacy settings failed (HTTP ${response.code()}).",
                        )
                    }
                    return@launch
                }
                _state.update {
                    it.copy(
                        savingPrivacy = false,
                        // Server-confirm-only (the web applies the response, never optimistic).
                        profilePublic = data.profileVisibility != "private",
                        savedPrivacyTick = it.savedPrivacyTick + 1,
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                _state.update {
                    it.copy(
                        savingPrivacy = false,
                        privacyError = "Network error while saving your privacy settings. Check your connection and retry.",
                    )
                }
            }
        }
    }

    /**
     * Appearance — applies LOCALLY first (instant, survives offline) then
     * PATCHes the server best-effort for cross-device sync. The web's own
     * account-settings Appearance section is local-only (next-themes); the
     * persistence contract lives on theme-settings — the native combines both
     * behaviors honestly.
     */
    fun applyTheme(mode: ThemeController.Mode) {
        val s = _state.value
        if (s.savingTheme) return
        ThemeController.apply(mode)
        _state.update { it.copy(themeMode = mode) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.profileSettingsApi(base)
                    .updateTheme(ThemeUpdate(theme = ThemeController.toWire(mode)))
                if (response.isSuccessful && response.body()?.success == true) {
                    _state.update { it.copy(themeConfigured = response.body()?.data?.configured ?: true) }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                // Best-effort server sync — the local choice is already live.
            }
        }
    }

    /** Danger zone — t277-1b parity: server logout best-effort, then local clear. */
    fun signOut() {
        if (_state.value.signingOut) return
        _state.update { it.copy(signingOut = true) }
        viewModelScope.launch {
            runCatching {
                val base = ServerConfig.cached(ZylodApp.instance)
                    ?: ServerConfig.resolve(ZylodApp.instance)
                ApiClient.authApi(base).logout()
            }
            SessionManager.clear()
            _state.update { it.copy(signingOut = false, signedOutTick = it.signedOutTick + 1) }
        }
    }
}
