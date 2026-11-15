package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.careers.JobDetailScreen as TypedJobDetailScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "job-detail".
 *
 * t306 — the t280 WebScreen forward is RETIRED: this pageId is now owned by
 * the typed implementation (GET api/careers/[id]). The body is a thin delegation — the
 * REAL wire the web page renders. The meta keeps its registry identity; the
 * registry signature is unchanged.
 */
data object JobDetailPageMeta : NativePageMeta() {
    override val pageId = "job-detail"
    override val title = "Job Opening"
    override val category = "Company & Content"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Job Opening — GET api/careers/[id] through the existing CareersInvestorApi: the real title, department, location, employment type, salary band and the plain-text description/requirements/benefits blocks, with the honest not-found/expired wall."
    override val tabHint = "home"
    override val bullets = listOf(
        "Real wire — GET api/careers/[id], rendered natively.",
        "Honest states: sign-in gates, verbatim server errors, never fabricated data.",
        "Native ownership: this Kotlin screen owns the job-detail pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("careers", "Careers"),
        NativePageLink("about-us", "About Us"),
        NativePageLink("contact-us", "Contact Us"),
    )
}

/** Delegation only — the shared typed screen owns the rendering and the wire. */
@Composable
fun JobDetailScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    com.zylod.wholesale.ui.careers.JobDetailScreen(onBack = onBack, openPage = openPage, query = query)
}
