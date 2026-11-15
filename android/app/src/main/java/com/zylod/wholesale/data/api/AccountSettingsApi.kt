package com.zylod.wholesale.data.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * t303 — the account-settings long-tail family (language, tax, linked
 * accounts, account deletion, push-channel preferences). Every contract is
 * lifted verbatim from the web routes; honesty rules live in the ViewModels.
 */
interface AccountSettingsApi {

    // ── GET/PATCH api/profile/language ─────────────────────────────────────
    @GET("api/profile/language")
    suspend fun language(): Response<LanguageEnvelope>

    @PATCH("api/profile/language")
    suspend fun updateLanguage(@Body body: LanguageUpdate): Response<LanguageEnvelope>

    // ── GET/PATCH api/profile/tax (501 for buyers — honest handling) ───────
    @GET("api/profile/tax")
    suspend fun tax(): Response<TaxEnvelope>

    @PATCH("api/profile/tax")
    suspend fun updateTax(@Body body: TaxUpdate): Response<TaxEnvelope>

    // ── GET/POST/DELETE api/profile/linked-accounts ────────────────────────
    @GET("api/profile/linked-accounts")
    suspend fun linkedAccounts(): Response<LinkedAccountsEnvelope>

    @POST("api/profile/linked-accounts")
    suspend fun addLinkedAccount(@Body body: LinkedAccountCreate): Response<LinkedAccountsEnvelope>

    @DELETE("api/profile/linked-accounts/{id}")
    suspend fun removeLinkedAccount(@Path("id") id: String): Response<LinkedAccountsEnvelope>

    // ── GET/PATCH api/notifications/preferences (per-channel prefs) ────────
    @GET("api/notifications/preferences")
    suspend fun pushPrefs(): Response<PushPrefsEnvelope>

    @PATCH("api/notifications/preferences")
    suspend fun updatePushPrefs(@Body body: PushPrefsUpdate): Response<PushPrefsEnvelope>

    // ── GET/DELETE api/profile/account ─────────────────────────────────────
    @GET("api/profile/account")
    suspend fun accountSummary(): Response<AccountSummaryEnvelope>

    @DELETE("api/profile/account")
    suspend fun deleteAccount(@Body body: AccountDeleteRequest): Response<MessageEnvelope>
}
