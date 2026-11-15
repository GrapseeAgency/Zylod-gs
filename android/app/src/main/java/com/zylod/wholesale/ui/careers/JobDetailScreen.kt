package com.zylod.wholesale.ui.careers

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CareerJobDetailDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.ui.nav.RouteOwnership.queryParam
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t306 — Job Opening detail (job-detail-page.tsx port, real wire):
 * GET api/careers/[id] through the EXISTING CareersInvestorApi.careerJob —
 * the real title, department, location, employment type, salary band,
 * description/requirements/benefits (plain-text, whitespace-pre-wrap like
 * the web) and the honest not-found/expired wall. "Apply" opens the typed
 * careers rail (the apply flow lives there, exactly like the web's CTA).
 */
enum class JobDetailPhase { LOADING, NOT_FOUND, ERROR, READY }

data class JobDetailUiState(
    val phase: JobDetailPhase = JobDetailPhase.LOADING,
    val errorMsg: String? = null,
    val job: CareerJobDetailDto? = null,
)

class JobDetailViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(JobDetailUiState())
    val state: StateFlow<JobDetailUiState> = _state.asStateFlow()

    fun start(query: String) {
        val jobId = queryParam(query, "jobId").ifBlank { queryParam(query, "id") }
        if (jobId.isBlank()) {
            _state.update { it.copy(phase = JobDetailPhase.NOT_FOUND) }
            return
        }
        _state.update { it.copy(phase = JobDetailPhase.LOADING, errorMsg = null) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.careersInvestorApi(base).careerJob(jobId)
                if (!response.isSuccessful || response.body()?.data == null) {
                    _state.update { it.copy(phase = JobDetailPhase.NOT_FOUND) }
                    return@launch
                }
                _state.update { it.copy(phase = JobDetailPhase.READY, job = response.body()?.data) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(phase = JobDetailPhase.ERROR, errorMsg = "Network error — check your connection and retry.") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JobDetailScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: JobDetailViewModel = viewModel(key = "native-job-detail") {
        JobDetailViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    LaunchedEffect(query) { vm.start(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Job Opening", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
                navigationIcon = {
                    if (onBack != null) IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        when (state.phase) {
            JobDetailPhase.LOADING -> Wall(padding) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("Loading the job opening…", fontSize = 12.sp)
            }
            JobDetailPhase.NOT_FOUND -> Wall(padding) {
                Text("Job opening not found or has expired.", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(14.dp))
                OutlinedButton(onClick = { openPage("careers", "") }) { Text("View open roles", fontWeight = FontWeight.Bold) }
            }
            JobDetailPhase.ERROR -> Wall(padding) {
                Text(state.errorMsg ?: "", fontSize = 13.sp, color = MaterialTheme.colorScheme.error)
                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = { vm.start(query) }) { Text("Retry", fontWeight = FontWeight.Bold) }
            }
            JobDetailPhase.READY -> {
                val job = state.job ?: return@Scaffold
                Column(
                    Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Surface(
                        color = MaterialTheme.colorScheme.surface,
                        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            Surface(shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)) {
                                Text(
                                    job.department ?: "Zylod",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                )
                            }
                            Spacer(Modifier.height(8.dp))
                            Text(job.title ?: "Role", fontSize = 16.sp, fontWeight = FontWeight.Black)
                            Spacer(Modifier.height(6.dp))
                            val facts = listOfNotNull(
                                job.locationType?.replace('_', ' ')?.replaceFirstChar { c -> c.uppercase() },
                                job.location,
                                job.employmentType?.replace('_', ' ')?.replaceFirstChar { c -> c.uppercase() },
                            ).joinToString(" · ")
                            if (facts.isNotBlank()) Text(facts, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            if (job.salaryMin != null && job.salaryMax != null) {
                                val cur = job.currency ?: "BDT"
                                Spacer(Modifier.height(6.dp))
                                Text(
                                    "$cur ${job.salaryMin} – ${job.salaryMax}",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }
                        }
                    }
                    JobSection("About the role", job.descriptionEn)
                    JobSection("Requirements", job.requirementsEn)
                    JobSection("Benefits", job.benefitsEn)
                    Button(
                        onClick = { openPage("careers", "") },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Apply from the careers page", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun JobSection(title: String, body: String?) {
    if (body.isNullOrBlank()) return
    Surface(
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(title.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 8.dp))
            Text(body, fontSize = 12.sp, lineHeight = 18.sp)
        }
    }
}

@Composable
private fun Wall(padding: androidx.compose.foundation.layout.PaddingValues, content: @Composable () -> Unit) {
    Box(
        Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) { content() }
    }
}
