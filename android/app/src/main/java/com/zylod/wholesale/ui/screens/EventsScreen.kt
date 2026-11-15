package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.content.EventsScreen as SharedEventsScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "events"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Events — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object EventsPageMeta : NativePageMeta() {
    override val pageId = "events"
    override val title = "Events"
    override val category = "Company & Legal"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Trade fairs, buyer meetups, and supplier exhibitions across Bangladesh’s wholesale hubs."
    override val tabHint = ""
    override val bullets = listOf(
        "Trade Events & Trade Fairs",
        "Trade fairs and buyer meetups will be announced here. Check back soon.",
        "No events scheduled right now",
    )
    override val related = listOf(
        NativePageLink("contact-us", "Contact Us"),
    )
}

/**
 * t263 — the curated-metadata body is GONE: this pageId is now owned by
 * the typed ui/content implementation. The body is a thin delegation to
 * the shared events screen (pageId-keyed so it keeps its own
 * EventsViewModel) — the REAL GET api/events rows: title, description,
 * the en-GB weekday date + venue, and the per-row Enquire → contact-us
 * (the web's exact navigate). The meta object above and the
 * NativePageRegistry composable signature are unchanged.
 */
@Composable
fun EventsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedEventsScreen(pageId = "events", onBack = onBack, openPage = openPage, query = query)
}
