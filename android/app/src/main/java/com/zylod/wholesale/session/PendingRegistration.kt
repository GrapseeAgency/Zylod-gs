package com.zylod.wholesale.session

/**
 * Registration payload carried across the OTP step — port of the web's
 * sessionStorage `zylod-pending-registration` (pending-registration.ts:30-52).
 * Web keeps it session-scoped; native keeps it in-memory for the same lifetime
 * (a process death drops it, and the user re-enters the form — documented
 * deviation from the spec's SavedStateHandle suggestion, accepted because the
 * OTP screen and the register form live in one back stack session).
 */
object PendingRegistration {

    data class Payload(
        val userType: String,
        val fullName: String? = null,
        val businessName: String? = null,
        val email: String? = null,
        val phone: String? = null,
        val password: String? = null,
    )

    @Volatile
    private var payload: Payload? = null

    fun set(value: Payload) {
        payload = value
    }

    fun get(): Payload? = payload

    fun clear() {
        payload = null
    }
}
