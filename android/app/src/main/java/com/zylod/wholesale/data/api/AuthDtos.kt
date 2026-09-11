package com.zylod.wholesale.data.api

import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString

/*
 * Phase 1 auth DTOs — field names verified against the live route sources:
 *   auth/login/route.ts, auth/register/route.ts, auth/otp/send|verify/route.ts,
 *   auth/2fa/verify/route.ts, auth/forgot-password/route.ts,
 *   auth/reset-password/route.ts, auth/google|facebook/route.ts,
 *   uploads/kyc/route.ts, profile/me/route.ts.
 * Error branches (401/403/429) do NOT match the success DTO — they are parsed
 * separately into [AuthErrorDto] from the error body via ApiClient.json.
 */

/* ─── Requests ─── */

@Serializable
data class LoginRequest(
    val email: String? = null,
    val phone: String? = null,
    val password: String,
)

/** Field list = the exact destructure in register/route.ts:32-34. */
@Serializable
data class RegisterRequest(
    val userType: String,
    val authProvider: String,
    val email: String? = null,
    val phone: String? = null,
    val password: String? = null,
    val fullName: String? = null,
    val businessName: String? = null,
    val businessType: String? = null,
    val city: String? = null,
    val nidNumber: String? = null,
    val nidFrontImageUrl: String? = null,
    val nidBackImageUrl: String? = null,
    val tradeLicenseNumber: String? = null,
    val tradeLicenseImageUrl: String? = null,
    val tinNumber: String? = null,
    val bankName: String? = null,
    val bankAccountName: String? = null,
    val bankAccountNumber: String? = null,
    val branch: String? = null,
    // Mark the channel just verified (otp-verification-page.tsx:122-123).
    val isPhoneVerified: Boolean? = null,
    val isEmailVerified: Boolean? = null,
)

@Serializable
data class OtpSendRequest(val phoneOrEmail: String, val purpose: String)

@Serializable
data class OtpVerifyRequest(val phoneOrEmail: String, val code: String, val purpose: String? = null)

@Serializable
data class TwoFactorVerifyRequest(val userId: String, val code: String, val method: String = "authenticator")

@Serializable
data class ForgotPasswordRequest(val email: String)

@Serializable
data class ResetPasswordRequest(val token: String, val password: String, val confirmPassword: String)

/** Simulated-consent exchange payloads (social-auth.ts:92-95). */
@Serializable
data class GoogleAuthRequest(val googleId: String, val email: String, val name: String? = null)

@Serializable
data class FacebookAuthRequest(val facebookId: String, val email: String, val name: String? = null)

@Serializable
data class AddCartRequest(
    val buyerId: String? = null,
    val productId: String,
    val variantId: String? = null,
    val quantity: Int,
    val supplierId: String,
)

@Serializable
data class UpdateCartRequest(val quantity: Int)

@Serializable
data class WishlistAddRequest(val productId: String, val note: String? = null)

/** Body mirrors web product-detail-page.tsx:398-409 (no shippingAddressId, COD). */
@Serializable
data class CreateDirectRequest(
    val productId: String,
    val quantity: Int,
    val variantId: String? = null,
    val unitPrice: Double,
    val supplierId: String,
    val paymentMethod: String? = "cod",
    val shippingAddressId: String? = null,
)

/* ─── Responses ─── */

/**
 * Success shape of POST /api/auth/login (login/route.ts:167-182). The 2FA
 * branch (L146-154) reuses the same top-level fields; error branches are
 * parsed into [AuthErrorDto].
 */
@Serializable
data class LoginResponse(
    val success: Boolean = false,
    val token: String? = null,
    val requires2FA: Boolean = false,
    val userId: String? = null,
    val methods: List<String> = emptyList(),
    val hasPhone: Boolean = false,
    val maskedPhone: String? = null,
    val user: AuthUserDto? = null,
)

/** login.user ∪ register.user (register/route.ts:137-152 adds fullName/businessName). */
@Serializable
data class AuthUserDto(
    val id: String,
    val userType: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val authProvider: String? = null,
    val accountStatus: String? = null,
    val isEmailVerified: Boolean = false,
    val isPhoneVerified: Boolean = false,
    val requires2FA: Boolean = false,
    val fullName: String? = null,
    val businessName: String? = null,
)

@Serializable
data class RegisterResponse(
    val success: Boolean = false,
    val token: String? = null,
    val user: AuthUserDto? = null,
)

@Serializable
data class OtpSendResponse(
    val success: Boolean = false,
    val message: String? = null,
    // Dev-only plaintext code (no SMS/email provider configured). NEVER shown
    // in native UI — release hygiene per spec §5.3.
    val otpCode: String? = null,
    val devCode: String? = null,
    val expiresAt: String? = null,
)

/** otp/verify returns {verified, token|resetToken, user} depending on purpose. */
@Serializable
data class OtpVerifyResponse(
    val success: Boolean = false,
    val verified: Boolean = false,
    val token: String? = null,
    val resetToken: String? = null,
    val message: String? = null,
    val user: OtpUserDto? = null,
)

@Serializable
data class OtpUserDto(
    val id: String? = null,
    val userType: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val authProvider: String? = null,
    val accountStatus: String? = null,
)

@Serializable
data class TwoFactorVerifyResponse(
    val success: Boolean = false,
    val message: String? = null,
    val token: String? = null,
    val user: AuthUserDto? = null,
)

/** forgot-password also returns devToken (dev delivery) — never surfaced in UI. */
@Serializable
data class ForgotPasswordResponse(
    val success: Boolean = false,
    val message: String? = null,
    val devToken: String? = null,
)

@Serializable
data class ResetPasswordResponse(val success: Boolean = false, val message: String? = null)

/** POST /api/uploads/kyc — `url` is TOP-LEVEL (spec §5.3 known gap). */
@Serializable
data class KycUploadResponse(
    val success: Boolean = false,
    val url: String? = null,
    val kind: String? = null,
    val size: Long = 0,
    val error: String? = null,
)

/** POST /api/orders/create-direct success data (create-direct/route.ts:75-85). */
@Serializable
data class CreateDirectData(
    val orderId: String? = null,
    val orderNumber: String? = null,
    val totalAmount: Double = 0.0,
    val paymentStatus: String? = null,
    val subOrderId: String? = null,
    val estimatedDelivery: String? = null,
)

/* ─── Error parsing ─── */

/** Suspension details carried by 403 branches (login/2fa/social routes). */
@Serializable
data class SuspensionDto(
    val reason: String? = null,
    val reference: String? = null,
    val suspendedAt: String? = null,
)

/**
 * Every error body this phase can receive: {error, code?, attemptsRemaining?,
 * accountLocked?, lockedUntil?, accountStatus?, suspension?, detail?,
 * stockAvailable?, moq?} — plus cart 400s which carry stock/moq extras.
 */
@Serializable
data class AuthErrorDto(
    val error: String? = null,
    val code: String? = null,
    val attemptsRemaining: Int? = null,
    val accountLocked: Boolean? = null,
    val lockedUntil: Long? = null,
    val accountStatus: String? = null,
    val suspension: SuspensionDto? = null,
    val detail: String? = null,
    val stockAvailable: Int? = null,
    val moq: Int? = null,
)

/** Parses a retrofit error body with the shared lenient Json instance. */
fun parseErrorBody(body: okhttp3.ResponseBody?): AuthErrorDto {
    val raw = body?.string()
    if (raw.isNullOrBlank()) return AuthErrorDto()
    return runCatching { ApiClient.json.decodeFromString(AuthErrorDto.serializer(), raw) }
        .getOrDefault(AuthErrorDto())
}

/* ─── Profile / session shapes ─── */

/** profile/me response (profile/me/route.ts:39-79) — subset the app consumes. */
@Serializable
data class ProfileMeDto(
    val id: String,
    val userType: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val fullName: String? = null,
    val avatarUrl: String? = null,
    val isEmailVerified: Boolean = false,
    val isPhoneVerified: Boolean = false,
    val accountStatus: String? = null,
    val isProfileComplete: Boolean = false,
    val profileCompletionPct: Int = 0,
    val buyerProfile: BuyerProfileBrief? = null,
    val supplierProfile: SupplierProfileBrief? = null,
)

@Serializable
data class BuyerProfileBrief(
    val fullName: String? = null,
    val businessName: String? = null,
    val businessType: String? = null,
)

@Serializable
data class SupplierProfileBrief(
    val companyName: String? = null,
    val contactPersonName: String? = null,
    val verificationStatus: String? = null,
    val rejectionReason: String? = null,
    val slug: String? = null,
)

/**
 * Exactly the web UserProfile shape from src/store/auth-store.ts:6-21 — this is
 * what gets cached in SessionManager and seeded into b2b-auth-storage.
 */
@Serializable
data class UserProfileSeed(
    val id: String,
    val userType: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val fullName: String? = null,
    val businessName: String? = null,
    val avatarUrl: String? = null,
    val isProfileComplete: Boolean = false,
    val profileCompletionPct: Int = 0,
    val verificationStatus: String? = null,
    val rejectionReason: String? = null,
    val companyName: String? = null,
    val supplierSlug: String? = null,
)

/** auth-store.refreshProfile (auth-store.ts:67-101) mapping, verbatim. */
fun ProfileMeDto.toUserProfileSeed(): UserProfileSeed = UserProfileSeed(
    id = id,
    userType = userType,
    email = email,
    phone = phone,
    fullName = fullName ?: buyerProfile?.fullName ?: supplierProfile?.contactPersonName,
    businessName = supplierProfile?.companyName,
    avatarUrl = avatarUrl,
    isProfileComplete = isProfileComplete,
    profileCompletionPct = profileCompletionPct,
    verificationStatus = supplierProfile?.verificationStatus,
    rejectionReason = supplierProfile?.rejectionReason,
    companyName = supplierProfile?.companyName,
    supplierSlug = supplierProfile?.slug,
)

/** Maps a login/register success `user` into the cached seed profile. */
fun AuthUserDto.toUserProfileSeed(): UserProfileSeed = UserProfileSeed(
    id = id,
    userType = userType,
    email = email,
    phone = phone,
    fullName = fullName,
    businessName = businessName,
    avatarUrl = null,
    isProfileComplete = false,
    profileCompletionPct = 0,
)
