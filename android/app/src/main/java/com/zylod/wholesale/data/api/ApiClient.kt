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
import retrofit2.http.GET
import retrofit2.http.Query
import java.util.concurrent.TimeUnit
import java.util.concurrent.ConcurrentHashMap

interface ZylodApi {
    @GET("api/categories")
    suspend fun categories(): ApiEnvelope<List<CategoryDto>>

    @GET("api/products")
    suspend fun products(
        @Query("sortBy") sortBy: String = "soldCount",
        @Query("sortOrder") sortOrder: String = "desc",
        @Query("limit") limit: Int = 20,
        @Query("page") page: Int = 1,
        // t233 — native Search/Categories/category pages reuse this endpoint
        // with the web contract's own filter params (src/app/api/products).
        @Query("search") search: String? = null,
        @Query("category") category: String? = null,
    ): ApiEnvelope<List<ProductDto>>

    // t233 — native Home banner rail (public banners table, home_top slot).
    @GET("api/banners")
    suspend fun banners(@Query("position") position: String = "home_top"): ApiEnvelope<BannersData>

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
 *  - Only `/api/` paths are considered (page loads never authenticate).
 *  - `/api/auth/` endpoints are excluded: their 401/403s are meaningful
 *    responses (invalid credentials, suspended, rate limited) that screens
 *    must see, not session expiry.
 *  - Exactly one retry per request (guarded with the X-Zylod-Reauth header).
 *  - If refresh fails (401/400/network), the session is cleared and a
 *    session-expired event is broadcast on SessionManager.expiredTick; screens
 *    (Cart/PDP) surface a "signed out" state instead of crashing.
 */
private class SessionAuthenticator : Authenticator {

    companion object {
        // t277-1b P0 — SINGLE-FLIGHT refresh. The refresh token IS the live
        // session token and rotation DESTROYS it (route.ts single-use), while
        // OkHttp runs authenticate() concurrently per in-flight call (Home
        // alone fires six parallel authed requests). Without a lock, all six
        // presented the same stale token, one rotated, the other five got 401
        // on a now-destroyed token and each called onSessionExpired() — which
        // CLEAR()d the freshly rotated token and logged the user out of a
        // perfectly valid session (the "random logout" class). Blocking
        // synchronized is correct here: the authenticator already runs on an
        // OkHttp worker thread inside a blocking call chain.
        private val refreshLock = Any()
    }

    override fun authenticate(route: Route?, response: Response): Request? {
        val request = response.request
        val path = request.url.encodedPath
        if (!path.startsWith("/api/")) return null
        if (path.startsWith("/api/auth/")) return null // includes /api/auth/refresh
        if (request.header("X-Zylod-Reauth") != null) return null // single retry only

        val stale = SessionManager.token() ?: return null
        val fresh = runCatching {
            synchronized(refreshLock) {
                val current = SessionManager.token()
                if (current != null && current != stale) {
                    // The lock leader already rotated past OUR stale token —
                    // adopt the fresh one, never re-present the destroyed one.
                    current
                } else {
                    refreshSync(request, stale)?.also { SessionManager.setToken(it) }
                }
            }
        }.getOrNull()
        return if (fresh != null) {
            request.newBuilder()
                .header("Authorization", "Bearer $fresh")
                .header("X-Zylod-Reauth", "1")
                .build()
        } else {
            // t277-1b: expire the session ONLY when our stale token is still
            // the current one. If the lock holder rotated past it, this 401
            // was the rotation race — the session is alive and the adopting
            // retry above (or the caller's next request) will succeed.
            if (SessionManager.token() == stale) SessionManager.onSessionExpired()
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

    //
    // Phase 1 runtime-audit fix: clients are MEMOIZED per baseUrl. Every
    // screen used to build a fresh Retrofit + OkHttpClient per API call —
    // a new connection pool, fresh TCP/TLS handshake and new dispatcher
    // threads per request — which showed up as sluggish screens and jank
    // from GC churn. One shared client keeps keep-alive connection reuse.
    //
    private val httpClients = ConcurrentHashMap<String, OkHttpClient>()
    private val retrofits = ConcurrentHashMap<String, Retrofit>()
    private val apiCache = ConcurrentHashMap<Pair<String, String>, Any>()

    /**
     * Shared OkHttp client: Bearer header from SessionManager (kept dynamic so
     * a refresh-rotated token is picked up without rebuilding) + the 401
     * refresh authenticator above. Memoized — one connection pool process-wide.
     */
    fun okHttpClient(): OkHttpClient = httpClients.computeIfAbsent("shared") {
        OkHttpClient.Builder()
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
    }

    fun retrofit(baseUrl: String, client: OkHttpClient = okHttpClient()): Retrofit =
        retrofits.computeIfAbsent(baseUrl) {
            val root = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"
            Retrofit.Builder()
                .baseUrl(root)
                .client(client)
                .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
                .build()
        }

    @Suppress("UNCHECKED_CAST")
    private fun <T : Any> cachedApi(baseUrl: String, tag: String, factory: (Retrofit) -> T): T =
        apiCache.computeIfAbsent(baseUrl to tag) { factory(retrofit(baseUrl)) } as T

    fun create(baseUrl: String, context: Context): ZylodApi =
        cachedApi(baseUrl, "zylod") { it.create(ZylodApi::class.java) }

    fun authApi(baseUrl: String): AuthApi =
        cachedApi(baseUrl, "auth") { it.create(AuthApi::class.java) }

    fun profileApi(baseUrl: String): ProfileApi =
        cachedApi(baseUrl, "profile") { it.create(ProfileApi::class.java) }

    /** t280 — account settings family (settings/notifications/privacy/theme/
     *  photo/2fa/backup-codes). */
    fun profileSettingsApi(baseUrl: String): ProfileSettingsApi =
        cachedApi(baseUrl, "profileSettings") { it.create(ProfileSettingsApi::class.java) }

    fun productDetailApi(baseUrl: String): ProductDetailApi =
        cachedApi(baseUrl, "productDetail") { it.create(ProductDetailApi::class.java) }

    fun cartApi(baseUrl: String): CartApi =
        cachedApi(baseUrl, "cart") { it.create(CartApi::class.java) }

    fun wishlistApi(baseUrl: String): WishlistApi =
        cachedApi(baseUrl, "wishlist") { it.create(WishlistApi::class.java) }

    fun ordersApi(baseUrl: String): OrdersApi =
        cachedApi(baseUrl, "orders") { it.create(OrdersApi::class.java) }

    fun dealsApi(baseUrl: String): DealsApi =
        cachedApi(baseUrl, "deals") { it.create(DealsApi::class.java) }

    fun walletApi(baseUrl: String): WalletApi =
        cachedApi(baseUrl, "wallet") { it.create(WalletApi::class.java) }

    fun sellerApi(baseUrl: String): SellerApi =
        cachedApi(baseUrl, "seller") { it.create(SellerApi::class.java) }

    fun supportApi(baseUrl: String): SupportApi =
        cachedApi(baseUrl, "support") { it.create(SupportApi::class.java) }

    fun adminApi(baseUrl: String): AdminApi =
        cachedApi(baseUrl, "admin") { it.create(AdminApi::class.java) }

    fun couponsApi(baseUrl: String): CouponsApi =
        cachedApi(baseUrl, "coupons") { it.create(CouponsApi::class.java) }

    fun rfqApi(baseUrl: String): RfqApi =
        cachedApi(baseUrl, "rfq") { it.create(RfqApi::class.java) }

    // t251 — native chat surfaces (live support sessions/messages/end-chat
    // + the PUBLIC chatbot query endpoint). Same memoization as every
    // accessor above; the shared OkHttp client adds the Bearer header and
    // the 401-refresh chain (chatbot/query is public and ignores the header).
    fun chatApi(baseUrl: String): ChatApi =
        cachedApi(baseUrl, "chat") { it.create(ChatApi::class.java) }

    // t278 — native buyer↔supplier DM conversations (GET list / create-or-
    // reuse / thread messages / send). Same memoization; every route here
    // is Bearer-authenticated through the shared OkHttp client and its
    // 401-refresh chain — this is the family the web's chat pages ride, and
    // the native chat family previously (wrongly) funneled into chatApi's
    // SUPPORT sessions instead.
    fun chatConversationApi(baseUrl: String): ChatConversationApi =
        cachedApi(baseUrl, "chatConversation") { it.create(ChatConversationApi::class.java) }

    // t252 — native logistics surfaces (PUBLIC delivery-methods / warehouses
    // / shipping-quote + the buyer's order detail for tracking, which sits
    // on OrdersApi above). Same memoization; the shared OkHttp client adds
    // the Bearer header and the 401-refresh chain (the three public routes
    // ignore the header when it is present).
    fun logisticsApi(baseUrl: String): LogisticsApi =
        cachedApi(baseUrl, "logistics") { it.create(LogisticsApi::class.java) }

    // t253 — native returns surface (the order-for-return projection of
    // GET api/orders/{orderId} + POST api/orders/{orderId}/return). Same
    // memoization; both routes are Bearer-authenticated through the shared
    // OkHttp client and its 401-refresh chain.
    fun returnsApi(baseUrl: String): ReturnsApi =
        cachedApi(baseUrl, "returns") { it.create(ReturnsApi::class.java) }

    // t253 — native address-book surfaces (GET/POST api/addresses plus the
    // per-id PUT/DELETE contract). Same memoization; all four routes are
    // Bearer-authenticated through the shared OkHttp client.
    fun addressesApi(baseUrl: String): AddressesApi =
        cachedApi(baseUrl, "addresses") { it.create(AddressesApi::class.java) }

    // t254 — native reviews surfaces (PUBLIC GET api/reviews + the
    // buyer-only POST, plus the product-context GETs the review header
    // resolves). Same memoization; the shared OkHttp client adds the
    // Bearer header and the 401-refresh chain (the public reads ignore
    // the header when it is present).
    fun reviewsApi(baseUrl: String): ReviewsApi =
        cachedApi(baseUrl, "reviews") { it.create(ReviewsApi::class.java) }

    // t255 — native support surfaces (the twelve PUBLIC support routes the
    // seven faq/helpdesk/docs/status/contact/feedback pageIds read: faqs +
    // their vote, policies + articles + per-slug detail + article feedback,
    // status + app diagnostics, public settings, contact + community
    // feedback). Same memoization; the shared OkHttp client adds the
    // Bearer header and the 401-refresh chain (all routes here are public
    // and ignore the header when it is present).
    fun supportPublicApi(baseUrl: String): SupportPublicApi =
        cachedApi(baseUrl, "supportPublic") { it.create(SupportPublicApi::class.java) }

    // t256 — native financial-instrument surfaces (bank accounts GET/POST/
    // DELETE, cards GET/POST/DELETE, payment methods GET/POST/DELETE + the
    // mobile-banking projection). Same memoization; every route here is
    // Bearer-authenticated through the shared OkHttp client and its
    // 401-refresh chain (the wallet transaction routes this batch also
    // renders sit on the EXISTING walletApi accessor above — not redeclared).
    fun financeApi(baseUrl: String): FinanceApi =
        cachedApi(baseUrl, "finance") { it.create(FinanceApi::class.java) }

    // t258 — native money-movement surfaces (manual top-up claim GET/POST,
    // gateway top-up initiate, the supplier payout rail GET/POST, the
    // buyer's processed-refund ledger). Same memoization; every route here
    // is Bearer-authenticated through the shared OkHttp client and its
    // 401-refresh chain (a SEPARATE interface from FinanceApi so the t256
    // route set stays put — one accessor, no duplicate class names).
    fun walletMoneyApi(baseUrl: String): WalletMoneyApi =
        cachedApi(baseUrl, "walletMoney") { it.create(WalletMoneyApi::class.java) }

    // t259 — native rewards/referral/affiliate surfaces (the rewards book +
    // catalog redemption, loyalty status, the referral code/claim pair, the
    // affiliate status/join + dashboard). Same memoization; every route here
    // is Bearer-authenticated through the shared OkHttp client and its
    // 401-refresh chain (the minimal GET api/rewards strip the coupon vault
    // reads stays on couponsApi above — never redeclared there).
    fun rewardsApi(baseUrl: String): RewardsApi =
        cachedApi(baseUrl, "rewards") { it.create(RewardsApi::class.java) }

    // t261 — native complaints/queries surfaces (the complaints list/create/
    // detail/withdraw routes, the supplier query thread GET/PATCH, the buyer
    // query rail, and the report-problem POST both raise pageIds submit).
    // Same memoization; every route here is Bearer-authenticated through the
    // shared OkHttp client and its 401-refresh chain (report-problem is
    // public-optional and ignores the header when it is present).
    fun complaintsApi(baseUrl: String): ComplaintsApi =
        cachedApi(baseUrl, "complaints") { it.create(ComplaintsApi::class.java) }

    // t262 — native wishlist/favorites surfaces (the per-item wishlist row
    // GET/PATCH/DELETE, the share-link GET/POST/DELETE, the PUBLIC shared
    // read, the ranked favorites GET, the followed-categories +
    // favorite-suppliers follow rails, and the saved-searches GET/DELETE).
    // Same memoization; every route except the shared read is
    // Bearer-authenticated through the shared OkHttp client and its
    // 401-refresh chain (api/wishlist/shared is public and ignores the
    // header when it is present — the t233 list/add/remove wishlist routes
    // stay on the wishlistApi accessor above, never redeclared).
    fun wishlistItemApi(baseUrl: String): WishlistItemApi =
        cachedApi(baseUrl, "wishlistItem") { it.create(WishlistItemApi::class.java) }

    fun wishlistShareApi(baseUrl: String): WishlistShareApi =
        cachedApi(baseUrl, "wishlistShare") { it.create(WishlistShareApi::class.java) }

    fun sharedWishlistApi(baseUrl: String): SharedWishlistApi =
        cachedApi(baseUrl, "sharedWishlist") { it.create(SharedWishlistApi::class.java) }

    fun favoritesApi(baseUrl: String): FavoritesApi =
        cachedApi(baseUrl, "favorites") { it.create(FavoritesApi::class.java) }

    fun categoryFollowApi(baseUrl: String): CategoryFollowApi =
        cachedApi(baseUrl, "categoryFollow") { it.create(CategoryFollowApi::class.java) }

    fun supplierFollowApi(baseUrl: String): SupplierFollowApi =
        cachedApi(baseUrl, "supplierFollow") { it.create(SupplierFollowApi::class.java) }

    fun savedSearchesApi(baseUrl: String): SavedSearchesApi =
        cachedApi(baseUrl, "savedSearches") { it.create(SavedSearchesApi::class.java) }

    // t263 — native public-content surfaces (the blog / press / events /
    // newsletter routes behind the seven content pageIds: blog + per-slug
    // post, press list + per-slug release + media kit, events, and the
    // newsletter subscribe POST). Same memoization; every route here is
    // PUBLIC and simply ignores the Bearer header the shared OkHttp client
    // attaches (the SupportPublicApi convention — no sign-in gate).
    fun contentApi(baseUrl: String): ContentApi =
        cachedApi(baseUrl, "content") { it.create(ContentApi::class.java) }

    // t264 — native careers/company/investor surfaces (the careers list +
    // per-job detail + apply POST, the investor documents list + contact
    // POST, and the about/milestones timeline behind the twelve company
    // pageIds). Same memoization; every route here is PUBLIC and simply
    // ignores the Bearer header the shared OkHttp client attaches (the
    // SupportPublicApi convention — no sign-in gate).
    fun careersInvestorApi(baseUrl: String): CareersInvestorApi =
        cachedApi(baseUrl, "careersInvestor") { it.create(CareersInvestorApi::class.java) }

    // t265 — native admin-operations surfaces (the eight admin pageIds:
    // audit-logs, deliveries/{assignments,drivers}, inspections, payments,
    // reports, settings, shipping/{methods,rates,zones}, categories). A
    // SEPARATE interface from AdminApi so the t248 admin route set stays
    // put. Same memoization; every route here is Bearer-authenticated
    // through the shared OkHttp client and its 401-refresh chain
    // (requireUserType(['admin']) handlers — 401/403 render the honest gate).
    fun adminOpsApi(baseUrl: String): AdminOpsApi =
        cachedApi(baseUrl, "admin-ops") { it.create(AdminOpsApi::class.java) }

    // t266 — native seller-operations surfaces (the eight seller pageIds:
    // payouts, revenue, analytics, inventory, customer-insights, reviews,
    // shipping-settings, verification-status). A SEPARATE interface from
    // SellerApi so the t245 seller route set stays put. Same memoization;
    // every route here is Bearer-authenticated through the shared OkHttp
    // client and its 401-refresh chain (requireUserType(['supplier','admin'])
    // handlers — 401 signed-out and 403 no-supplier-profile both render the
    // screens' honest not-seller gate).
    fun sellerOpsApi(baseUrl: String): SellerOpsApi =
        cachedApi(baseUrl, "seller-ops") { it.create(SellerOpsApi::class.java) }

    // t267 — native supplier-core surfaces (supplier-orders, supplier-products,
    // supplier-samples, supplier-warehouse, suppliers directory). A SEPARATE
    // interface from SellerOpsApi so the t266 seller route set stays put. Same
    // memoization + Bearer auth + 401-refresh chain; 401/403/404 profile
    // gates render the screens' honest not-seller state.
    fun supplierCoreApi(baseUrl: String): SupplierCoreApi =
        cachedApi(baseUrl, "supplier-core") { it.create(SupplierCoreApi::class.java) }

    // t270 — native supplier register wizard (the supplier-onboarding +
    // supplier-resources pageIds render the same 4-step form): the multipart
    // api/uploads/kyc document upload (file + kind parts, TOP-LEVEL url in
    // the response) behind ui/suppliercore/SupplierRegisterScreen.kt. The
    // register POST itself rides the EXISTING authApi accessor above — never
    // redeclared. Same memoization; the shared OkHttp client adds the Bearer
    // header (the upload route is public and ignores the header when present).
    fun supplierFormsApi(baseUrl: String): SupplierFormsApi =
        cachedApi(baseUrl, "supplier-forms") { it.create(SupplierFormsApi::class.java) }

    // t273 — native checkout money-path (POST api/orders, GET
    // api/shipping/quote, POST api/coupons/validate + the confirmation
    // projection of GET api/orders/{orderId}). A SEPARATE interface from
    // OrdersApi so the t252 tracking route set stays put. Same memoization;
    // every route here is Bearer-authenticated through the shared OkHttp
    // client and its 401-refresh chain (the orders route requires the buyer
    // session — 401 renders the screens' honest sign-in wall).
    fun checkoutApi(baseUrl: String): CheckoutApi =
        cachedApi(baseUrl, "checkout") { it.create(CheckoutApi::class.java) }

    // t274 — typed buyer order detail (GET api/orders/{id} full projection,
    // POST cancel, POST payment-submit, POST payments/initiate, GET receipt).
    // A SEPARATE interface from CheckoutApi so the confirmation projection
    // stays put; the GET redeclares the SAME route with the richer shape the
    // detail screen needs. Same memoization + Bearer/401-refresh chain.
    fun orderDetailApi(baseUrl: String): OrderDetailApi =
        cachedApi(baseUrl, "order-detail") { it.create(OrderDetailApi::class.java) }

    // t282 — the RECENTLY-VIEWED circuit (GET/POST/DELETE
    // api/products/recently-viewed) behind ui/wishlist/RecentlyViewedScreen:
    // the PDP records views fire-and-forget, the typed screen reads the
    // cursor-paginated history. AUTHENTICATED routes (guests are 401 by
    // design); same memoization + Bearer/401-refresh chain.
    fun recentlyViewedApi(baseUrl: String): RecentlyViewedApi =
        cachedApi(baseUrl, "recently-viewed") { it.create(RecentlyViewedApi::class.java) }

    // t282 — SAVE-FOR-LATER (GET api/save-for-later + DELETE
    // api/save-for-later/{itemId}) behind ui/wishlist/SaveForLaterScreen —
    // the routes WishlistApi.kt's t259 note kept undeclared until a pageId
    // rendered them. AUTHENTICATED; same memoization + Bearer/401 chain
    // (Move-to-Cart rides the EXISTING cartApi accessor — never redeclared).
    fun saveForLaterApi(baseUrl: String): SaveForLaterApi =
        cachedApi(baseUrl, "save-for-later") { it.create(SaveForLaterApi::class.java) }

    // t282 — the POINTS LEDGER + REDEMPTION rail (GET api/rewards/history
    // with the type filter + page paging, POST api/rewards/redeem with the
    // free-amount {pointsToRedeem, rewardType} body) behind
    // ui/rewards/PointsHistoryScreen + RedeemPointsScreen. A SEPARATE
    // interface from RewardsApi so the t259 rewards-book/catalog-redeem set
    // stays put. AUTHENTICATED (requireUserType/authenticateRequest); same
    // memoization + Bearer/401-refresh chain; the redeem screen's balance
    // rides the EXISTING rewardsApi.loyalty() call.
    fun pointsLedgerApi(baseUrl: String): PointsLedgerApi =
        cachedApi(baseUrl, "points-ledger") { it.create(PointsLedgerApi::class.java) }

    // t296 — BUYER DASHBOARD (GET api/buyer/dashboard — stats/recent orders/
    // 6-month spending/favorite suppliers/wishlist previews/recent searches/
    // activity) behind the typed ui/screens/BuyerDashboardScreen. Same
    // memoization + Bearer/401-refresh chain (401 renders the screen's
    // honest sign-in CTA).
    fun buyerDashboardApi(baseUrl: String): BuyerDashboardApi =
        cachedApi(baseUrl, "buyer-dashboard") { it.create(BuyerDashboardApi::class.java) }

    // t296 — SEARCH DISCOVERY (GET/DELETE api/search/history + GET/POST
    // api/search/popular) behind the typed search screen's server-history
    // and trending rails. AUTH-notes: history is Bearer-authenticated
    // (guests 401 — the screen keeps device-local recents), the popular
    // pair is public and ignores the header when present (SupportPublicApi
    // convention). Same memoization + 401-refresh chain.
    fun searchDiscoveryApi(baseUrl: String): SearchDiscoveryApi =
        cachedApi(baseUrl, "search-discovery") { it.create(SearchDiscoveryApi::class.java) }
}
