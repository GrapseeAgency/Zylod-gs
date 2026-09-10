package com.zylod.wholesale.data.api

import com.zylod.wholesale.data.session.SessionManager
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.GET
import retrofit2.http.Query
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

object ApiClient {
    val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
        explicitNulls = false
    }

    fun create(baseUrl: String, context: android.content.Context): ZylodApi {
        val client = OkHttpClient.Builder()
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
            .build()

        val root = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"
        return Retrofit.Builder()
            .baseUrl(root)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(ZylodApi::class.java)
    }
}
