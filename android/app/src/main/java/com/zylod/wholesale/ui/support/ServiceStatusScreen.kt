package com.zylod.wholesale.ui.support

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * SHARED typed service-status screen (pageIds system-status +
 * system-health — the ui/screens delegates call THIS with their pageId,
 * so both keep their own ServiceStatusViewModel through the pageId-keyed
 * factory; the web SPA serves both ids from the SAME
 * service-status-page.tsx).
 *
 * Data truth: GET api/app/diagnostics via [ServiceStatusViewModel] — the
 * REAL live probes service-status-page.tsx renders: the four stat cards
 * (Overall Status, API Latency, DB Ping, and the fourth card carrying the
 * payload's REAL activeProductRecords metric), the "Microservices &
 * External Integrations" card with per-service rows (name, response time,
 * status badge), the Re-probe button (a fresh live probe) and the web's
 * "Back to Maintenance Status" jump. The web's STATIC "99.98%" Uptime-SLA
 * card is deliberately replaced by the real diagnostics metric — a number
 * the wire does not carry is never claimed (the t254 honesty rule).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServiceStatusScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: ServiceStatusViewModel = viewModel(key = "native-support-status-$pageId") {
        ServiceStatusViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { StatusTopBar(onBack = onBack) },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                // The web's ghost back button + re-probe header row.
                Text(
                    "Back to Maintenance Status",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .clickable { openPage("maintenance-mode", "") }
                        .padding(horizontal = 4.dp, vertical = 2.dp),
                )
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            "Live Subsystem Health & SLA",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Text(
                            "Real-time health probes and microservice latency metrics",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                    OutlinedButton(
                        onClick = vm::reprobe,
                        enabled = !state.loading,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.padding(start = 8.dp),
                    ) {
                        Icon(Icons.Outlined.Refresh, null, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Re-probe", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }

                when {
                    state.error != null -> SupportErrorCard(
                        message = state.error.orEmpty(),
                        onRetry = vm::reprobe,
                    )
                    state.loading -> StatusSkeleton()
                    else -> {
                        val data = state.data
                        if (data == null) {
                            SupportErrorCard(
                                message = "Live probes are unavailable right now.",
                                onRetry = vm::reprobe,
                            )
                        } else {
                            if (state.offlineFromCache) {
                                SupportOfflineBanner("Offline — showing the last saved probes")
                            }
                            // Stat cards (2x2 grid).
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                                StatCard("Overall Status", data.status.orEmpty(), successTinted = true, modifier = Modifier.weight(1f))
                                StatCard("API Latency", "${data.latencyMs} ms", modifier = Modifier.weight(1f))
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                                StatCard(
                                    "DB Ping",
                                    data.metrics?.let { "${it.databaseLatencyMs} ms" }.orEmpty(),
                                    modifier = Modifier.weight(1f),
                                )
                                StatCard(
                                    "Active Products",
                                    data.metrics?.activeProductRecords?.toString().orEmpty(),
                                    modifier = Modifier.weight(1f),
                                )
                            }

                            // Microservices & External Integrations.
                            Surface(
                                color = MaterialTheme.colorScheme.surfaceContainer,
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Column(Modifier.fillMaxWidth()) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(16.dp),
                                    ) {
                                        Icon(
                                            Icons.Outlined.Public,
                                            null,
                                            tint = MaterialTheme.colorScheme.primary,
                                            modifier = Modifier.size(18.dp),
                                        )
                                        Spacer(Modifier.width(10.dp))
                                        Text(
                                            "Microservices & External Integrations",
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.onSurface,
                                        )
                                    }
                                    val success = LocalZylodExtra.current.success
                                    data.services.forEach { service ->
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(horizontal = 16.dp, vertical = 6.dp),
                                        ) {
                                            Column(Modifier.weight(1f)) {
                                                Text(
                                                    service.serviceName.orEmpty(),
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = MaterialTheme.colorScheme.onSurface,
                                                )
                                                Text(
                                                    "Response time: ${service.responseTimeMs} ms",
                                                    fontSize = 11.sp,
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                )
                                            }
                                            Surface(
                                                color = success.copy(alpha = 0.12f),
                                                shape = RoundedCornerShape(8.dp),
                                            ) {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                                ) {
                                                    Icon(
                                                        Icons.Outlined.CheckCircle,
                                                        null,
                                                        tint = success,
                                                        modifier = Modifier.size(12.dp),
                                                    )
                                                    Spacer(Modifier.width(4.dp))
                                                    Text(
                                                        service.status.orEmpty(),
                                                        fontSize = 10.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = success,
                                                    )
                                                }
                                            }
                                        }
                                    }
                                    Spacer(Modifier.height(8.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/* ─── pieces ─────────────────────────────────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StatusTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Subsystem Diagnostics",
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
            )
        },
        navigationIcon = {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Go back", tint = MaterialTheme.colorScheme.onSurface)
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier, successTinted: Boolean = false) {
    val success = LocalZylodExtra.current.success
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(12.dp),
        modifier = modifier,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 14.dp, horizontal = 8.dp),
        ) {
            Text(
                label,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                value,
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = if (successTinted) success else MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun StatusSkeleton() {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            repeat(2) {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(64.dp),
                ) {}
            }
        }
        Surface(
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(180.dp),
        ) {}
    }
}
