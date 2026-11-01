package com.zylod.wholesale.ui.careers

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.CareerJobRowDto

/**
 * SHARED typed careers board (pageIds "careers", "careers-page" AND
 * "career-page" — the ui/screens delegates call THIS, so each page keeps
 * its own pageId-keyed CareersViewModel).
 *
 * Data truth: careers-page.tsx ported — the web maps all three ids onto
 * the SAME component (chunk-misc.ts:290/408-409), so the three native
 * pageIds render the identical composition under their own top-bar titles.
 * The "We are hiring!" teal hero ("Build the Future of South Asian B2B
 * Wholesale Commerce" + the $40B sub line + the Openings/Hybrid/Top Tier
 * stat row), the Culture & Benefits quick-nav grid (the four faithful
 * section pageIds), the department chip row (client-side filter — the web
 * fetches ONCE with no params, so does this screen) and the job rows:
 * title, department, the Featured badge, location, the employment type
 * uppercased with spaces, the ৳Xk - Yk / mo salary label, the posted date +
 * applicant count footer. Tap → openPage("job-detail") with the "id=" pair
 * — the web's own navigate('job-detail', { id: job.slug || job.id }), and
 * that pageId IS registered natively. The row's Apply affordance opens the
 * INLINE apply card below (the web routes apply through the job-apply
 * page; that pageId's native screen stays a seed-only stub outside this
 * batch, so the same POST api/careers/apply is composed here with the
 * route's validation + verbatim strings mirrored). Honest empty: the web's
 * verbatim "No positions open in this department right now." PUBLIC
 * content — signed-out renders exactly the same board.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CareersScreen(
    pageId: String,
    title: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: CareersViewModel = viewModel(key = "native-careers-$pageId") {
        CareersViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        title,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                    )
                },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(
                                Icons.AutoMirrored.Outlined.ArrowBack,
                                "Go back",
                                tint = MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // The inline apply flow sits ABOVE the board while open (the
            // web renders its apply form as its own page over the board).
            if (state.applyJobKey != null) {
                item(key = "apply") {
                    CareersApplyCard(state = state, vm = vm)
                }
            }

            // Hero (the web's teal gradient card, verbatim copy).
            item(key = "hero") {
                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(24.dp))
                        .padding(20.dp),
                ) {
                    Surface(
                        color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(8.dp),
                    ) {
                        Text(
                            "We are hiring!",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        )
                    }
                    Text(
                        "Build the Future of South Asian B2B Wholesale Commerce",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                        lineHeight = 26.sp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                    Text(
                        "Join a fast-growing team of engineers, designers, and supply chain operators digitizing Bangladesh's \$40B wholesale ecosystem.",
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                        color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.85f),
                    )
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp)
                            .background(
                                MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.15f),
                                RoundedCornerShape(12.dp),
                            )
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                    ) {
                        HeroStat("${state.jobs.size}", "Openings", MaterialTheme.colorScheme.onPrimary)
                        HeroStat("Hybrid", "Work Culture", MaterialTheme.colorScheme.onPrimary)
                        HeroStat("Top Tier", "Compensation", MaterialTheme.colorScheme.onPrimary)
                    }
                }
            }

            // The web's mobile top-bar subtitle, carried into the body.
            item(key = "count-line") {
                Text(
                    "${state.jobs.size} Open Positions in Dhaka & Remote",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (state.offlineFromCache && !state.loading && state.error == null) {
                item(key = "offline") {
                    CareersOfflineBanner("Offline — showing the last saved openings")
                }
            }

            // Culture & Benefits quick-nav (the web's four sub-page buttons).
            item(key = "quick-nav") {
                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(24.dp))
                        .padding(14.dp),
                ) {
                    Text(
                        "Culture & Benefits",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    val links = listOf(
                        Triple("Employee Benefits", "career-benefits", "Career Benefits"),
                        Triple("Our Culture", "career-culture", "Career Culture"),
                        Triple("Internship Program", "career-internships", "Career Internships"),
                        Triple("Life at Zylod", "career-life", "Career Life"),
                    )
                    for (chunk in links.chunked(2)) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            for (link in chunk) {
                                QuickNavLink(
                                    label = link.first,
                                    modifier = Modifier.weight(1f),
                                ) { openPage(link.second, "") }
                            }
                        }
                    }
                }
            }

            // Department filter chips (client-side, exactly like the web).
            if (state.departments.isNotEmpty() || state.jobs.isNotEmpty()) {
                item(key = "dept-chips") {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                    ) {
                        DepartmentChip(
                            label = "All Roles (${state.jobs.size})",
                            selected = state.selectedDepartment == "all",
                            onClick = { vm.selectDepartment("all") },
                        )
                        for (dept in state.departments) {
                            DepartmentChip(
                                label = dept,
                                selected = state.selectedDepartment == dept,
                                onClick = { vm.selectDepartment(dept) },
                            )
                        }
                    }
                }
            }

            when {
                state.loading -> items(count = 4, key = { "skeleton-$it" }) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(120.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant),
                    )
                }
                state.error != null -> item(key = "error") {
                    CareersErrorCard(message = state.error.orEmpty(), onRetry = vm::retry)
                }
                state.filteredJobs.isEmpty() -> item(key = "empty") {
                    CareersEmptyCard(onRetry = vm::retry)
                }
                else -> items(state.filteredJobs, key = { it.stableKey }) { job ->
                    JobRowCard(
                        job = job,
                        onOpen = {
                            // The web's navigate('job-detail', { id: job.slug || job.id });
                            // job-detail IS a registered native pageId.
                            openPage("job-detail", "id=${job.lookupKey}")
                        },
                        onApply = { vm.openApply(job) },
                    )
                }
            }
        }
    }
}

/**
 * The inline apply card — the web's job-apply page, composed here because
 * that pageId's native screen stays a seed-only stub outside this batch.
 * Header ("Apply for Position" + the row's job title), the Role Overview
 * block from GET api/careers/{id} (the same preview the web's job-detail
 * page shows before its Apply button), then the form with the web's exact
 * labels/placeholders — Full Name / Email are the ROUTE's only required
 * fields (the web's HTML `required` on phone/resume is stricter than the
 * wire, so those two carry an honest "optional" on the native labels),
 * LinkedIn, Years of Relevant Experience and the Cover Letter. Submit →
 * POST api/careers/apply; success renders the route's verbatim message +
 * the APP-XXXXXXXX ref with the web's tracking-code sentence; every error
 * status surfaces the server's text verbatim. Replaces the form, exactly
 * like the web's submitted branch.
 */
@Composable
private fun CareersApplyCard(state: CareersUiState, vm: CareersViewModel) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "Apply for Position",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        state.applyJobTitle,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = vm::closeApply) {
                    Icon(
                        Icons.Outlined.Close,
                        "Close the application form",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            when {
                state.applyDetailLoading -> Box(
                    Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                )
                state.applyDetailError != null -> Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(
                        Icons.Outlined.ErrorOutline,
                        null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        state.applyDetailError,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
                state.applyDetail?.descriptionEn?.takeIf(String::isNotBlank) != null -> Column {
                    Text(
                        "Role Overview",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        state.applyDetail?.descriptionEn.orEmpty(),
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
            }

            Spacer(Modifier.height(12.dp))

            if (state.applySuccessRef != null || state.applySuccessMessage != null) {
                // The web's submitted branch (verbatim copy + the REAL ref).
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 12.dp),
                ) {
                    Icon(
                        Icons.Outlined.CheckCircle,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(48.dp),
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "Application Submitted!",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        state.applySuccessMessage.orEmpty(),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Thank you for applying. Your application tracking code is ${state.applySuccessRef.orEmpty()}. Our Talent Acquisition team will contact you within 5 business days.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                    Spacer(Modifier.height(12.dp))
                    Button(
                        onClick = vm::closeApply,
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary,
                        ),
                    ) {
                        Text("View Other Openings", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = state.applicantName,
                        onValueChange = vm::setApplicantName,
                        label = { Text("Full Name *", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                        placeholder = { Text("e.g. Asif Rahman", fontSize = 12.sp) },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = state.applicantEmail,
                        onValueChange = vm::setApplicantEmail,
                        label = { Text("Email Address *", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                        placeholder = { Text("e.g. asif@example.com", fontSize = 12.sp) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = state.applicantPhone,
                        onValueChange = vm::setApplicantPhone,
                        label = { Text("Phone Number (optional)", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                        placeholder = { Text("e.g. +880 1711 000000", fontSize = 12.sp) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = state.applicantResumeUrl,
                        onValueChange = vm::setApplicantResumeUrl,
                        label = {
                            Text("Resume / CV Link (Google Drive / Dropbox) — optional", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        },
                        placeholder = { Text("https://drive.google.com/...", fontSize = 12.sp) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = state.applicantLinkedInUrl,
                        onValueChange = vm::setApplicantLinkedInUrl,
                        label = { Text("LinkedIn Profile URL", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                        placeholder = { Text("https://linkedin.com/in/...", fontSize = 12.sp) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = state.applicantYearsExp,
                        onValueChange = vm::setApplicantYearsExp,
                        label = { Text("Years of Relevant Experience", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = state.applicantCoverLetter,
                        onValueChange = vm::setApplicantCoverLetter,
                        label = { Text("Cover Letter / Note to Hiring Manager", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                        placeholder = { Text("Why are you excited to join Zylod?", fontSize = 12.sp) },
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = { vm.submitApply() }),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth(),
                    )

                    state.applyError?.let { message ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Outlined.ErrorOutline,
                                null,
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(16.dp),
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                message,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.error,
                            )
                        }
                    }

                    Button(
                        onClick = vm::submitApply,
                        enabled = !state.submitting,
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary,
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(46.dp),
                    ) {
                        Icon(
                            Icons.AutoMirrored.Outlined.Send,
                            null,
                            modifier = Modifier.size(16.dp),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            if (state.submitting) "Submitting Application..." else "Submit Application",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }
    }
}

/** One hero stat — the value + the tiny teal label under it. */
@Composable
private fun HeroStat(value: String, label: String, tint: androidx.compose.ui.graphics.Color) {
    Column {
        Text(value, fontSize = 14.sp, fontWeight = FontWeight.Black, color = tint)
        Text(label, fontSize = 10.sp, color = tint.copy(alpha = 0.75f))
    }
}

/** One quick-nav pill (label + chevron) — the web's grid button. */
@Composable
private fun QuickNavLink(label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        shape = RoundedCornerShape(12.dp),
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Text(
                label,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Icon(
                Icons.Outlined.ChevronRight,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(14.dp),
            )
        }
    }
}

/** One department chip — filled when selected, exactly the web's two states. */
@Composable
private fun DepartmentChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        color = if (selected) {
            MaterialTheme.colorScheme.primary
        } else {
            MaterialTheme.colorScheme.surface
        },
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
    ) {
        Text(
            label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = if (selected) {
                MaterialTheme.colorScheme.onPrimary
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant
            },
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
        )
    }
}

/** The web's verbatim empty card ("No positions open in this department right now."). */
@Composable
private fun CareersEmptyCard(onRetry: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
        ) {
            Icon(
                Icons.Outlined.WorkspacePremium,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(40.dp),
            )
            Spacer(Modifier.height(10.dp))
            Text(
                "No positions open in this department right now.",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                "New openings appear here the moment the team publishes them.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 12.dp),
            )
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = onRetry,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            ) {
                Text("Try Again", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/**
 * One job card — title + department + Featured badge, location/type/salary
 * meta row, posted-date + applicants footer, Apply affordance and the
 * View Details chevron. Whole-card tap = the web's row tap.
 */
@Composable
private fun JobRowCard(job: CareerJobRowDto, onOpen: () -> Unit, onApply: () -> Unit) {
    val salary = careersSalaryLabel(job.salaryMin, job.salaryMax)
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onOpen),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(
                        job.title.orEmpty(),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        job.department.orEmpty(),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                if (job.isFeatured) {
                    val warning = com.zylod.wholesale.ui.theme.LocalZylodExtra.current.warning
                    Surface(
                        color = warning.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(6.dp),
                    ) {
                        Text(
                            "Featured",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = warning,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.LocationOn,
                        null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(14.dp),
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        job.location.orEmpty(),
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.Schedule,
                        null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(14.dp),
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        careersEmploymentTypeLabel(job.employmentType),
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                salary?.let {
                    Text(
                        it,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f),
                        RoundedCornerShape(10.dp),
                    )
                    .padding(horizontal = 10.dp, vertical = 6.dp),
            ) {
                Text(
                    "Posted ${careersDateString(job.createdAt, "d MMM yyyy")} · ${job.applicationCount} applicants",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    "Apply",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable(onClick = onApply)
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    "View Details",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Icon(
                    Icons.Outlined.ChevronRight,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(14.dp),
                )
            }
        }
    }
}
