package com.zylod.wholesale.ui.account

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

/**
 * t280 — profile photo upload (profile-photo-page port).
 *
 * The photo pageId was a curated stub while the server exposes the real
 * contract: multipart POST api/profile/photo (field "photo", ≤10MB,
 * JPG/PNG/WebP/GIF) — persisted to users.avatarUrl since t280 (the route used
 * to return a URL nobody stored, so every refresh lost the avatar) — plus
 * GET api/profile/me (current avatarUrl) and PATCH me { avatarUrl: null }
 * (remove, honored since t280).
 */
data class ProfilePhotoUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val error: String? = null,
    /** Absolute URL of the current avatar (server-relative path resolved). */
    val avatarUrl: String? = null,
    val uploading: Boolean = false,
    val removing: Boolean = false,
    val formError: String? = null,
    val savedTick: Int = 0,
)

class ProfilePhotoViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(ProfilePhotoUiState())
    val state: StateFlow<ProfilePhotoUiState> = _state.asStateFlow()

    private var baseUrl: String? = null

    init { refresh() }

    fun refresh() {
        if (!_state.value.loading && _state.value.error == null) return
        _state.update { it.copy(loading = true, error = null, needsAuth = false) }
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.profileApi(base).me()
                if (response.code() == 401) {
                    _state.update { it.copy(loading = false, needsAuth = true) }
                    return@launch
                }
                val me = response.body()?.takeIf { it.success }?.data
                if (!response.isSuccessful || me == null) {
                    _state.update { it.copy(loading = false, error = "Could not load your profile (HTTP ${response.code()})") }
                    return@launch
                }
                _state.update { it.copy(loading = false, avatarUrl = me.avatarUrl?.let(::absolute)) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Network error — tap retry") }
            }
        }
    }

    /**
     * Upload — the KYC-uploader contract on the profile route: read the picked
     * Uri on Dispatchers.IO, validate size/mime client-side (server re-checks),
     * POST multipart field "photo", then adopt the returned avatarUrl.
     */
    fun upload(picked: Uri) {
        val s = _state.value
        if (s.uploading || s.needsAuth) return
        _state.update { it.copy(uploading = true, formError = null) }
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }

                val (fileName, mime, bytes) = withContext(Dispatchers.IO) { readPick(picked) }
                    ?: run {
                        _state.update { it.copy(uploading = false, formError = "Could not read the selected image — try another one") }
                        return@launch
                    }
                if (bytes.size > MAX_BYTES) {
                    _state.update { it.copy(uploading = false, formError = "Image file too large (max 10MB)") }
                    return@launch
                }
                if (mime !in ALLOWED) {
                    _state.update { it.copy(uploading = false, formError = "Only JPG, PNG, WebP and GIF images are supported") }
                    return@launch
                }

                val part = MultipartBody.Part.createFormData(
                    name = "photo",
                    filename = fileName.ifBlank { "avatar.${mime.substringAfter('/')}" },
                    body = bytes.toRequestBody(mime.toMediaTypeOrNull()),
                )
                val response = ApiClient.profileSettingsApi(base).uploadPhoto(part)
                if (response.code() == 401) {
                    _state.update { it.copy(uploading = false, needsAuth = true) }
                    return@launch
                }
                val data = response.body()?.takeIf { it.success }?.data
                val url = data?.avatarUrl ?: data?.url
                if (!response.isSuccessful || url == null) {
                    val err = com.zylod.wholesale.data.api.parseErrorBody(response.errorBody())
                    _state.update {
                        it.copy(
                            uploading = false,
                            formError = err.error
                                ?: "Photo upload failed. Please try again. (HTTP ${response.code()})",
                        )
                    }
                    return@launch
                }
                // t280: the route persists users.avatarUrl — refresh the cached
                // session seed too (greeting surfaces + WebView seed read it).
                refreshSessionAvatar(url)
                _state.update { it.copy(uploading = false, avatarUrl = absolute(url), savedTick = it.savedTick + 1) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                _state.update { it.copy(uploading = false, formError = "Photo upload failed. Please check your connection and try again.") }
            }
        }
    }

    /** Remove — PATCH api/profile/me { avatarUrl: null } (honored since t280). */
    fun remove() {
        val s = _state.value
        if (s.removing || s.needsAuth) return
        if (s.avatarUrl == null) return
        _state.update { it.copy(removing = true, formError = null) }
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                // { "avatarUrl": null } — explicit null ON THE WIRE (a typed DTO
                // with explicitNulls=false would DROP the field instead).
                val body = kotlinx.serialization.json.buildJsonObject {
                    put("avatarUrl", kotlinx.serialization.json.JsonNull)
                }
                val response = ApiClient.profileApi(base).patchMeRaw(body)
                if (response.code() == 401) {
                    _state.update { it.copy(removing = false, needsAuth = true) }
                    return@launch
                }
                if (!response.isSuccessful) {
                    _state.update { it.copy(removing = false, formError = "Could not remove the photo (HTTP ${response.code()}) — try again") }
                    return@launch
                }
                refreshSessionAvatar(null)
                _state.update { it.copy(removing = false, avatarUrl = null, savedTick = it.savedTick + 1) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                _state.update { it.copy(removing = false, formError = "Network error — please check your connection and try again.") }
            }
        }
    }

    /** Keep the cached UserProfileSeed's avatarUrl in sync (mirrors EditProfile's refresh). */
    private fun refreshSessionAvatar(url: String?) {
        runCatching {
            val raw = SessionManager.userJson() ?: return
            val seed = ApiClient.json.decodeFromString(
                com.zylod.wholesale.data.api.UserProfileSeed.serializer(),
                raw,
            )
            SessionManager.setUserJson(
                ApiClient.json.encodeToString(
                    com.zylod.wholesale.data.api.UserProfileSeed.serializer(),
                    seed.copy(avatarUrl = url),
                ),
            )
        }
    }

    private fun readPick(uri: Uri): Triple<String, String, ByteArray>? = runCatching {
        val resolver = appContext.contentResolver
        var name = ""
        var size = -1L
        resolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            val sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (nameIdx >= 0 && cursor.moveToFirst()) name = cursor.getString(nameIdx) ?: ""
            if (sizeIdx >= 0 && cursor.moveToFirst()) size = cursor.getLong(sizeIdx)
        }
        // OpenableColumns.SIZE lies on some providers — trust the real stream.
        val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: return@runCatching null
        if (bytes.isEmpty()) return@runCatching null
        val mime = resolver.getType(uri) ?: File(name).extension.lowercase().let { ext ->
            when (ext) {
                "png" -> "image/png"
                "webp" -> "image/webp"
                "gif" -> "image/gif"
                else -> "image/jpeg"
            }
        }
        Triple(name, mime, bytes)
    }.getOrNull()

    private fun absolute(url: String): String {
        if (url.startsWith("http")) return url
        val base = baseUrl ?: return url
        return base.trimEnd('/') + "/" + url.trimStart('/')
    }

    companion object {
        private const val MAX_BYTES = 10 * 1024 * 1024
        private val ALLOWED = setOf("image/jpeg", "image/png", "image/webp", "image/gif")
    }
}
