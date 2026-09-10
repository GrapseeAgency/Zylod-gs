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
 * Cart / wishlist / direct-order endpoints (Phase 1). Buyer-only server side —
 * unauthenticated calls return 401 which screens treat as "local cart only".
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
    /** Mirrors the web buy-now call — no shippingAddressId, paymentMethod 'cod'. */
    @POST("api/orders/create-direct")
    suspend fun createDirect(@Body body: CreateDirectRequest): Response<CreateDirectEnvelope>
}
