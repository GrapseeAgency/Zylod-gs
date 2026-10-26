package com.zylod.wholesale.data.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/** GET /api/products/[id] → { success, data: full row } */
interface ProductDetailApi {
    @GET("api/products/{id}")
    suspend fun product(@Path("id") id: String): Response<ApiEnvelope<ProductDetailDto>>

    @GET("api/products/{id}/specifications")
    suspend fun specifications(@Path("id") id: String): Response<ApiEnvelope<SpecificationsDto>>

    /**
     * t209: THE product Q&A rail — public read (products/[id]/qa/route.ts
     * GET: { success, canAnswer, count, data: [...] }).
     */
    @GET("api/products/{id}/qa")
    suspend fun qa(@Path("id") id: String): Response<ProductQaResponse>

    /**
     * t209: ask a question — POST {question} (5..500 chars). Session rides
     * the shared OkHttp client's Bearer header; extractToken accepts it
     * (src/lib/auth.ts:115). 201 → { success, data: { id, question, askedAt } }.
     */
    @POST("api/products/{id}/qa")
    suspend fun askQuestion(@Path("id") id: String, @Body body: ProductQaAskRequest): Response<ProductQaAskResponse>
}
