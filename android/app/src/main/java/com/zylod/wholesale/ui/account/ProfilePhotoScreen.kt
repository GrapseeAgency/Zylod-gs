package com.zylod.wholesale.ui.account

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AddAPhoto
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kotlinx.coroutines.delay

/**
 * t280 — typed profile-photo screen (profile-photo-page port: 128px circular
 * preview, Upload New Photo via the visual media picker, Remove, honest
 * limits footer). Registry delegation lives in ui/screens/ProfilePhotoScreen.kt.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfilePhotoScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: ProfilePhotoViewModel = viewModel(
        key = "native-profile-photo",
    ) { ProfilePhotoViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()

    var toast by remember { mutableStateOf<String?>(null) }
    var lastToasted by remember { mutableIntStateOf(0) }
    LaunchedEffect(state.savedTick) {
        if (state.savedTick > lastToasted) {
            lastToasted = state.savedTick
            toast = "Photo updated successfully!"
        }
    }
    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2500)
            toast = null
        }
    }

    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri ->
        if (uri != null) vm.upload(uri)
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Profile Photo", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            when {
                state.needsAuth -> {
                    PhotoWall("Your session ended — sign in to manage your photo.", "Sign in") { openPage("login", "") }
                    return@Column
                }
                state.loading -> {
                    Spacer(Modifier.height(48.dp))
                    CircularProgressIndicator()
                    Spacer(Modifier.height(12.dp))
                    Text("Loading your profile…", fontSize = 12.sp)
                    return@Column
                }
                state.error != null -> {
                    PhotoWall(state.error ?: "Could not load your profile", "Retry") { vm.refresh() }
                    return@Column
                }
            }

            if (toast != null) {
                Surface(
                    color = MaterialTheme.colorScheme.secondaryContainer,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                ) {
                    Text(
                        toast ?: "",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                    )
                }
            }

            Spacer(Modifier.height(24.dp))

            // 128dp circular preview (web :142-152).
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier.size(128.dp),
            ) {
                if (state.avatarUrl != null) {
                    AsyncImage(
                        model = state.avatarUrl,
                        contentDescription = "Your profile photo",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            Icons.Outlined.Person,
                            contentDescription = "No profile photo",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(56.dp),
                        )
                    }
                }
            }

            Spacer(Modifier.height(24.dp))

            Button(
                onClick = {
                    picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                },
                enabled = !state.uploading,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) {
                if (state.uploading) {
                    CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                    Spacer(Modifier.width(8.dp))
                    Text("Uploading Photo…", fontSize = 12.sp, fontWeight = FontWeight.Black)
                } else {
                    Icon(Icons.Outlined.AddAPhoto, null, Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Upload New Photo", fontSize = 12.sp, fontWeight = FontWeight.Black)
                }
            }

            if (state.avatarUrl != null) {
                Spacer(Modifier.height(10.dp))
                OutlinedButton(
                    onClick = { vm.remove() },
                    enabled = !state.removing && !state.uploading,
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                    modifier = Modifier.fillMaxWidth().height(44.dp),
                ) {
                    if (state.removing) {
                        CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Outlined.Delete, null, Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Remove Current Photo", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            if (state.formError != null) {
                Spacer(Modifier.height(12.dp))
                Text(
                    state.formError ?: "",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error,
                )
            }

            Spacer(Modifier.height(28.dp))
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    "Max file size: 10MB. Formats: JPG, PNG, WebP.",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                )
            }
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun PhotoWall(text: String, action: String, onAction: () -> Unit) {
    Spacer(Modifier.height(48.dp))
    Text(text, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Spacer(Modifier.height(12.dp))
    OutlinedButton(onClick = onAction) {
        Icon(Icons.Outlined.Check, null, Modifier.size(16.dp))
        Spacer(Modifier.width(6.dp))
        Text(action, fontWeight = FontWeight.Bold)
    }
}
