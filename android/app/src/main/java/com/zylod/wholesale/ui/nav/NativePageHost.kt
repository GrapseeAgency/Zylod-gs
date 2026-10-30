package com.zylod.wholesale.ui.nav

import androidx.compose.runtime.Composable

/**
 * t233 — the host behind the single `native/{pageId}` NavHost destination.
 *
 * Looks the pageId up in [NativePageRegistry] and renders its Kotlin screen:
 *  - tab-like pages get onBack = null (bottom bar is the chrome; system Back
 *    pops to Home through the NavHost);
 *  - stack pages get the real back arrow callback;
 *  - an id that is somehow NOT registered falls through to the WebView shell
 *    — the last-resort path, which the native-first resolver normally never
 *    reaches.
 */
@Composable
fun NativePageHost(
    pageId: String,
    query: String,
    onBack: () -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val entry = NativePageRegistry.entryFor(pageId)
    if (entry != null) {
        entry.content(
            if (entry.tabLike) null else onBack,
            openPage,
            query,
        )
    } else {
        com.zylod.wholesale.ui.web.WebScreen(pageId = pageId, query = query)
    }
}
