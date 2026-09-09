package com.zylod.wholesale.ui.nav

import android.net.Uri
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
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.zylod.wholesale.ui.home.HomeScreen
import com.zylod.wholesale.ui.web.WebScreen

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

@Composable
fun ZylodRoot() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val route = backStackEntry?.destination?.route
    val webPageId = backStackEntry?.arguments?.getString("pageId")
    val activeTab = if (route == "home") "home" else activeTabFor(webPageId)

    val openPage: (String, String) -> Unit = { pageId, query ->
        navController.navigate("web/$pageId/${Uri.encode(query)}") {
            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = { ZylodBottomBar(activeTab) { tab -> openPage(tab.pageId, "") } },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = "home",
            modifier = Modifier.padding(padding),
        ) {
            composable("home") {
                HomeScreen(navigateToPage = { pageId, query -> openPage(pageId, query) })
            }
            composable("web/{pageId}/{params}") { entry ->
                WebScreen(
                    pageId = entry.arguments?.getString("pageId").orEmpty(),
                    query = entry.arguments?.getString("params").orEmpty(),
                )
            }
        }
    }
}

@Composable
private fun ZylodBottomBar(activeTab: String, onTab: (TabItem) -> Unit) {
    Column {
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f))
        Row(
            modifier = Modifier
                .navigationBarsPadding()
                .fillMaxWidth()
                .height(56.dp)
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
                    Icon(
                        tab.icon,
                        tab.label,
                        tint = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(22.dp),
                    )
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
