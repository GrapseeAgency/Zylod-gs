package com.zylod.wholesale.ui.careers

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CareersApplyBody
import com.zylod.wholesale.data.api.CareerJobRowDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Careers board VM — the record for the native "careers", "careers-page"
 * AND "career-page" pageIds (chunk-misc.ts:408-409 + :290 map all three ids
 * onto the SAME careers-page component, so one pageId-keyed VM class serves
 * the three delegates; each keeps its own instance via the viewModel key).
 *
 * Data truth: GET api/careers (PUBLIC, no rate limit) — every isActive,
 * unexpired jobListings row ordered isFeatured DESC / createdAt DESC, with
 * the server's department stats. The web fetches ONCE with NO params and
 * filters client-side (department chips) — the same one-shot mirror here.
 * Failures degrade to the saved native_careers_cache snapshot with the
 * offline banner, else the web's verbatim error copy + "Try Again".
 *
 * The inline apply flow mirrors the web's job-detail → job-apply pair,
 * which the native shell cannot route to yet (the job-detail / job-apply
 * pageId screens remain seed-only stubs outside this batch): opening the
 * card composes GET api/careers/{slug||id} (the same lookup the web's
 * job-detail page makes) for the Role Overview, and the submit POSTs
 * api/careers/apply with the route's own validation mirrored client-side —
 * ONLY jobId + applicantName + applicantEmail are required (the web form's
 * HTML `required` on phone/resume is stricter than the wire, so the native
 * labels mark those optional). Success/error text is the route's, verbatim:
 * 400 "jobId, applicantName, and applicantEmail are required" / 404 "Job
 * listing not found or no longer accepting applications" / 409 "You have
 * already applied for this position" / 429 the shared Too-many-requests
 * line / 201 message "Application submitted successfully! We will review
 * and be in touch." + the APP-XXXXXXXX ref. Rate limit 5/min. PUBLIC:
 * works signed-out.
 */
class CareersViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(CareersUiState())
    val state: StateFlow<CareersUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var loadJob: Job? = null
    private var detailJob: Job? = null
    private var submitJob: Job? = null

    /** Entry resolve (called on EVERY entry — the web refetches on mount). */
    fun load() {
        _state.update { it.copy(loading = true, error = null, offlineFromCache = false) }
        fetchJobs()
    }

    /** The error card's Retry (same refetch). */
    fun retry() {
        _state.update { it.copy(loading = true, error = null, offlineFromCache = false) }
        fetchJobs()
    }

    /** The web's client-side department filter — no refetch, exactly like the web. */
    fun selectDepartment(department: String) {
        _state.update { it.copy(selectedDepartment = department) }
    }

    private fun fetchJobs() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            try {
                Log.i(TAG, "fetch careers pageId=$pageId")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.careersInvestorApi(base).careers()
                val payload = response.body()
                val data = payload?.data
                    ?.takeIf { response.isSuccessful && payload?.success == true }
                if (data == null) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not load open positions (HTTP ${response.code()})."
                    Log.w(TAG, "careers list error: $message")
                    degrade(message)
                    return@launch
                }
                Log.i(TAG, "careers list loaded jobs=${data.jobs.size} departments=${data.departments.size}")
                _state.update {
                    it.copy(
                        loading = false,
                        jobs = data.jobs,
                        departments = data.departments,
                        error = null,
                    )
                }
                withContext(Dispatchers.IO) {
                    CareersCacheStore.write(
                        appContext,
                        CareersCacheKeys.CAREERS,
                        CachedCareers.serializer(),
                        CachedCareers(jobs = data.jobs, departments = data.departments),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "careers list fetch failed: ${e.message}")
                degrade("Could not load open positions. Check your connection and try again.")
            }
        }
    }

    /** Failure: the saved snapshot with the banner, else the error card. */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            CareersCacheStore.read(appContext, CareersCacheKeys.CAREERS, CachedCareers.serializer())
        }
        val jobs = cached?.jobs.orEmpty()
        if (jobs.isNotEmpty()) {
            Log.i(TAG, "careers degrade → cache jobs=${jobs.size}")
            _state.update {
                it.copy(
                    loading = false,
                    jobs = jobs,
                    departments = cached?.departments.orEmpty(),
                    error = null,
                    offlineFromCache = true,
                )
            }
        } else {
            _state.update { it.copy(loading = false, jobs = emptyList(), error = message) }
        }
    }

    /* ── the inline apply flow ───────────────────────────────────────────── */

    /**
     * Open the apply card for a tapped row (the row's own slug||id lookup
     * key + title) and compose GET api/careers/{key} — the same call the
     * web's job-detail page makes — for the Role Overview block.
     */
    fun openApply(job: CareerJobRowDto) {
        val lookupKey = job.lookupKey
        _state.update {
            it.copy(
                applyJobKey = lookupKey,
                applyJobTitle = job.title.orEmpty(),
                applyDetailLoading = true,
                applyDetail = null,
                applyDetailError = null,
                applicantName = "",
                applicantEmail = "",
                applicantPhone = "",
                applicantResumeUrl = "",
                applicantLinkedInUrl = "",
                applicantYearsExp = "",
                applicantCoverLetter = "",
                submitting = false,
                applySuccessMessage = null,
                applySuccessRef = null,
                applyError = null,
            )
        }
        fetchApplyDetail(lookupKey)
    }

    /** Close/cancel the apply card (the success card's "View Other Openings"). */
    fun closeApply() {
        detailJob?.cancel()
        submitJob?.cancel()
        _state.update {
            it.copy(
                applyJobKey = null,
                applyJobTitle = "",
                applyDetailLoading = false,
                applyDetail = null,
                applyDetailError = null,
                applicantName = "",
                applicantEmail = "",
                applicantPhone = "",
                applicantResumeUrl = "",
                applicantLinkedInUrl = "",
                applicantYearsExp = "",
                applicantCoverLetter = "",
                submitting = false,
                applySuccessMessage = null,
                applySuccessRef = null,
                applyError = null,
            )
        }
    }

    private fun fetchApplyDetail(lookupKey: String) {
        detailJob?.cancel()
        detailJob = viewModelScope.launch {
            try {
                Log.i(TAG, "fetch career job detail key=$lookupKey")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.careersInvestorApi(base).careerJob(lookupKey)
                val payload = response.body()
                val job = payload?.data
                    ?.takeIf { response.isSuccessful && payload?.success == true }
                if (job == null) {
                    // 404 (inactive == phantom) and every other non-2xx: the
                    // route's verbatim error, else the HTTP-code fallback.
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not load this job opening (HTTP ${response.code()})."
                    Log.w(TAG, "career job detail error: $message")
                    _state.update {
                        if (it.applyJobKey == lookupKey) {
                            it.copy(applyDetailLoading = false, applyDetailError = message)
                        } else {
                            it
                        }
                    }
                    return@launch
                }
                Log.i(TAG, "career job detail loaded title=${job.title}")
                _state.update {
                    if (it.applyJobKey == lookupKey) {
                        it.copy(applyDetailLoading = false, applyDetail = job, applyDetailError = null)
                    } else {
                        it
                    }
                }
                withContext(Dispatchers.IO) {
                    CareersCacheStore.write(
                        appContext,
                        CareersCacheKeys.jobDetail(lookupKey),
                        CachedJobDetail.serializer(),
                        CachedJobDetail(job = job),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "career job detail fetch failed: ${e.message}")
                // The detail block is a bonus preview (the row already carries
                // title/department/location); a network miss must not block
                // the submit — the route re-validates the job server-side.
                _state.update {
                    if (it.applyJobKey == lookupKey) {
                        it.copy(
                            applyDetailLoading = false,
                            applyDetailError = "Network error while loading the job details. Check your connection and retry.",
                        )
                    } else {
                        it
                    }
                }
            }
        }
    }

    fun setApplicantName(value: String) = _state.update {
        it.copy(applicantName = value, applyError = null, applySuccessMessage = null, applySuccessRef = null)
    }

    fun setApplicantEmail(value: String) = _state.update {
        it.copy(applicantEmail = value, applyError = null, applySuccessMessage = null, applySuccessRef = null)
    }

    fun setApplicantPhone(value: String) = _state.update { it.copy(applicantPhone = value) }

    fun setApplicantResumeUrl(value: String) = _state.update { it.copy(applicantResumeUrl = value) }

    fun setApplicantLinkedInUrl(value: String) = _state.update { it.copy(applicantLinkedInUrl = value) }

    fun setApplicantYearsExp(value: String) = _state.update { it.copy(applicantYearsExp = value) }

    fun setApplicantCoverLetter(value: String) = _state.update { it.copy(applicantCoverLetter = value) }

    /**
     * Submit — client gate first (the route's own required set: jobId,
     * applicantName, applicantEmail), then ONE wire call (the submitting
     * flag is set before the call and only cleared when it settles, so a
     * double tap can never double-post past the 5/min window).
     */
    fun submitApply() {
        val current = _state.value
        if (current.submitting) return
        val jobKey = current.applyJobKey
        if (jobKey.isNullOrBlank()) return
        val name = current.applicantName.trim()
        val email = current.applicantEmail.trim()
        if (name.isEmpty() || email.isEmpty()) {
            // The route's verbatim 400 text — the same fields it checks.
            _state.update { it.copy(applyError = "jobId, applicantName, and applicantEmail are required") }
            return
        }
        _state.update { it.copy(submitting = true, applyError = null, applySuccessMessage = null, applySuccessRef = null) }
        submitJob?.cancel()
        submitJob = viewModelScope.launch {
            try {
                Log.i(TAG, "careers apply key=$jobKey")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.careersInvestorApi(base).applyToJob(
                    CareersApplyBody(
                        jobId = jobKey,
                        applicantName = name,
                        applicantEmail = email,
                        applicantPhone = current.applicantPhone.trim().takeIf(String::isNotEmpty),
                        resumeUrl = current.applicantResumeUrl.trim().takeIf(String::isNotEmpty),
                        coverLetter = current.applicantCoverLetter.trim().takeIf(String::isNotEmpty),
                        linkedInUrl = current.applicantLinkedInUrl.trim().takeIf(String::isNotEmpty),
                        // The route parseInts a truthy string; a blank or
                        // non-numeric field is sent as ABSENT — the native
                        // form starts empty (the web defaults the field to
                        // "3", which would fabricate experience years).
                        yearsExp = current.applicantYearsExp.trim().toIntOrNull(),
                    ),
                )
                val payload = response.body()
                if (response.isSuccessful && payload?.success == true) {
                    Log.i(TAG, "careers applied ref=${payload?.data?.applicationRef}")
                    _state.update {
                        it.copy(
                            submitting = false,
                            applySuccessMessage = payload?.message
                                ?.takeIf(String::isNotBlank)
                                ?: "Application submitted successfully! We will review and be in touch.",
                            applySuccessRef = payload?.data?.applicationRef,
                            applyError = null,
                        )
                    }
                } else {
                    // 400/404/409/429/500 carry { error } — verbatim.
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: payload?.error?.takeIf(String::isNotBlank)
                        ?: "Application failed. Please try again later."
                    Log.w(TAG, "careers apply error: $message")
                    _state.update { it.copy(submitting = false, applyError = message) }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "careers apply network failed: ${e.message}")
                _state.update {
                    it.copy(
                        submitting = false,
                        applyError = "Network error — could not reach the application service. Check your connection and retry.",
                    )
                }
            }
        }
    }

    private companion object {
        const val TAG = "ZylodCareers"
    }
}

/**
 * Career section VM — the shared, pageId-keyed VM behind the six faithful
 * section screens (career-benefits / career-culture / career-life /
 * career-internships / company-values / company-milestones).
 *
 * Data truth: chunk-misc.ts maps career-internships AND career-life onto
 * the SAME career-culture-page component as career-culture, and
 * career-benefits + company-values onto pure static copy components —
 * those five pageIds fetch NOTHING (loading starts false, the composition
 * is verbatim web copy). ONLY company-milestones composes an endpoint:
 * GET api/about/milestones (PUBLIC, no rate limit) — { success, data:
 * { milestones: [row], years, total } }, isPublished rows ordered year ASC
 * then sortOrder ASC. Failures degrade to the saved native_milestones_cache
 * snapshot with the offline banner, else the honest error card + Retry
 * (the web swallows the failure into an empty timeline; the native surfaces
 * it — never a fake "all quiet" timeline).
 */
class CareerSectionViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(CareerSectionUiState(loading = pageId == MILESTONES_PAGE))
    val state: StateFlow<CareerSectionUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var loadJob: Job? = null

    /** Entry resolve — a no-op refetch for the static sections. */
    fun load() {
        if (pageId != MILESTONES_PAGE) {
            _state.update { it.copy(loading = false) }
            return
        }
        _state.update { it.copy(loading = true, error = null, offlineFromCache = false) }
        fetchMilestones()
    }

    fun retry() {
        if (pageId != MILESTONES_PAGE) {
            _state.update { it.copy(loading = false) }
            return
        }
        _state.update { it.copy(loading = true, error = null, offlineFromCache = false) }
        fetchMilestones()
    }

    private fun fetchMilestones() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            try {
                Log.i(TAG, "fetch milestones pageId=$pageId")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.careersInvestorApi(base).milestones()
                val payload = response.body()
                val data = payload?.data
                    ?.takeIf { response.isSuccessful && payload?.success == true }
                if (data == null) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not load the milestones (HTTP ${response.code()})."
                    Log.w(TAG, "milestones error: $message")
                    degrade(message)
                    return@launch
                }
                Log.i(TAG, "milestones loaded rows=${data.milestones.size}")
                _state.update { it.copy(loading = false, milestones = data.milestones, error = null) }
                withContext(Dispatchers.IO) {
                    CareersCacheStore.write(
                        appContext,
                        CareersCacheKeys.MILESTONES,
                        CachedMilestones.serializer(),
                        CachedMilestones(milestones = data.milestones),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "milestones fetch failed: ${e.message}")
                degrade("Network error while loading the milestones. Check your connection and retry.")
            }
        }
    }

    /** Failure: the saved snapshot with the banner, else the error card. */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            CareersCacheStore.read(appContext, CareersCacheKeys.MILESTONES, CachedMilestones.serializer())
        }
        val milestones = cached?.milestones.orEmpty()
        if (milestones.isNotEmpty()) {
            Log.i(TAG, "milestones degrade → cache rows=${milestones.size}")
            _state.update {
                it.copy(loading = false, milestones = milestones, error = null, offlineFromCache = true)
            }
        } else {
            _state.update { it.copy(loading = false, milestones = emptyList(), error = message) }
        }
    }

    private companion object {
        const val TAG = "ZylodCareers"
        const val MILESTONES_PAGE = "company-milestones"
    }
}
