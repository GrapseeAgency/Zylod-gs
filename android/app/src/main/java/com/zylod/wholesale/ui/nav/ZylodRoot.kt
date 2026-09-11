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
import androidx.compose.runtime.getValue
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
import com.zylod.wholesale.ui.home.HomeScreen
import com.zylod.wholesale.ui.pdp.ProductDetailScreen
import com.zylod.wholesale.ui.web.WebScreen
import com.zylod.wholesale.ui.welcome.WelcomeScreen
import com.zylod.wholesale.ui.welcome.isOnboardingSeen
import com.zylod.wholesale.ui.welcome.markOnboardingSeen

// Same 5 tabs as mobile-bottom-nav.tsx (frozen in ARCHITECTURE.md §3)
private data class TabItem(val id: String, val label: String, val icon: ImageVector, val pageId: String)

private val TABS = listOf(
    TabItem("home", "Home", Icons.Outlined.Home, "home"),
    TabItem("categories", "Categories", Icons.Outlined.GridView, "category-browser"),
    TabItem("deals", "Hot Deals", Icons.Outlined.FlashOn, "flash-deals"),
    TabItem("cart", "Cart", Icons.Outlined.ShoppingCart, "cart"),
    TabItem("profile", "Profile", Icons.Outlined.Person, "profile"),
)

// Alias map ported from mobile-bottom-nav.tsx getActiveId()
private val TAB_ALIASES: Map<String, String> = buildMap {
    putAll(listOf(
        "category-products", "category-browser", "textiles-fabrics", "agriculture-food",
        "electronics", "construction", "packaging", "home-garden", "gifts-crafts",
        "beauty-personal-care", "promotional-items", "garments", "spices",
        "mobile-accessories", "led-lighting", "automotive", "sports-fitness",
        "books-stationery", "toys", "jewelry", "medical-supplies", "furniture",
    ).associateWith { "categories" })
    putAll(listOf("chat-list", "chat-detail", "messages").associateWith { "profile" })
    putAll(listOf("flash-sale", "flash-deals", "daily-deals").associateWith { "deals" })
    putAll(listOf("cart", "checkout").associateWith { "cart" })
    putAll(listOf(
        "profile", "buyer-dashboard", "buyer-orders", "buyer-wishlist", "buyer-settings",
        "buyer-profile", "supplier-dashboard", "supplier-profile", "admin-dashboard",
        "notification-preferences", "privacy-settings", "language-settings",
        "theme-settings", "linked-accounts", "business-profile",
    ).associateWith { "profile" })
}

private fun activeTabFor(pageId: String?): String = when (pageId) {
    null, "home" -> "home"
    else -> TAB_ALIASES[pageId] ?: "home"
}

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
    // the native cart route highlights the cart tab.
    val activeTab = when (route) {
        null, "home" -> "home"
        "cart" -> "cart"
        in FULLSCREEN_ROUTES, "product-detail/{productId}" -> ""
        else -> activeTabFor(webPageId)
    }
    val showBottomBar = route !in FULLSCREEN_ROUTES

    // ── Navigation contract (deterministic, no per-screen special cases) ────
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
    // needed. Native tabs (home/cart) have distinct routes and keep the
    // standard saveState/restoreState pattern.
    val openPage: (String, String) -> Unit = { pageId, query ->
        // params is an optional query argument: a path segment cannot match
        // an empty value, so an empty query must ride in the query string.
        navController.navigate("web/$pageId?params=${Uri.encode(query)}") {
            popUpTo(HOME_ROUTE) { saveState = false }
            launchSingleTop = true
        }
    }

    // Native PDP — a back-bar push (web pushState semantics), no tab highlight.
    val openProductDetail: (String) -> Unit = { productId ->
        navController.navigate("product-detail/${Uri.encode(productId)}")
    }

    // Native callers that only know the web pageId contract (CartScreen taps)
    // get the native PDP when the pageId is product-detail.
    val openPageRouted: (String, String) -> Unit = { pageId, query ->
        if (pageId == "product-detail") {
            val productId = query.substringAfter("productId=", "").substringBefore("&")
            if (productId.isNotBlank()) openProductDetail(productId) else openPage(pageId, query)
        } else {
            openPage(pageId, query)
        }
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

    // Web-initiated navigation rides the SAME contract as the native bar
    // (openPageRouted — product-detail resolves to the native PDP).
    DisposableEffect(Unit) {
        NativeNavBus.openPageHandler = { pageId, params -> openPageRouted(pageId, params) }
        onDispose { NativeNavBus.openPageHandler = null }
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
                        // Home and Cart are NATIVE Tier 1 screens (spec §2.2):
                        // their tabs must route to the native destinations —
                        // routing Home through openPage loaded the web `?page=home`
                        // document (with its own top+bottom chrome) inside the
                        // native shell — the exact duplicate-chrome + jank
                        // surface the owner's audit captured.
                        val nativeDestination = when (tab.id) {
                            "home" -> "home"
                            "cart" -> "cart"
                            else -> null
                        }
                        if (nativeDestination != null) {
                            navController.navigate(nativeDestination) {
                                popUpTo(HOME_ROUTE) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        } else {
                            openPage(tab.pageId, "")
                        }
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
                HomeScreen(
                    navigateToPage = { pageId, query -> openPage(pageId, query) },
                    openProductDetail = { productId -> openProductDetail(productId) },
                )
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
                    openPage = { pageId, query -> openPageRouted(pageId, query) },
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
