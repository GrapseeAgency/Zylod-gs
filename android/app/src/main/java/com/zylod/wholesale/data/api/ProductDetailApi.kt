package com.zylod.wholesale.data.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

/** GET /api/products/[id] → { success, data: full row } */
interface ProductDetailApi {
    @GET("api/products/{id}")
    suspend fun product(@Path("id") id: String): Response<ApiEnvelope<ProductDetailDto>>

    @GET("api/products/{id}/specifications")
    suspend fun specifications(@Path("id") id: String): Response<ApiEnvelope<SpecificationsDto>>
}
