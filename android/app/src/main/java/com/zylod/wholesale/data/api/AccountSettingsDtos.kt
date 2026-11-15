package com.zylod.wholesale.data.api

import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * t303 — the account-settings long-tail family the web serves as dedicated
 * pages and the t280 wave did not cover: language, tax, linked accounts,
 * account deletion and the push-channel notification preferences
 * (api/notifications/preferences — a DIFFERENT wire from the 14-category
 * api/profile/notifications the t280 screen already owns).
 *
 * Wire contracts are lifted verbatim from the routes:
 *  - GET/PATCH api/profile/language       (language/route.ts)
 *  - GET/PATCH api/profile/tax            (tax/route.ts — 501 for buyers!)
 *  - GET/POST/DELETE api/profile/linked-accounts[/:id] (linked-accounts/route.ts)
 *  - GET/DELETE api/profile/account       (account/route.ts — DELETE needs
 *      body { confirmation: "DELETE", reason } — a @Body on DELETE)
 *  - GET/PATCH api/notifications/preferences (notifications/preferences/route.ts
 *      — PATCH accepts a SINGLE-KEY partial body)
 */

// ─── GET/PATCH api/profile/language (language/route.ts) ────────────────────

@Serializable
data class LanguageEnvelope(
    val success: Boolean = false,
    val data: LanguageData? = null,
    val error: String? = null,
)

@Serializable
data class LanguageData(
    val language: String? = null,
    val configured: Boolean = false,
)

@Serializable
data class LanguageUpdate(val language: String)

// ─── GET/PATCH api/profile/tax (tax/route.ts) ──────────────────────────────

@Serializable
data class TaxEnvelope(
    val success: Boolean = false,
    val data: TaxData? = null,
    val error: String? = null,
)

@Serializable
data class TaxData(
    val taxId: String? = null,
    val vatNumber: String? = null,
    val businessEntityType: String? = null,
    /** Supplier rows carry real documents; buyers never do. */
    val documents: List<TaxDocument> = emptyList(),
)

@Serializable
data class TaxDocument(
    val id: String? = null,
    val name: String? = null,
    val date: String? = null,
)

@Serializable
data class TaxUpdate(
    val taxId: String? = null,
    val vatNumber: String? = null,
)

// ─── GET/POST/DELETE api/profile/linked-accounts ────────────────────────────

@Serializable
data class LinkedAccountsEnvelope(
    val success: Boolean = false,
    val data: LinkedAccountsData? = null,
    val error: String? = null,
)

@Serializable
data class LinkedAccountsData(
    val accounts: List<LinkedAccountRow> = emptyList(),
    val configured: Boolean = false,
)

@Serializable
data class LinkedAccountRow(
    val id: String,
    val provider: String,
    val handle: String,
    val linkedAt: String? = null,
)

@Serializable
data class LinkedAccountCreate(val provider: String, val handle: String)

// ─── GET/DELETE api/profile/account (account/route.ts) ─────────────────────

@Serializable
data class AccountSummaryEnvelope(
    val success: Boolean = false,
    val data: AccountSummaryData? = null,
    val error: String? = null,
)

@Serializable
data class AccountSummaryData(
    val ordersCount: Int? = null,
    val productsCount: Int? = null,
)

@Serializable
data class AccountDeleteRequest(
    val confirmation: String,
    val reason: String = "",
)

// ─── GET/PATCH api/notifications/preferences ────────────────────────────────

@Serializable
data class PushPrefsEnvelope(
    val success: Boolean = false,
    val data: PushPrefsData? = null,
    val error: String? = null,
)

/**
 * The route's DEFAULT_PREFERENCES shape verbatim (preferences/route.ts):
 * per-channel push/email booleans + sound + quiet hours + digest + mentions.
 * Nulls mean "unset on this account" — the UI renders the default, never a
 * fabricated toggle state.
 */
@Serializable
data class PushPrefsData(
    val pushOrderUpdates: Boolean = true,
    val pushPromotions: Boolean = false,
    val pushPriceDrops: Boolean = true,
    val pushBackInStock: Boolean = true,
    val pushDelivery: Boolean = true,
    val pushChat: Boolean = true,
    val pushSystem: Boolean = true,
    val emailOrderUpdates: Boolean = true,
    val emailPromotions: Boolean = false,
    val emailPriceDrops: Boolean = true,
    val emailBackInStock: Boolean = true,
    val emailDelivery: Boolean = true,
    val notificationSound: String = "default",
    val quietHoursEnabled: Boolean = false,
    val quietHoursStart: String? = null,
    val quietHoursEnd: String? = null,
    val digestEnabled: Boolean = false,
    val mentionNotify: Boolean = true,
)

@Serializable
data class PushPrefsUpdate(
    val pushOrderUpdates: Boolean? = null,
    val pushPromotions: Boolean? = null,
    val pushPriceDrops: Boolean? = null,
    val pushBackInStock: Boolean? = null,
    val pushDelivery: Boolean? = null,
    val pushChat: Boolean? = null,
    val pushSystem: Boolean? = null,
    val emailOrderUpdates: Boolean? = null,
    val emailPromotions: Boolean? = null,
    val emailPriceDrops: Boolean? = null,
    val emailBackInStock: Boolean? = null,
    val emailDelivery: Boolean? = null,
    val notificationSound: String? = null,
    val quietHoursEnabled: Boolean? = null,
    val quietHoursStart: String? = null,
    val quietHoursEnd: String? = null,
    val digestEnabled: Boolean? = null,
    val mentionNotify: Boolean? = null,
)

/**
 * t303 — single-key partial PATCH body factory (the route's PATCH validates
 * one preference per call, preferences/route.ts:72-75 whitelist). With the
 * app's explicitNulls=false Json config, only the non-null field rides the
 * wire — exactly the web's `JSON.stringify({ [key]: value })`.
 */
fun pushPrefsSingle(key: String, value: Boolean): PushPrefsUpdate = when (key) {
    "pushOrderUpdates" -> PushPrefsUpdate(pushOrderUpdates = value)
    "pushPromotions" -> PushPrefsUpdate(pushPromotions = value)
    "pushPriceDrops" -> PushPrefsUpdate(pushPriceDrops = value)
    "pushBackInStock" -> PushPrefsUpdate(pushBackInStock = value)
    "pushDelivery" -> PushPrefsUpdate(pushDelivery = value)
    "pushChat" -> PushPrefsUpdate(pushChat = value)
    "pushSystem" -> PushPrefsUpdate(pushSystem = value)
    "emailOrderUpdates" -> PushPrefsUpdate(emailOrderUpdates = value)
    "emailPromotions" -> PushPrefsUpdate(emailPromotions = value)
    "emailPriceDrops" -> PushPrefsUpdate(emailPriceDrops = value)
    "emailBackInStock" -> PushPrefsUpdate(emailBackInStock = value)
    "emailDelivery" -> PushPrefsUpdate(emailDelivery = value)
    "quietHoursEnabled" -> PushPrefsUpdate(quietHoursEnabled = value)
    "digestEnabled" -> PushPrefsUpdate(digestEnabled = value)
    "mentionNotify" -> PushPrefsUpdate(mentionNotify = value)
    else -> PushPrefsUpdate()
}
