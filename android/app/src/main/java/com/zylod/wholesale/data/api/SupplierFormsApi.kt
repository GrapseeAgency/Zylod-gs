package com.zylod.wholesale.data.api

import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
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
}
