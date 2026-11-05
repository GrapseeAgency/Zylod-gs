package com.zylod.wholesale.data.api

import kotlinx.serialization.json.JsonElement
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Query

/**
 * Auth endpoints used by the Phase 1 native screens. All calls return
 * retrofit2.Response so screens can read the HTTP status + parse the error
 * body (login/2FA/registration branches carry different payloads per status).
 */
interface AuthApi {
    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): Response<LoginResponse>

    @POST("api/auth/register")
    suspend fun register(@Body body: RegisterRequest): Response<RegisterResponse>

    @POST("api/auth/otp/send")
    suspend fun otpSend(@Body body: OtpSendRequest): Response<OtpSendResponse>

    @POST("api/auth/otp/verify")
    suspend fun otpVerify(@Body body: OtpVerifyRequest): Response<OtpVerifyResponse>

    @POST("api/auth/2fa/verify")
    suspend fun twoFactorVerify(@Body body: TwoFactorVerifyRequest): Response<TwoFactorVerifyResponse>

    @POST("api/auth/forgot-password")
    suspend fun forgotPassword(@Body body: ForgotPasswordRequest): Response<ForgotPasswordResponse>

    @POST("api/auth/reset-password")
    suspend fun resetPassword(@Body body: ResetPasswordRequest): Response<ResetPasswordResponse>

    // Simulated-consent social exchange (web social-auth.ts) — no OAuth SDK.
    @POST("api/auth/google")
    suspend fun google(@Body body: GoogleAuthRequest): Response<LoginResponse>

    @POST("api/auth/facebook")
    suspend fun facebook(@Body body: FacebookAuthRequest): Response<LoginResponse>

    // Web auth-store.logout() calls this first; native logout mirrors it.
    @POST("api/auth/logout")
    suspend fun logout(): Response<JsonElement>
}

/** Post-login profile hydration (auth-store.refreshProfile parity). */
interface ProfileApi {
    @GET("api/profile/me")
    suspend fun me(): Response<ApiEnvelope<ProfileMeDto>>

    /** t279 — PATCH api/profile/me (profile/me/route.ts:96-170): the SAME
     *  update contract the web edit-profile page drives — user fields +
     *  buyerProfile/supplierProfile upsert in one round-trip. */
    @PATCH("api/profile/me")
    suspend fun updateMe(@Body body: ProfileUpdateRequest): Response<ApiEnvelope<ProfileMeDto>>

    /** t280 — PATCH api/profile/me with a RAW JSON body (the photo-remove
     *  leg sends { "avatarUrl": null } — an explicit null ON THE WIRE, which
     *  a typed DTO with explicitNulls=false would drop instead of send). */
    @PATCH("api/profile/me")
    suspend fun patchMeRaw(@Body body: kotlinx.serialization.json.JsonElement): Response<ApiEnvelope<ProfileMeDto>>
}
