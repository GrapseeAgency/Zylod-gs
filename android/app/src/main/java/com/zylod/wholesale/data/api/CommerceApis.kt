package com.zylod.wholesale.data.api

import kotlinx.serialization.json.JsonElement
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Cart / wishlist / order endpoints (Phase 1). Buyer-only server side —
 * unauthenticated calls return 401 which screens treat as "local cart only".
 * Direct-order placement (POST /api/orders/create-direct) is NOT here: the
 * t190 server contract made shippingAddressId a required buyer-owned field,
 * so the native app no longer calls it — buying routes to the WebView
 * buy-now flow (RouteOwnership: "buy-now" → WEBVIEW) and the endpoint + its
 * DTOs were removed from this surface.
 */
interface CartApi {
    @GET("api/cart")
    suspend fun getCart(): Response<ApiEnvelope<ServerCartDto>>

    @POST("api/cart")
    suspend fun addItem(@Body body: AddCartRequest): Response<ApiEnvelope<JsonElement>>

    @PUT("api/cart/{itemId}")
    suspend fun updateItem(@Path("itemId") itemId: String, @Body body: UpdateCartRequest): Response<ApiEnvelope<JsonElement>>

    @DELETE("api/cart/{itemId}")
    suspend fun deleteItem(@Path("itemId") itemId: String): Response<ApiEnvelope<JsonElement>>
}

interface WishlistApi {
    @GET("api/wishlist")
    suspend fun list(@Query("limit") limit: Int = 50): Response<WishlistEnvelope>

    @POST("api/wishlist")
    suspend fun add(@Body body: WishlistAddRequest): Response<ApiEnvelope<JsonElement>>

    @DELETE("api/wishlist")
    suspend fun remove(@Query("productId") productId: String): Response<ApiEnvelope<JsonElement>>
}

interface OrdersApi {
    /**
     * GET /api/orders/my-orders — the authenticated buyer's order list
     * (orders/my-orders/route.ts, the exact endpoint orders-page.tsx:75
     * fetches). The server has NO pagination params: it returns the account's
     * full list and the web page renders it whole — same here (Phase 2 scope:
     * first round loads one full pull, no cursor).
     */
    @GET("api/orders/my-orders")
    suspend fun myOrders(): Response<ApiEnvelope<List<OrderDto>>>
}
