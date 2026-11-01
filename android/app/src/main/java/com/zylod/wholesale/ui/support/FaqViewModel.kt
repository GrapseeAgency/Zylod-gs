package com.zylod.wholesale.ui.support

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SupportFaqDto
import com.zylod.wholesale.data.api.SupportFaqVoteBody
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
 * FAQ VM — GET api/support/faqs (SupportPublicApi.faqs) as the payload of
 * record for the native "faq-page" pageId (the web SPA serves this pageId
 * from faq-page.tsx, src/lib/page-chunks). faq-page.tsx ported 1:1:
 *
 *  - CATEGORY REFETCH: the seven fixed pills; selecting one re-fetches
 *    with ?category=<id> and the "all" pill omits the param entirely (the
 *    web's exact URL branch). The entry query's "category=" pair seeds the
 *    initial pill (web pageParams.category || 'all').
 *  - SEARCH is the web's client-side projection over questionEn/answerEn/
 *    questionBn/answerBn (en fields lowercased, bn matched raw).
 *  - LANGUAGE toggle EN⇄BN renders questionBn/answerBn when present,
 *    falling back to the EN fields (web exact ternaries).
 *  - VOTES: POST api/support/faqs/{id}/vote { helpful } through
 *    [vote] — the REAL live-counter endpoint (POST api/support/faqs is
 *    the admin-only FAQ creator no support page calls). Web parity: the
 *    session-only votedMap disables both buttons after one tap, counters
 *    move ONLY on a confirmed 200 (the web swallows vote failures and
 *    keeps its local mark with unchanged counts — mirrored), and the
 *    updated row comes back as data.
 *  - PUBLIC route: no sign-in gate. FAILURE: honest error card + Retry,
 *    or the saved snapshot ("native_support_faq_cache") with the offline
 *    banner. The web's unseeded-DB fallback to the curated in-repo static
 *    dataset (src/lib/faq-content.ts) is deliberately NOT ported — native
 *    has no second dataset to pretend with, so empty renders honestly.
 */
data class FaqRow(
    /** Stable LazyColumn key (faq id, hash fallback). */
    val key: String,
    val id: String,
    val category: String,
    val questionEn: String,
    val questionBn: String?,
    val answerEn: String,
    val answerBn: String?,
    /** Live counters — the Yes button renders "Yes (n)". */
    val helpfulYes: Int,
    val helpfulNo: Int,
)

/** The web categories constant — verbatim ids and EN/BN labels. */
data class FaqCategory(val id: String, val labelEn: String, val labelBn: String)

object FaqCategories {
    const val ALL = "all"
    const val EN = "en"
    const val BN = "bn"
    val ALL_LIST = listOf(
        FaqCategory("all", "All Topics", "সকল বিষয়"),
        FaqCategory("orders", "Orders & MOQs", "অর্ডার ও MOQ"),
        FaqCategory("payments", "Payments & Verification", "পেমেন্ট ও ভেরিফিকেশন"),
        FaqCategory("shipping", "Shipping & Delivery", "ডেলিভারি ও কুরিয়ার"),
        FaqCategory("returns", "Returns & Disputes", "রিটার্ন ও ডিসপুট"),
        FaqCategory("sellers", "Seller & Verification", "সেলার ও ভেরিফিকেশন"),
        FaqCategory("account", "Account & Security", "নিরাপত্তা ও অ্যাকাউন্ট"),
    )
}

data class FaqUiState(
    val loading: Boolean = true,
    /** Selected category pill id (web selectedCategory, default "all"). */
    val category: String = FaqCategories.ALL,
    /** "en" | "bn" (web language, default "en"). */
    val language: String = FaqCategories.EN,
    val searchQuery: String = "",
    val rows: List<FaqRow> = emptyList(),
    /** Accordion — at most one open card (web expandedId). */
    val expandedId: String? = null,
    /** faqId → "yes" | "no" — session-only record (web votedMap). */
    val voted: Map<String, String> = emptyMap(),
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** The visible list came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
) {
    /** The search projection — web filteredFaqs useMemo. */
    val filtered: List<FaqRow>
        get() {
            val q = searchQuery.trim()
            if (q.isEmpty()) return rows
            val lowered = q.lowercase()
            return rows.filter { row ->
                row.questionEn.lowercase().contains(lowered) ||
                    row.answerEn.lowercase().contains(lowered) ||
                    (row.questionBn?.contains(q) == true) ||
                    (row.answerBn?.contains(q) == true)
            }
        }

    /** Web title ternary: bn → "সাধারণ জিজ্ঞাসাসমূহ (FAQ)". */
    val title: String
        get() = if (language == FaqCategories.BN) "সাধারণ জিজ্ঞাসাসমূহ (FAQ)" else "Frequently Asked Questions"
}

class FaqViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(FaqUiState())
    val state: StateFlow<FaqUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchJob: Job? = null

    /** Entry resolve (called on EVERY entry; the query seeds the category). */
    fun load(query: String?) {
        val queriedCategory = categoryFromQuery(query)
        val category = queriedCategory
            ?.takeIf { hint -> FaqCategories.ALL_LIST.any { it.id == hint } }
            ?: FaqCategories.ALL
        // Web parity: every entry / category change re-runs fetchFaqs() —
        // the skeleton replaces the list until the fresh rows land.
        _state.update { it.copy(category = category, loading = true, error = null, offlineFromCache = false) }
        fetch()
    }

    /** Category pill tap (web setSelectedCategory → refetch). */
    fun selectCategory(id: String) {
        if (_state.value.category == id) return
        _state.update { it.copy(category = id, loading = true, error = null, offlineFromCache = false) }
        fetch()
    }

    /** Search input (client-side filter — web setSearchQuery). */
    fun setSearch(query: String) {
        _state.update { it.copy(searchQuery = query) }
    }

    /** EN⇄BN toggle (web setLanguage). */
    fun toggleLanguage() {
        _state.update {
            it.copy(language = if (it.language == FaqCategories.EN) FaqCategories.BN else FaqCategories.EN)
        }
    }

    /** Card tap — open/close the accordion (web setExpandedId ternary). */
    fun toggleExpanded(id: String) {
        _state.update { it.copy(expandedId = if (it.expandedId == id) null else id) }
    }

    /** Retry — re-run the current category's fetch (the error card's button). */
    fun retry() {
        _state.update { it.copy(loading = true, error = null, offlineFromCache = false) }
        fetch()
    }

    /**
     * The helpful vote — web handleVote ported 1:1: one session-only mark
     * per faq (the buttons disable afterwards), the POST carries
     * { helpful }, the live counters move only on a confirmed 200 (from
     * the returned updated row), failures keep the local mark silently.
     */
    fun vote(faqId: String, helpful: Boolean) {
        val current = _state.value
        if (current.voted.containsKey(faqId)) return
        _state.update { it.copy(voted = it.voted + (faqId to if (helpful) "yes" else "no")) }
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.supportPublicApi(base).voteFaq(faqId, SupportFaqVoteBody(helpful))
                val payload = response.body()
                val updated = payload?.data
                if (response.isSuccessful && payload?.success == true && updated != null) {
                    _state.update { state ->
                        state.copy(rows = state.rows.map { row ->
                            if (row.id == faqId) row.copy(helpfulYes = updated.helpfulYes, helpfulNo = updated.helpfulNo)
                            else row
                        })
                    }
                } else {
                    Log.w(TAG, "faq vote failed: HTTP ${response.code()}")
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                // Web parity: the session-only mark stays, counters unchanged.
                Log.w(TAG, "faq vote network failed: ${e.message}")
            }
        }
    }

    private fun fetch() {
        fetchJob?.cancel()
        fetchJob = viewModelScope.launch {
            try {
                val category = _state.value.category
                Log.i(TAG, "fetch faqs pageId=$pageId category=$category")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.supportPublicApi(base)
                    .faqs(category.takeUnless { it == FaqCategories.ALL })
                val payload = response.body()
                if (!response.isSuccessful || payload?.success != true) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not load the FAQs (HTTP ${response.code()})."
                    Log.w(TAG, "faqs error: $message")
                    degrade(message)
                    return@launch
                }
                val rows = payload?.data.orEmpty().map { it.toRow() }
                Log.i(TAG, "faqs loaded rows=${rows.size}")
                _state.update {
                    it.copy(loading = false, rows = rows, error = null, offlineFromCache = false)
                }
                persistCache(payload?.data.orEmpty())
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "faqs fetch failed: ${e.message}")
                degrade("Network error while loading the FAQs. Check your connection and retry.")
            }
        }
    }

    /** Failure path: the saved snapshot with the banner, else the error card. */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            SupportPublicCacheStore.read(appContext, SupportPublicCacheKeys.FAQ, CachedSupportFaqs.serializer())
        }
        val rows = cached?.rows.orEmpty().map { it.toRow() }
        if (rows.isNotEmpty()) {
            Log.i(TAG, "degrade → cache rows=${rows.size}")
            _state.value = _state.value.copy(
                loading = false,
                rows = rows,
                error = null,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    private fun persistCache(rows: List<SupportFaqDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            SupportPublicCacheStore.write(
                appContext,
                SupportPublicCacheKeys.FAQ,
                CachedSupportFaqs.serializer(),
                CachedSupportFaqs(rows = rows),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodSupport"
    }
}

/* ─── mappers + query helper (the web page's exact projections) ──────────── */

/** Wire row → render row (the FAQItem projection the cards consume). */
internal fun SupportFaqDto.toRow() = FaqRow(
    key = stableKey,
    id = id?.takeIf(String::isNotBlank) ?: stableKey,
    category = category?.takeIf(String::isNotBlank) ?: "general",
    questionEn = questionEn.orEmpty(),
    questionBn = questionBn?.takeIf(String::isNotBlank),
    answerEn = answerEn.orEmpty(),
    answerBn = answerBn?.takeIf(String::isNotBlank),
    helpfulYes = helpfulYes,
    helpfulNo = helpfulNo,
)

/** Extracts the entry category from the page's "category=x" query pair. */
fun categoryFromQuery(query: String?): String? =
    query?.trim()
        ?.let { raw -> Regex("(?:^|&)category=([^&]+)").find(raw)?.groupValues?.get(1) }
        ?.takeIf(String::isNotBlank)
