package com.zylod.wholesale.ui.careers

import android.content.Context
import android.util.Log
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CareerJobDetailDto
import com.zylod.wholesale.data.api.CareerJobRowDto
import com.zylod.wholesale.data.api.InvestorDocDto
import com.zylod.wholesale.data.api.MilestoneDto
import kotlinx.serialization.KSerializer
import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/**
 * Typed shared models for the t264 careers / company / investor surfaces
 * (careers / careers-page / career-page / career-benefits / career-culture /
 * career-life / career-internships / company-milestones / company-values /
 * investor-relations / investor-presentation / investor-contact): the
 * SharedPreferences cache keys + store, the per-screen UI states, and the
 * pure mappers the screens render through.
 *
 * ALL twelve pageIds are PUBLIC content — no sign-in gate, no auth branch
 * (the web serves every one of them to guests, so the native screens do
 * too). The caches follow the t255 SupportPublicCacheStore idiom: the SAME
 * "zylod_config" prefs file the rest of the shell uses, one key per
 * payload, corrupt entries read as absent, failures never throw.
 */

/** The device-saved careers/investor payload keys — SharedPreferences "zylod_config". */
internal object CareersCacheKeys {
    const val PREFS = "zylod_config"
    const val CAREERS = "native_careers_cache"
    const val INVESTOR = "native_investor_cache"
    const val MILESTONES = "native_milestones_cache"

    /**
     * Per-lookup detail keys: "native_job_detail_cache_<slug-or-id>" — the
     * web looks jobs up by slug || id (careers-page row → job-detail), so
     * the cache key uses the SAME lookup key the wire call used.
     */
    const val JOB_DETAIL_PREFIX = "native_job_detail_cache_"

    fun jobDetail(lookupKey: String) = "$JOB_DETAIL_PREFIX$lookupKey"
}

/** careers / careers-page / career-page snapshot — the raw wire rows + dept chips. */
@kotlinx.serialization.Serializable
internal data class CachedCareers(
    val jobs: List<CareerJobRowDto> = emptyList(),
    val departments: List<String> = emptyList(),
)

/** Inline-apply job-detail snapshot (stored under its own lookup key). */
@kotlinx.serialization.Serializable
internal data class CachedJobDetail(val job: CareerJobDetailDto? = null)

/** investor-relations snapshot — the fetched published documents. */
@kotlinx.serialization.Serializable
internal data class CachedInvestorDocs(val documents: List<InvestorDocDto> = emptyList())

/** company-milestones snapshot — the published timeline rows. */
@kotlinx.serialization.Serializable
internal data class CachedMilestones(val milestones: List<MilestoneDto> = emptyList())

/** Generic typed prefs store (SupportPublicCacheStore clone, careers keys). */
internal object CareersCacheStore {
    private const val TAG = "ZylodCareers"

    fun <T> read(context: Context, key: String, serializer: KSerializer<T>): T? = runCatching {
        val raw = context.getSharedPreferences(CareersCacheKeys.PREFS, Context.MODE_PRIVATE)
            .getString(key, null) ?: return null
        ApiClient.json.decodeFromString(serializer, raw)
    }.onFailure { Log.w(TAG, "careers cache read failed: ${it.message}") }.getOrNull()

    fun <T> write(context: Context, key: String, serializer: KSerializer<T>, value: T) {
        runCatching {
            val raw = ApiClient.json.encodeToString(serializer, value)
            context.getSharedPreferences(CareersCacheKeys.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(key, raw)
                .apply()
            // t279 — per-lookup detail keys grow unbounded; keep the newest 12.
            if (key.startsWith(CareersCacheKeys.JOB_DETAIL_PREFIX)) {
                com.zylod.wholesale.util.CacheTrim.trim(context, CareersCacheKeys.JOB_DETAIL_PREFIX)
            }
        }.onFailure { Log.w(TAG, "careers cache write failed: ${it.message}") }
    }
}

/* ─── wire → screen mappers (pure Kotlin) ────────────────────────────────── */

/**
 * The web's exact employment-type row label:
 * employmentType.replace('_', ' ').toUpperCase() ("full_time" → "FULL TIME").
 */
internal fun careersEmploymentTypeLabel(employmentType: String?): String =
    employmentType?.replace('_', ' ')?.uppercase(Locale.US).orEmpty()

/**
 * The web's exact salary label — rendered whenever salaryMin is truthy, as
 * `৳{(min/1000).toFixed(0)}k - {((salaryMax ?? 0)/1000).toFixed(0)}k / mo`
 * (a row with a min but no max shows "0k" on the web too; mirrored, not
 * "fixed"). Null when there is no salaryMin — the label is absent then,
 * never fabricated.
 */
internal fun careersSalaryLabel(min: Int?, max: Int?): String? {
    if (min == null || min <= 0) return null
    val low = String.format(Locale.US, "%.0f", min / 1000.0)
    val high = String.format(Locale.US, "%.0f", (max ?: 0) / 1000.0)
    return "৳${low}k - ${high}k / mo"
}

/**
 * The investor-relations doc badge — the web's exact
 * `{docType.replace('_',' ')}{fiscalYear ? ` · ${fiscalYear}` : ''}`.
 */
internal fun investorBadgeLabel(doc: InvestorDocDto): String {
    val type = doc.docType?.replace('_', ' ').orEmpty()
    val year = doc.fiscalYear?.takeIf(String::isNotBlank)
    return if (year != null) "$type · $year" else type
}

/**
 * The milestones month badge — the web's monthLabel(): only months 1..12
 * render, as the English long month name ("March 2024"); an absent or out-
 * of-range month degrades to the bare year (both honest server data).
 */
internal fun careersMonthLabel(month: Int?, year: Int): String {
    if (month == null || month < 1 || month > 12) return year.toString()
    val calendar = Calendar.getInstance().apply { set(2000, month - 1, 1) }
    return "${SimpleDateFormat("MMMM", Locale.ENGLISH).format(calendar.time)} $year"
}

/**
 * Wire ISO timestamp → the web's en-GB display strings (the investor doc
 * footer's toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
 * is "MMM yyyy"; the careers posted line uses "d MMM yyyy"). Unparseable
 * input renders the raw string — never a fabricated stand-in for a date
 * the payload did carry.
 */
internal fun careersDateString(iso: String?, pattern: String): String {
    if (iso.isNullOrBlank()) return ""
    return try {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val parsed = parser.parse(iso.take(19))
        if (parsed == null) iso else SimpleDateFormat(pattern, Locale.ENGLISH).format(parsed)
    } catch (_: ParseException) {
        iso
    }
}

/* ─── per-screen UI states ───────────────────────────────────────────────── */

/** careers / careers-page / career-page state (one VM per pageId). */
data class CareersUiState(
    val loading: Boolean = true,
    val jobs: List<CareerJobRowDto> = emptyList(),
    /** The server's department stat keys — the web's chip row source. */
    val departments: List<String> = emptyList(),
    /** 'all' or one of [departments] — the web's client-side filter. */
    val selectedDepartment: String = "all",
    /** Fetch failure with nothing renderable (error card + Try Again). */
    val error: String? = null,
    /** The visible payload came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
    /* ── the inline apply flow (the web's job-apply page, inlined because
       the native job-apply pageId screen stays a seed-only stub) ── */
    /** slug-or-id of the tapped row's job; non-null opens the apply card. */
    val applyJobKey: String? = null,
    /** The row's own title (carried — the wire detail may 404 a stale job). */
    val applyJobTitle: String = "",
    val applyDetailLoading: Boolean = false,
    val applyDetail: CareerJobDetailDto? = null,
    /** Detail-route failure text (the verbatim 404 / HTTP / network line). */
    val applyDetailError: String? = null,
    val applicantName: String = "",
    val applicantEmail: String = "",
    val applicantPhone: String = "",
    val applicantResumeUrl: String = "",
    val applicantLinkedInUrl: String = "",
    val applicantYearsExp: String = "",
    val applicantCoverLetter: String = "",
    /** POST in flight — the submit button's disabled state. */
    val submitting: Boolean = false,
    /** 201 resolve — the route's verbatim message + the APP-XXXXXXXX ref. */
    val applySuccessMessage: String? = null,
    val applySuccessRef: String? = null,
    /** 400/404/409/429/500 server text verbatim, or the client gate line. */
    val applyError: String? = null,
) {
    /** The web's exact client-side department filter (selectedDept === 'all'). */
    val filteredJobs: List<CareerJobRowDto>
        get() = if (selectedDepartment == "all") {
            jobs
        } else {
            jobs.filter { it.department == selectedDepartment }
        }
}

/**
 * career-benefits / career-culture / career-life / career-internships /
 * company-values / company-milestones state. The five static sections
 * never fetch (the web components are pure copy); only company-milestones
 * composes GET api/about/milestones, so [loading] only ever starts true
 * for that pageId.
 */
data class CareerSectionUiState(
    val loading: Boolean = false,
    val milestones: List<MilestoneDto> = emptyList(),
    val error: String? = null,
    val offlineFromCache: Boolean = false,
)

/** investor-relations / investor-presentation state (one VM per pageId). */
data class InvestorUiState(
    val loading: Boolean = true,
    val documents: List<InvestorDocDto> = emptyList(),
    /**
     * Owner-published support.email (GET api/settings/public) or "" —
     * the hero/empty copy branches on it exactly like the web hook, and
     * stays SILENT when the value is missing (honest absence).
     */
    val supportEmail: String = "",
    val error: String? = null,
    val offlineFromCache: Boolean = false,
)

/** investor-contact state — the IR inquiry POST-only twin. */
data class InvestorContactUiState(
    val name: String = "",
    val email: String = "",
    val company: String = "",
    /** The web select's default — 'general'. */
    val inquiryType: String = "general",
    val message: String = "",
    /** Owner-published support.email or "" (the success card's urgent line). */
    val supportEmail: String = "",
    /** POST in flight — the submit button's disabled state. */
    val submitting: Boolean = false,
    /** 201 resolve — the route's verbatim message + the IR-XXXXXXXX ref. */
    val successMessage: String? = null,
    val successRef: String? = null,
    /** 400/429/500 server text verbatim, or the client gate line. */
    val error: String? = null,
)

/* ─── shared small composables (careers-scoped names, one definition) ────── */

/**
 * Error card with Retry — the t255 SupportErrorCard idiom, careers-scoped
 * so ui/careers stays self-contained (distinct name, same visual language).
 */
@Composable
internal fun CareersErrorCard(message: String, onRetry: () -> Unit) {
    val error = MaterialTheme.colorScheme.error
    Surface(
        color = error.copy(alpha = 0.08f),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, error.copy(alpha = 0.25f), RoundedCornerShape(14.dp)),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.ErrorOutline, null, tint = error, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = error,
                )
            }
            Button(
                onClick = onRetry,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = error,
                    contentColor = MaterialTheme.colorScheme.onError,
                ),
                modifier = Modifier
                    .padding(top = 12.dp)
                    .fillMaxWidth()
                    .height(36.dp),
            ) {
                Text("Retry", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** Amber banner over a cached snapshot (SupportOfflineBanner's twin). */
@Composable
internal fun CareersOfflineBanner(text: String) {
    val warning = com.zylod.wholesale.ui.theme.LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(Icons.Outlined.CloudOff, null, tint = warning, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(text, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface)
        }
    }
}
