package com.zylod.wholesale.data.api

import kotlinx.serialization.Serializable
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

/**
 * t270 — supplier form surfaces: the multipart KYC document upload behind the
 * 4-step supplier register wizard (ui/suppliercore/SupplierRegisterScreen.kt,
 * the register-supplier-page.tsx port served for the supplier-onboarding and
 * supplier-resources pageIds).
 *
 * POST api/uploads/kyc carries exactly two form parts — `file` (the picked
 * image bytes with a sensible filename) and `kind` (nid-front | nid-back |
 * trade-license, validated server-side at uploads/kyc/route.ts:24) — and
 * answers `{success, url: "/uploads/kyc/...", kind, size}`. The response is
 * parsed into the EXISTING [KycUploadResponse] (AuthDtos.kt — `url` is
 * TOP-LEVEL, verified against the route source; no new envelope type). The
 * register POST itself rides the EXISTING AuthApi.register accessor — never
 * redeclared here. The route is public: the shared OkHttp client may attach
 * a Bearer header and the endpoint simply ignores it.
 */
interface SupplierFormsApi {

    @Multipart
    @POST("api/uploads/kyc")
    suspend fun uploadKyc(
        @Part file: MultipartBody.Part,
        @Part("kind") kind: RequestBody,
    ): Response<KycUploadResponse>

    // t271 — the product-creation rail behind ui/suppliercore/
    // SupplierAddProductFormScreen (seller-add-product-page.tsx port):
    // GET api/categories is PUBLIC (no auth — the Bearer header the shared
    // client attaches is simply ignored) and feeds the flattened category
    // picker; POST api/supplier/products creates the listing under the
    // supplier/admin session (401 anonymous, 403 no supplierProfiles row,
    // 400 Zod with an issues map, 201 Product created); the multipart
    // product-media upload carries EXACTLY one form part named `file`
    // (PNG/JPEG/WebP, server magic-byte sniffed) and answers a TOP-LEVEL
    // url path. Every route rides the shared OkHttp client — never add an
    // Authorization header manually.

    @GET("api/categories")
    suspend fun categories(): Response<SupplierFormsCategoriesEnvelope>

    @POST("api/supplier/products")
    suspend fun createProduct(@Body payload: SupplierFormsCreatePayload): Response<SupplierFormsCreateEnvelope>

    @Multipart
    @POST("api/uploads/product-media")
    suspend fun uploadProductMedia(@Part file: MultipartBody.Part): Response<SupplierFormsMediaEnvelope>
}

/* ─── t271 DTOs — SupplierForms-prefixed, unique across the codebase ─── */

/** One GET api/categories node (roots carry two levels of children). */
@Serializable
data class SupplierFormsCategoryNode(
    val id: String = "",
    val name: String = "",
    val slug: String = "",
    val productCount: Int = 0,
    val supplierCount: Int = 0,
    val children: List<SupplierFormsCategoryNode> = emptyList(),
)

/** GET api/categories success envelope — data is the root-node list. */
@Serializable
data class SupplierFormsCategoriesEnvelope(
    val success: Boolean = false,
    val data: List<SupplierFormsCategoryNode> = emptyList(),
)

/** Canonical productPayloadSchema priceTiers row (product-contract.ts). */
@Serializable
data class SupplierFormsTierPayload(
    val minQty: Double,
    val maxQty: Double? = null,
    val pricePerUnit: Double,
)

/** Canonical productPayloadSchema images row — sortOrder is the form index. */
@Serializable
data class SupplierFormsImagePayload(
    val imageUrl: String,
    val sortOrder: Int,
)

/** Canonical productPayloadSchema variants row (rows with empty name/value never leave the client). */
@Serializable
data class SupplierFormsVariantPayload(
    val variantName: String,
    val variantValue: String,
    val sku: String? = null,
    val stockQuantity: Double,
    val priceOverride: Double? = null,
)

/**
 * The FULL canonical create payload (product-contract.ts productPayloadSchema,
 * mirrored field-for-field client-side; explicitNulls=false drops the nulls
 * so empty optionals ride exactly like the web spread-omits).
 */
@Serializable
data class SupplierFormsCreatePayload(
    val name: String,
    val categoryId: String,
    val description: String,
    val brand: String? = null,
    val sku: String? = null,
    val unit: String,
    val bundleSize: Double? = null,
    val weightKg: Double? = null,
    val moq: Double,
    val maxOrderQty: Double? = null,
    val basePrice: Double,
    val currency: String = "BDT",
    val stockQuantity: Double,
    val stockAlertThreshold: Double? = null,
    val isCustomizable: Boolean = false,
    val thumbnailUrl: String? = null,
    val images: List<SupplierFormsImagePayload> = emptyList(),
    val variants: List<SupplierFormsVariantPayload> = emptyList(),
    val priceTiers: List<SupplierFormsTierPayload> = emptyList(),
)

/** 201 body: data.id is the created product row. */
@Serializable
data class SupplierFormsCreatedProduct(val id: String = "")

/** POST api/supplier/products envelope — success + data on 201, error/issues on 400. */
@Serializable
data class SupplierFormsCreateEnvelope(
    val success: Boolean = false,
    val data: SupplierFormsCreatedProduct? = null,
    val message: String = "",
    val error: String = "",
)

/** POST api/uploads/product-media 200 body — url is the served /uploads path. */
@Serializable
data class SupplierFormsMediaEnvelope(
    val success: Boolean = false,
    val url: String = "",
    val type: String = "",
    val sizeBytes: Long = 0,
    val error: String = "",
)

/**
 * Every t271 error body: the flat error line plus the optional Zod issues
 * map (dot-path keys like "priceTiers.0.minQty" — the same shape the web
 * surfaces through serverIssues).
 */
@Serializable
data class SupplierFormsErrorDto(
    val error: String = "",
    val issues: Map<String, List<String>> = emptyMap(),
)

/** Parses a t271 error body with the shared lenient Json instance (parseErrorBody mirror). */
fun parseSupplierFormsError(body: okhttp3.ResponseBody?): SupplierFormsErrorDto {
    val raw = body?.string()
    if (raw.isNullOrBlank()) return SupplierFormsErrorDto()
    return runCatching { ApiClient.json.decodeFromString(SupplierFormsErrorDto.serializer(), raw) }
        .getOrDefault(SupplierFormsErrorDto())
}
