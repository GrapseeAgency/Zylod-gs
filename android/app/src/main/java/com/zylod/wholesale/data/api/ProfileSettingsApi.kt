package com.zylod.wholesale.data.api

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Part

/**
 * t280 — account settings family (the deferred typed ports).
 *
 * Verbatim server contracts (audited t280 4-c against the live routes):
 *  - GET  api/profile/settings        (settings/route.ts — composite read)
 *  - GET  api/profile/notifications   (notifications/route.ts — categories + prefs)
 *  - PATCH api/profile/notifications  (3 body shapes; this client sends the
 *                                      web account-settings + advanced shapes)
 *  - GET/PATCH api/profile/privacy    (userSettings upsert)
 *  - GET/PATCH api/profile/theme      (userSettings upsert)
 *  - POST api/profile/photo           (multipart, field "photo"; persists
 *                                      users.avatarUrl since t280)
 *  - POST api/auth/2fa/setup          (otpauth URI + secret)
 *  - POST api/auth/2fa/verify         (issues a real session on success)
 *  - GET/POST api/auth/backup-codes   (10 codes, shown once)
 */
interface ProfileSettingsApi {

    @GET("api/profile/settings")
    suspend fun settings(): Response<SettingsEnvelope>

    @GET("api/profile/notifications")
    suspend fun notificationPrefs(): Response<NotificationPrefsEnvelope>

    @PATCH("api/profile/notifications")
    suspend fun updateNotificationPrefs(@Body body: JsonElement): Response<MessageEnvelope>

    @GET("api/profile/privacy")
    suspend fun privacy(): Response<PrivacyEnvelope>

    @PATCH("api/profile/privacy")
    suspend fun updatePrivacy(@Body body: PrivacyUpdate): Response<PrivacyEnvelope>

    @GET("api/profile/theme")
    suspend fun theme(): Response<ThemeEnvelope>

    @PATCH("api/profile/theme")
    suspend fun updateTheme(@Body body: ThemeUpdate): Response<ThemeEnvelope>

    @Multipart
    @POST("api/profile/photo")
    suspend fun uploadPhoto(@Part photo: MultipartBody.Part): Response<PhotoUploadEnvelope>

    @POST("api/auth/2fa/setup")
    suspend fun twoFactorSetup(@Body body: TwoFactorSetupRequest): Response<TwoFactorSetupEnvelope>

    @POST("api/auth/2fa/verify")
    suspend fun twoFactorVerify(@Body body: TwoFactorVerifyRequest): Response<TwoFactorVerifyEnvelope>

    @GET("api/auth/backup-codes")
    suspend fun backupCodesRemaining(): Response<BackupRemainingEnvelope>

    @POST("api/auth/backup-codes")
    suspend fun generateBackupCodes(): Response<BackupCodesEnvelope>
}

// ─── GET api/profile/settings (settings/route.ts:34-60) ────────────────────

@Serializable
data class SettingsEnvelope(
    val success: Boolean = false,
    val data: SettingsData? = null,
    val error: String? = null,
)

@Serializable
data class SettingsData(
    val notifications: SettingsNotifications? = null,
    val privacy: SettingsPrivacy? = null,
    val twoFactorEnabled: Boolean = false,
    val linkedAccounts: List<LinkedAccountDto> = emptyList(),
)

@Serializable
data class SettingsNotifications(
    val email: Boolean = false,
    val push: Boolean = false,
    val sms: Boolean = false,
    val orderUpdates: Boolean = false,
    val priceAlerts: Boolean = false,
    val promotions: Boolean = false,
)

@Serializable
data class SettingsPrivacy(
    val profileVisible: Boolean = false,
    val showEmail: Boolean = false,
    val showPhone: Boolean = false,
)

@Serializable
data class LinkedAccountDto(
    val provider: String? = null,
    val handle: String? = null,
    val linkedAt: String? = null,
)

// ─── GET/PATCH api/profile/notifications (notifications/route.ts) ──────────

@Serializable
data class NotificationPrefsEnvelope(
    val success: Boolean = false,
    val data: List<NotificationCategoryDto> = emptyList(),
    val prefs: NotificationPrefsRow? = null,
    val error: String? = null,
)

@Serializable
data class NotificationCategoryDto(
    val title: String? = null,
    val description: String? = null,
    val items: List<NotificationPrefItem> = emptyList(),
)

@Serializable
data class NotificationPrefItem(
    val id: String? = null,
    val label: String? = null,
    val enabled: Boolean = false,
    val locked: Boolean = false,
)

/** The full notificationPreferences row (prefs object of the GET response). */
@Serializable
data class NotificationPrefsRow(
    val pushOrderUpdates: Boolean = false,
    val pushPromotions: Boolean = false,
    val pushPriceDrops: Boolean = false,
    val pushBackInStock: Boolean = false,
    val pushDelivery: Boolean = false,
    val pushChat: Boolean = false,
    val pushSystem: Boolean = false,
    val emailOrderUpdates: Boolean = false,
    val quietHoursEnabled: Boolean = false,
    val quietHoursStart: String? = null,
    val quietHoursEnd: String? = null,
)

/** Shared success-with-message envelope ({ success, message }). */
@Serializable
data class MessageEnvelope(
    val success: Boolean = false,
    val message: String? = null,
    val error: String? = null,
)

// ─── GET/PATCH api/profile/privacy (privacy/route.ts) ──────────────────────

@Serializable
data class PrivacyEnvelope(
    val success: Boolean = false,
    val data: PrivacyData? = null,
    val error: String? = null,
)

@Serializable
data class PrivacyData(
    val profileVisibility: String? = null,
    val showEmail: Boolean = false,
    val showPhone: Boolean = false,
    val configured: Boolean = false,
)

@Serializable
data class PrivacyUpdate(
    val profileVisibility: String? = null,
    val showEmail: Boolean? = null,
    val showPhone: Boolean? = null,
)

// ─── GET/PATCH api/profile/theme (theme/route.ts) ──────────────────────────

@Serializable
data class ThemeEnvelope(
    val success: Boolean = false,
    val data: ThemeData? = null,
    val error: String? = null,
)

@Serializable
data class ThemeData(
    val theme: String? = null,
    val configured: Boolean = false,
)

@Serializable
data class ThemeUpdate(val theme: String)

// ─── POST api/profile/photo (photo/route.ts) ───────────────────────────────

@Serializable
data class PhotoUploadEnvelope(
    val success: Boolean = false,
    val data: PhotoUploadData? = null,
    val error: String? = null,
)

@Serializable
data class PhotoUploadData(
    val url: String? = null,
    val avatarUrl: String? = null,
    val updatedAt: String? = null,
)

// ─── POST api/auth/2fa/setup + verify (2fa route family) ────────────────────
// (TwoFactorVerifyRequest + SuspensionDto live in AuthDtos.kt — shared with
//  the login-challenge flow; no duplicates here.)

@Serializable
data class TwoFactorSetupRequest(
    val userId: String,
    val method: String,
)

@Serializable
data class TwoFactorSetupEnvelope(
    val success: Boolean = false,
    val method: String? = null,
    val secret: String? = null,
    val otpauth: String? = null,
    val accountName: String? = null,
    val message: String? = null,
    val error: String? = null,
    /** sms only, non-production servers. */
    val debug: String? = null,
)

@Serializable
data class TwoFactorVerifyEnvelope(
    val success: Boolean = false,
    val message: String? = null,
    val token: String? = null,
    val user: TwoFactorUserDto? = null,
    val error: String? = null,
    /** 403 ACCOUNT_SUSPENDED carries the suspension block. */
    val code: String? = null,
    val accountStatus: String? = null,
    val suspension: SuspensionDto? = null,
)

@Serializable
data class TwoFactorUserDto(
    val id: String? = null,
    val userType: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val authProvider: String? = null,
    val accountStatus: String? = null,
    val isEmailVerified: Boolean = false,
    val isPhoneVerified: Boolean = false,
)

// ─── GET/POST api/auth/backup-codes (backup-codes/route.ts) ────────────────

@Serializable
data class BackupCodesEnvelope(
    val success: Boolean = false,
    val codes: List<String> = emptyList(),
    val message: String? = null,
    val error: String? = null,
)

@Serializable
data class BackupRemainingEnvelope(
    val success: Boolean = false,
    val remaining: Int = 0,
    val error: String? = null,
)
