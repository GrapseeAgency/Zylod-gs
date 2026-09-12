package com.zylod.wholesale.ui.nav

import android.net.Uri
import androidx.compose.runtime.DisposableEffect
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.FlashOn
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.zylod.wholesale.session.PendingRegistration
import com.zylod.wholesale.data.session.SessionManager
import com.zylod.wholesale.ui.auth.AccountSuspendedScreen
import com.zylod.wholesale.ui.auth.ForgotPasswordScreen
import com.zylod.wholesale.ui.auth.LoginScreen
import com.zylod.wholesale.ui.auth.OtpVerificationScreen
import com.zylod.wholesale.ui.auth.RegisterBuyerScreen
import com.zylod.wholesale.ui.auth.RegisterSupplierScreen
import com.zylod.wholesale.ui.auth.ResetPasswordScreen
import com.zylod.wholesale.ui.auth.TwoFactorAuthScreen
import com.zylod.wholesale.ui.cart.CartScreen
import com.zylod.wholesale.ui.cart.CartStore
import com.zylod.wholesale.ui.nav.RouteOwnership.Destination
import com.zylod.wholesale.ui.pdp.ProductDetailScreen
import com.zylod.wholesale.ui.web.WebScreen
import com.zylod.wholesale.ui.welcome.WelcomeScreen
import com.zylod.wholesale.ui.welcome.isOnboardingSeen
import com.zylod.wholesale.ui.welcome.markOnboardingSeen
import com.zylod.wholesale.util.DeepLinkParser
import com.zylod.wholesale.util.ParsedDeepLink

// Same 5 tabs as mobile-bottom-nav.tsx (frozen in ARCHITECTURE.md §3).
// Tab HIGHLIGHT for a given pageId comes from RouteOwnership.activeTabFor —
// the single alias map (was duplicated here as TAB_ALIASES).
private data class TabItem(val id: String, val label: String, val icon: ImageVector, val pageId: String)

private val TABS = listOf(
    TabItem("home", "Home", Icons.Outlined.Home, "home"),
    TabItem("categories", "Categories", Icons.Outlined.GridView, "category-browser"),
    TabItem("deals", "Hot Deals", Icons.Outlined.FlashOn, "flash-deals"),
    TabItem("cart", "Cart", Icons.Outlined.ShoppingCart, "cart"),
    TabItem("profile", "Profile", Icons.Outlined.Person, "profile"),
)

/**
 * Bridge for web-initiated navigation (`window.ZylodNativeBridge.openPage`):
 * when a web page inside a shell must change the NATIVE route (e.g. a legacy
 * web bundle whose bottom bar slipped past chrome suppression), the tap must
 * land in the same navigation contract as the native bottom bar — never in a
 * WebView-internal SPA state that diverges from the shell chrome.
 *
 * [ZylodRoot] installs the handler while it is composed; the host activity
 * forwards bridge calls here. Registered on the main thread only.
 */
object NativeNavBus {
    @Volatile
    internal var openPageHandler: ((pageId: String, params: String) -> Unit)? = null

    /** Called from the bridge thread — always hops to main. */
    fun openPage(pageId: String, params: String) {
        val handler = openPageHandler ?: return
        android.os.Handler(android.os.Looper.getMainLooper()).post { handler(pageId, params) }
    }
}

/**
 * Deep-link intake (round-4: ONE navigation authority). The manifest's only
 * activity is the native shell — intents land here and are consumed by
 * [ZylodRoot] through the SAME [RouteOwnership] resolver as every other
 * entry point. Links that arrive while the welcome gate is up (first run)
 * are HELD until home is on top — nothing may navigate into a gated shell.
 * [tick] is observable so composition re-runs the drain when a link arrives
 * while home is already the active surface.
 */
object DeepLinkBus {
    private val pending = java.util.concurrent.ConcurrentLinkedQueue<ParsedDeepLink>()

    var tick by androidx.compose.runtime.mutableIntStateOf(0)
        private set

    fun open(uri: android.net.Uri?) {
        val parsed = DeepLinkParser.parse(uri) ?: return
        pending.add(parsed)
        tick++
    }

    /** Consumes every held link (call only when the app surface exists). */
    fun drain(): List<ParsedDeepLink> {
        val out = mutableListOf<ParsedDeepLink>()
        while (true) out.add(pending.poll() ?: break)
        return out
    }
}

/** The tab root every bottom-bar navigation pops up to (see openPage KDoc). */
private const val HOME_ROUTE = "home"

// Native fullscreen routes (web FULLSCREEN_PAGES) — the bottom bar is hidden.
private val FULLSCREEN_ROUTES = setOf(
    "welcome", "login", "register-buyer", "register-supplier", "forgot-password",
    "reset-password/{token}", "two-factor/{userId}",
    "otp/{flow}/{target}", "suspended/{reason}/{reference}/{suspendedAt}?email={email}",
)

@Composable
fun ZylodRoot() {
    val context = LocalContext.current
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val route = backStackEntry?.destination?.route
    val webPageId = backStackEntry?.arguments?.getString("pageId")
    val cartState by CartStore.state.collectAsStateWithLifecycle()

    // First-run gate (web AppEntry: mobile first-run → welcome).
    val startDestination = remember { if (isOnboardingSeen(context)) "home" else "welcome" }

    // Native fullscreen routes and the back-bar product page highlight no tab;
    // the native cart route highlights the cart tab. Web-surface highlights
    // come from RouteOwnership.activeTabFor (the single alias map).
    val activeTab = when (route) {
        null, "home" -> "home"
        "cart" -> "cart"
        in FULLSCREEN_ROUTES, "product-detail/{productId}" -> ""
        else -> RouteOwnership.activeTabFor(webPageId)
    }
    val showBottomBar = route !in FULLSCREEN_ROUTES

    // ── Navigation contract (round-4: ONE navigation authority) ────────────
    //
    // EVERY entry point — the native bottom bar, web-initiated `openPage`
    // (NativeNavBus), Home quick-access tiles, Cart links, PDP links and
    // deep links (DeepLinkBus) — funnels through RouteOwnership.resolve()
    // and [navigateResolved] below. There are NO per-screen special cases:
    // "if pageId == x, open y" logic is forbidden outside the ownership
    // table, and no pageId is owned by both Compose and the WebView.
    //
    // popUpTo targets the HOME ROUTE — not graph.findStartDestination(). The
    // graph's start destination is "welcome" on first run and is popped
    // INCLUSIVELY by the guest flow, so an id-based popUpTo silently no-ops
    // for the app's entire post-onboarding lifetime (saveState/restoreState
    // never engaged and web destinations stacked unboundedly). "home" is the
    // tab root and is always on the stack once onboarding completes.
    //
    // Tier-3 pages all share ONE generic destination ("web/{pageId}"), so
    // saveState/restoreState would couple unrelated tabs (the saved state of
    // destination web/{pageId} would leak args across Categories/Deals/Profile).
    // Tab state restoration is the POOLED SHELL's job: the warm WebView
    // re-attaches and soft-navigates client-side — no Compose state restore
    // needed. The home tab route is likewise a shell-rendered root (home →
    // WEBVIEW, owner directive); Cart is the only fully native tab and keeps
    // the standard saveState/restoreState pattern.
    val navigateResolved: (Destination) -> Unit = { destination ->
        when (destination) {
            is Destination.Home ->
                navController.navigate(HOME_ROUTE) {
                    popUpTo(HOME_ROUTE) { saveState = true }
                    launchSingleTop = true
                    restoreState = true
                }
            is Destination.Cart ->
                navController.navigate("cart") {
                    popUpTo(HOME_ROUTE) { saveState = true }
                    launchSingleTop = true
                    restoreState = true
                }
            is Destination.Product ->
                navController.navigate("product-detail/${Uri.encode(destination.productId)}")
            is Destination.Auth ->
                navController.navigate(destination.route) { launchSingleTop = true }
            is Destination.Web ->
                // params is an optional query argument: a path segment cannot
                // match an empty value, so an empty query rides the query string.
                navController.navigate(
                    "web/${Uri.encode(destination.pageId)}?params=${Uri.encode(destination.query)}",
                ) {
                    popUpTo(HOME_ROUTE) { saveState = false }
                    launchSingleTop = true
                }
        }
    }

    // THE one navigation entry point. Guest-profile parity: the resolver
    // decides — an unauthenticated Profile request opens native login, the
    // same behavior as the web bar in a browser.
    val openPage: (String, String) -> Unit = { pageId, query ->
        navigateResolved(
            RouteOwnership.resolve(pageId, query, isAuthenticated = SessionManager.token() != null),
        )
    }

    // Post-auth landing: home replaces the whole auth stack (no back into
    // login, no back into welcome). Popping the graph id inclusively is the
    // one deterministic way to guarantee a fresh [home] root — the start
    // destination may itself be "welcome" (first run) and a route-based
    // popUpTo("home") would no-op when no home entry exists yet.
    val goHomeAfterAuth: () -> Unit = {
        navController.navigate(HOME_ROUTE) {
            popUpTo(navController.graph.id) { inclusive = true }
            launchSingleTop = true
        }
    }

    // Web-initiated navigation rides the SAME contract as the native bar.
    DisposableEffect(Unit) {
        NativeNavBus.openPageHandler = { pageId, params -> openPage(pageId, params) }
        onDispose { NativeNavBus.openPageHandler = null }
    }

    // Deep links are consumed only when the app surface exists: the welcome
    // gate (first run) must not be skipped by a cold-start link, and nothing
    // may navigate behind it. The tick re-runs this when a link arrives
    // while home is already the top surface.
    val deepLinkTick = DeepLinkBus.tick
    LaunchedEffect(route, deepLinkTick) {
        if (route == HOME_ROUTE) {
            DeepLinkBus.drain().forEach { link ->
                val query = link.params.entries.joinToString("&") { (k, v) ->
                    "${Uri.encode(k)}=${Uri.encode(v)}"
                }
                openPage(link.targetPage, query)
            }
        }
    }

    fun backToLogin() {
        if (!navController.popBackStack("login", inclusive = false)) {
            navController.navigate("login") { launchSingleTop = true }
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            if (showBottomBar) {
                ZylodBottomBar(
                    activeTab = activeTab,
                    cartBadge = cartState.items.size,
                    onTab = { tab ->
                        // THE contract: tab taps go through the SAME resolver as
                        // every other entry point. RouteOwnership decides native
                        // (home/cart) vs WebView — no per-tab special cases.
                        openPage(tab.pageId, "")
                    },
                )
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier = Modifier.padding(padding),
        ) {
            composable(HOME_ROUTE) {
                // OWNER DIRECTIVE — home → WEBVIEW (native Home terminated).
                // Exactly ONE Home: the home tab root renders the WebView
                // shell through the SAME provenance contract as every other
                // pageId — verified endpoint → verified bundle identity →
                // ?page=home → SPA-confirmed pageId=home → reveal. No stale
                // Home pixels, no Home fallback. The former native
                // HomeScreen/HomeViewModel are quarantined
                // (android/quarantine/native-home) and NOT part of this graph.
                WebScreen(pageId = "home", query = "")
            }
            composable(
                route = "web/{pageId}?params={params}",
                arguments = listOf(
                    navArgument("pageId") { type = NavType.StringType },
                    navArgument("params") { type = NavType.StringType; defaultValue = "" },
                ),
            ) { entry ->
                WebScreen(
                    pageId = entry.arguments?.getString("pageId").orEmpty(),
                    query = entry.arguments?.getString("params").orEmpty(),
                )
            }
            composable("cart") {
                CartScreen(
                    onBack = null, // tab destination — no back bar
                    openPage = { pageId, query -> openPage(pageId, query) },
                    openAuth = { navController.navigate("login") { launchSingleTop = true } },
                )
            }
            composable("product-detail/{productId}") { entry ->
                ProductDetailScreen(
                    productId = entry.arguments?.getString("productId").orEmpty(),
                    onBack = { navController.popBackStack() },
                    openPage = { pageId, query -> openPage(pageId, query) },
                )
            }

            // ── Auth suite (web FULLSCREEN_PAGES) ──
            composable("welcome") {
                WelcomeScreen(
                    onCreateBuyerAccount = { navController.navigate("register-buyer") { launchSingleTop = true } },
                    onSignIn = { navController.navigate("login") { launchSingleTop = true } },
                    onContinueAsGuest = {
                        markOnboardingSeen(context)
                        navController.navigate("home") {
                            popUpTo("welcome") { inclusive = true }
                            launchSingleTop = true
                        }
                    },
                )
            }
            composable("login") {
                LoginScreen(
                    onAuthenticated = goHomeAfterAuth,
                    onTwoFactor = { userId ->
                        navController.navigate("two-factor/${Uri.encode(userId)}") { launchSingleTop = true }
                    },
                    onSuspended = { reason, reference, suspendedAt, email ->
                        navController.navigate(
                            "suspended/${Uri.encode(reason)}/${Uri.encode(reference)}/${Uri.encode(suspendedAt)}?email=${Uri.encode(email)}",
                        ) { launchSingleTop = true }
                    },
                    onForgotPassword = { navController.navigate("forgot-password") { launchSingleTop = true } },
                    onRegisterBuyer = { navController.navigate("register-buyer") { launchSingleTop = true } },
                    onRegisterSupplier = { navController.navigate("register-supplier") { launchSingleTop = true } },
                    onHelp = { openPage("help-center", "") },
                )
            }
            composable("register-buyer") {
                RegisterBuyerScreen(
                    onOtpSent = { _ ->
                        // The OTP screen re-derives the target from the pending
                        // registration payload (RegisterBuyerScreen stores it).
                        val pending = PendingRegistration.get()
                        val target = pending?.phone ?: pending?.email ?: ""
                        navController.navigate("otp/register/${Uri.encode(target)}") { launchSingleTop = true }
                    },
                    onLogin = { backToLogin() },
                )
            }
            composable("register-supplier") {
                RegisterSupplierScreen(
                    onAuthenticated = goHomeAfterAuth,
                    onLogin = { backToLogin() },
                )
            }
            composable(
                route = "otp/{flow}/{target}",
                arguments = listOf(
                    navArgument("flow") { type = NavType.StringType },
                    navArgument("target") { type = NavType.StringType },
                ),
            ) { entry ->
                OtpVerificationScreen(
                    flow = entry.arguments?.getString("flow").orEmpty(),
                    target = entry.arguments?.getString("target").orEmpty(),
                    onCompletedRegister = goHomeAfterAuth,
                    onRegisterFailed = {
                        // Back to the register form (payload was cleared on failure).
                        if (!navController.popBackStack("register-buyer", inclusive = false)) {
                            navController.navigate("register-buyer") { launchSingleTop = true }
                        }
                    },
                    onCompletedLogin = goHomeAfterAuth,
                    onResetToken = { token ->
                        navController.navigate("reset-password/${Uri.encode(token)}") { launchSingleTop = true }
                    },
                    onBack = { navController.popBackStack() },
                )
            }
            composable("forgot-password") {
                ForgotPasswordScreen(
                    onProceedToOtp = { email ->
                        navController.navigate("otp/reset/${Uri.encode(email)}") { launchSingleTop = true }
                    },
                    onBack = { navController.popBackStack() },
                )
            }
            composable(
                route = "reset-password/{token}",
                arguments = listOf(navArgument("token") { type = NavType.StringType }),
            ) { entry ->
                ResetPasswordScreen(
                    resetToken = entry.arguments?.getString("token").orEmpty(),
                    onSuccess = {
                        Toast.makeText(
                            context,
                            "Password reset successful — please sign in with your new password",
                            Toast.LENGTH_LONG,
                        ).show()
                        // popUpTo login inclusive clears forgot/otp/reset from the stack.
                        navController.navigate("login") {
                            popUpTo("login") { inclusive = true }
                            launchSingleTop = true
                        }
                    },
                    onBack = { navController.popBackStack() },
                )
            }
            composable(
                route = "two-factor/{userId}",
                arguments = listOf(navArgument("userId") { type = NavType.StringType }),
            ) { entry ->
                TwoFactorAuthScreen(
                    userId = entry.arguments?.getString("userId").orEmpty(),
                    onAuthenticated = goHomeAfterAuth,
                    onSuspended = { reason, reference, suspendedAt ->
                        navController.navigate(
                            "suspended/${Uri.encode(reason)}/${Uri.encode(reference)}/${Uri.encode(suspendedAt)}",
                        ) { launchSingleTop = true }
                    },
                    onCancel = { navController.popBackStack() },
                )
            }
            composable(
                route = "suspended/{reason}/{reference}/{suspendedAt}?email={email}",
                arguments = listOf(
                    navArgument("reason") { type = NavType.StringType },
                    navArgument("reference") { type = NavType.StringType },
                    navArgument("suspendedAt") { type = NavType.StringType },
                    navArgument("email") { type = NavType.StringType; defaultValue = "" },
                ),
            ) { entry ->
                AccountSuspendedScreen(
                    email = entry.arguments?.getString("email").orEmpty(),
                    reason = entry.arguments?.getString("reason").orEmpty(),
                    reference = entry.arguments?.getString("reference").orEmpty(),
                    suspendedAt = entry.arguments?.getString("suspendedAt").orEmpty(),
                    onSignOut = { backToLogin() },
                )
            }
        }
    }
}

@Composable
private fun ZylodBottomBar(activeTab: String, cartBadge: Int, onTab: (TabItem) -> Unit) {
    Column {
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f))
        Row(
            modifier = Modifier
                .navigationBarsPadding()
                .fillMaxWidth()
                .height(64.dp) // frozen token: design-tokens.md §3 (was 56dp — D5 fix)
                .background(MaterialTheme.colorScheme.background),
        ) {
            TABS.forEach { tab ->
                val active = tab.id == activeTab
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .clickable { onTab(tab) }
                        .padding(vertical = 4.dp),
                ) {
                    Box(Modifier.width(16.dp).height(2.dp)) {
                        if (active) {
                            Box(Modifier.fillMaxWidth().height(2.dp).background(MaterialTheme.colorScheme.primary))
                        }
                    }
                    Spacer(Modifier.height(3.dp))
                    Box {
                        Icon(
                            tab.icon,
                            tab.label,
                            tint = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(22.dp),
                        )
                        // Cart tab badge — distinct items, 99+ cap (§3.10).
                        if (tab.id == "cart" && cartBadge > 0) {
                            Text(
                                if (cartBadge > 99) "99+" else cartBadge.toString(),
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onPrimary,
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .background(MaterialTheme.colorScheme.primary, androidx.compose.foundation.shape.CircleShape)
                                    .padding(horizontal = 3.dp),
                            )
                        }
                    }
                    Text(
                        tab.label,
                        fontSize = 10.sp,
                        fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium,
                        color = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
