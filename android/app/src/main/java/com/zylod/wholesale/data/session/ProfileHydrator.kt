package com.zylod.wholesale.data.session

import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.UserProfileSeed
import com.zylod.wholesale.data.api.toUserProfileSeed
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString

/**
 * Post-login profile hydration — port of auth-store.refreshProfile
 * (src/store/auth-store.ts:67-101). Fetches /api/profile/me with the session
 * token and merges the mapped fields into the cached UserProfileSeed JSON so
 * the WebView seed (WebAuthSeeder) carries fullName / businessName / avatar /
 * completion pct exactly like the web store does.
 */
object ProfileHydrator {

    suspend fun refresh(baseUrl: String): UserProfileSeed? {
        val current = currentProfile()
        val token = SessionManager.token() ?: return current
        if (current == null && token.isBlank()) return null
        return try {
            val response = ApiClient.profileApi(baseUrl).me()
            val body = response.body()
            val me = body?.takeIf { it.success }?.data ?: return current
            val fresh = me.toUserProfileSeed()
            // /me wins over the login-response snapshot for shared fields.
            val merged = (current ?: fresh).copy(
                id = me.id,
                userType = me.userType ?: fresh.userType,
                email = me.email ?: fresh.email,
                phone = me.phone ?: fresh.phone,
                fullName = fresh.fullName ?: current?.fullName,
                businessName = fresh.businessName ?: current?.businessName,
                avatarUrl = fresh.avatarUrl ?: current?.avatarUrl,
                isProfileComplete = me.isProfileComplete,
                profileCompletionPct = me.profileCompletionPct,
                verificationStatus = fresh.verificationStatus ?: current?.verificationStatus,
                rejectionReason = fresh.rejectionReason ?: current?.rejectionReason,
                companyName = fresh.companyName ?: current?.companyName,
                supplierSlug = fresh.supplierSlug ?: current?.supplierSlug,
            )
            setUser(merged)
            merged
        } catch (_: Exception) {
            current // silent fail — keep existing profile (web parity)
        }
    }

    fun currentProfile(): UserProfileSeed? {
        val raw = SessionManager.userJson() ?: return null
        return runCatching {
            ApiClient.json.decodeFromString(UserProfileSeed.serializer(), raw)
        }.getOrNull()
    }

    fun setUser(profile: UserProfileSeed) {
        SessionManager.setUserJson(ApiClient.json.encodeToString(UserProfileSeed.serializer(), profile))
    }

    /** Builds the seed profile from a login/register success user. */
    fun fromAuthUser(profile: UserProfileSeed) {
        setUser(profile)
    }
}
