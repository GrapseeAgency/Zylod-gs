package com.zylod.wholesale.data.api

import android.content.Context
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

interface ZylodApi {
    @GET("api/categories")
    suspend fun categories(): ApiEnvelope<List<CategoryDto>>

    @GET("api/products")
    suspend fun products(
        @Query("sortBy") sortBy: String = "soldCount",
        @Query("sortOrder") sortOrder: String = "desc",
        @Query("limit") limit: Int = 20,
        @Query("page") page: Int = 1,
    ): ApiEnvelope<List<ProductDto>>

    @GET("api/deals")
    suspend fun flashDeals(
        @Query("type") type: String = "flash",
        @Query("limit") limit: Int = 8,
    ): ApiEnvelope<DealsData>

    // Count probes only need pagination.total — data can be any list shape.
    @GET("api/products")
    suspend fun productCount(@Query("limit") limit: Int = 1): ApiEnvelope<JsonElement>

    @GET("api/suppliers")
    suspend fun supplierCount(@Query("limit") limit: Int = 1): ApiEnvelope<JsonElement>
}

/**
 * 401 → refresh-rotation → single retry → logout, as an OkHttp Authenticator.
 *
 * CONTRACT FINDING (verified in src/app/api/auth/refresh/route.ts:16-68):
 * there is no separate refresh-token/cookie concept reachable for native —
 * the refresh token IS the current opaque 48-byte session token. The route
 * accepts it via body `{refreshToken}` OR the Authorization header OR the
 * `auth-token` cookie, validates it against the `sessions` table, destroys it
 * (single-use rotation) and returns `{success, token, expiresIn, user}` with a
 * fresh 7-day session. So the refresh call sends the stale token in the body
 * and swaps SessionManager's token for the rotated one.
 *
 * Rules implemented here:
 *  - Only `/api/*` requests are considered (page loads never authenticate).
 *  - `/api/auth/*` endpoints are excluded: their 401/403s are *meaningful*
 *    responses (invalid credentials, suspended, rate limited) that screens
 *    must see, not session expiry.
 *  - Exactly one retry per request (guarded with the X-Zylod-Reauth header).
 *  - If refresh fails (401/400/network), the session is cleared and a
 *    session-expired event is broadcast on SessionManager.expiredTick; screens
 *    (Cart/PDP) surface a "signed out" state instead of crashing.
 */
private class SessionAuthenticator : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        val request = response.request
        val path = request.url.encodedPath
        if (!path.startsWith("/api/")) return null
        if (path.startsWith("/api/auth/")) return null // includes /api/auth/refresh
        if (request.header("X-Zylod-Reauth") != null) return null // single retry only

        val stale = SessionManager.token() ?: return null
        val fresh = runCatching { refreshSync(request, stale) }.getOrNull()
        return if (fresh != null) {
            SessionManager.setToken(fresh)
            request.newBuilder()
                .header("Authorization", "Bearer $fresh")
                .header("X-Zylod-Reauth", "1")
                .build()
        } else {
            SessionManager.onSessionExpired()
            null
        }
    }

    /** Synchronous refresh on the same host; bare client (no auth retry loop). */
    private fun refreshSync(original: Request, staleToken: String): String? {
        val url = original.url.newBuilder()
            .encodedPath("/api/auth/refresh")
            .query(null)
            .build()
        val body: okhttp3.RequestBody = buildJsonObject { put("refreshToken", staleToken) }
            .toString()
            .toRequestBody("application/json; charset=utf-8".toMediaType())
        val request: Request = Request.Builder().url(url).post(body).build()
        bareClient.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) return null
            val json = ApiClient.json
                .decodeFromString(JsonObject.serializer(), resp.body?.string() ?: return null)
            val token = json["token"]?.toString()?.trim('"')
            return token?.takeIf { it.isNotBlank() }
        }
    }

    private val bareClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .build()
    }
}

object ApiClient {
    val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
        explicitNulls = false
    }

    /**
     * Shared OkHttp client: Bearer header from SessionManager (kept dynamic so
     * a refresh-rotated token is picked up without rebuilding) + the 401
     * refresh authenticator above.
     */
    fun okHttpClient(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val token = SessionManager.token()
            val request = if (token != null) {
                chain.request().newBuilder().header("Authorization", "Bearer $token").build()
            } else {
                chain.request()
            }
            chain.proceed(request)
        }
        .authenticator(SessionAuthenticator())
        .build()

    fun retrofit(baseUrl: String, client: OkHttpClient = okHttpClient()): Retrofit {
        val root = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"
        return Retrofit.Builder()
            .baseUrl(root)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    fun create(baseUrl: String, context: Context): ZylodApi =
        retrofit(baseUrl).create(ZylodApi::class.java)

    fun authApi(baseUrl: String): AuthApi =
        retrofit(baseUrl).create(AuthApi::class.java)

    fun profileApi(baseUrl: String): ProfileApi =
        retrofit(baseUrl).create(ProfileApi::class.java)

    fun productDetailApi(baseUrl: String): ProductDetailApi =
        retrofit(baseUrl).create(ProductDetailApi::class.java)

    fun cartApi(baseUrl: String): CartApi =
        retrofit(baseUrl).create(CartApi::class.java)

    fun wishlistApi(baseUrl: String): WishlistApi =
        retrofit(baseUrl).create(WishlistApi::class.java)

    fun ordersApi(baseUrl: String): OrdersApi =
        retrofit(baseUrl).create(OrdersApi::class.java)
}
