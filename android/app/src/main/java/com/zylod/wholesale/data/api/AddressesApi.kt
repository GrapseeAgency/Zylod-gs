package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

/**
 * Addresses surfaces — the REAL endpoints behind the two native address
 * pageIds (t253: address-book + add-address). All four routes were
 * verified against their src/app/api handlers:
 *
 *  - GET api/addresses (addresses/route.ts, Bearer-authenticated): 200
 *    { success, data: [AddressDto] } — the session user's rows ordered
 *    isDefault DESC, label ASC. Every row is serializeAddress's camelCase
 *    shape (the handler ALSO sends snake_case aliases; the shared Json
 *    parser ignores them). A guest gets 401 → the honest sign-in gate,
 *    never a fake empty book.
 *  - POST api/addresses (same file, rate limit 20/min): body fields are
 *    read in BOTH casings; the native client sends the same snake_case
 *    body the web add-address page sends. Required: label, address_line1,
 *    city, postal_code — a miss is 400 with the REAL error text
 *    "Missing required field(s): …" listing the absent fields. Success
 *    201 { success, data: AddressDto }; the FIRST address of an account
 *    auto-becomes default server-side (makeDefault = isDefault || count==0).
 *  - PUT api/addresses/{id} (addresses/[id]/route.ts): same body contract,
 *    404 'Address not found' for a foreign id, 400 when address_line1/city/
 *    postal_code are all missing. Success 200 { success, data: address }
 *    — the RAW db row (camelCase fields; extra columns like createdAt are
 *    ignored by the shared parser).
 *  - DELETE api/addresses/{id} (same file): 404 for a foreign id; success
 *    { success, data: { id, deleted: true } }; the server promotes a
 *    remaining address to default when none is flagged. Declared here for
 *    contract completeness — the native screens port the web pages 1:1 and
 *    those render no delete affordance (deleting lives on the web's
 *    edit-address page).
 */
interface AddressesApi {
    /** GET api/addresses — the session user's address book. */
    @GET("api/addresses")
    suspend fun list(): Response<ApiEnvelope<List<AddressDto>>>

    /** POST api/addresses — create; 201 with the serialized created row. */
    @POST("api/addresses")
    suspend fun create(@Body body: AddressSaveBody): Response<ApiEnvelope<AddressDto>>

    /** PUT api/addresses/{id} — update (only your own address). */
    @PUT("api/addresses/{id}")
    suspend fun update(@Path("id") id: String, @Body body: AddressSaveBody): Response<ApiEnvelope<AddressDto>>

    /** DELETE api/addresses/{id} — delete (only your own address). */
    @DELETE("api/addresses/{id}")
    suspend fun delete(@Path("id") id: String): Response<ApiEnvelope<AddressDeletedDto>>
}

/* ─── address rows ───────────────────────────────────────────────────────── */

/**
 * One address-book row — serializeAddress's camelCase subset the web
 * shipping-address-page maps (label, company/contact names, the two
 * street lines, city/district/postalCode/country, isDefault). Every
 * string is nullable-with-default so shape drift degrades into the row
 * mapper instead of failing the whole book's parse.
 */
@Immutable
@Serializable
data class AddressDto(
    val id: String? = null,
    val userId: String? = null,
    val label: String? = null,
    val companyName: String? = null,
    val contactName: String? = null,
    val contactPhone: String? = null,
    val addressLine1: String? = null,
    val addressLine2: String? = null,
    val city: String? = null,
    val district: String? = null,
    val postalCode: String? = null,
    val country: String? = null,
    val isDefault: Boolean = false,
) {
    /** Stable identity for keyed collections (address id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "address-${hashCode()}"
}

/**
 * Outgoing create/update body — the exact snake_case field set the web
 * pages send (the handlers read both casings; matching the web bytes is
 * the safest contract). Optional strings are omitted (explicitNulls)
 * when blank, mirroring the web `|| undefined` fallbacks.
 */
@Immutable
@Serializable
data class AddressSaveBody(
    val label: String? = null,
    @SerialName("company_name") val companyName: String? = null,
    @SerialName("contact_name") val contactName: String? = null,
    @SerialName("contact_phone") val contactPhone: String? = null,
    @SerialName("address_line1") val addressLine1: String? = null,
    @SerialName("address_line2") val addressLine2: String? = null,
    val city: String? = null,
    val district: String? = null,
    @SerialName("postal_code") val postalCode: String? = null,
    val country: String? = null,
    @SerialName("is_default") val isDefault: Boolean = false,
)

/** DELETE data payload — { id, deleted: true } verbatim. */
@Immutable
@Serializable
data class AddressDeletedDto(
    val id: String? = null,
    val deleted: Boolean = false,
)
