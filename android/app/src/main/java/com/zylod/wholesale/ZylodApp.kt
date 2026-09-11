package com.zylod.wholesale

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.SharedPreferences
import android.os.Build
import androidx.room.Room
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.zylod.wholesale.data.db.AppDatabase
import com.zylod.wholesale.network.NetworkMonitor
import com.zylod.wholesale.sync.OfflineSyncScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class ZylodApp : Application(), coil.ImageLoaderFactory {

    lateinit var database: AppDatabase
        private set

    lateinit var networkMonitor: NetworkMonitor
        private set

    /** Encrypted store for the session token mirrored from the WebView.
     *
     *  AEADBadTagException-safe: if the ciphertext file can't be decrypted
     *  (e.g. restored from a cloud backup whose Keystore master key doesn't
     *  exist on this device), reset the store once instead of crashing every
     *  subsequent access. The backup rules exclude this file since the D4 fix,
     *  so this is belt-and-braces for pre-existing restores.
     */
    val securePrefs: SharedPreferences by lazy {
        try {
            createSecurePrefs()
        } catch (_: Exception) {
            // Unrecoverable ciphertext: delete + recreate (minSdk 24 supports
            // Context.deleteSharedPreferences). The mirrored token is lost —
            // the user signs in again — but the app must not crash-loop.
            applicationContext.deleteSharedPreferences(SECURE_PREFS_FILE)
            createSecurePrefs()
        }
    }

    private fun createSecurePrefs(): SharedPreferences {
        val masterKey = MasterKey.Builder(applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            applicationContext,
            SECURE_PREFS_FILE,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onCreate() {
        super.onCreate()
        instance = this

        // Initialize Room Local Cache DB.
        // No destructive migration: the sync queue holds unsynced user actions,
        // and a schema bump must not silently wipe them — write an explicit
        // Migration instead when the entities change.
        database = Room.databaseBuilder(
            applicationContext,
            AppDatabase::class.java,
            "zylod_wholesale_cache.db"
        ).build()

        // Initialize Network Monitor
        networkMonitor = NetworkMonitor(applicationContext)

        // Drain the offline sync queue every time connectivity is regained.
        appScope.launch {
            var wasConnected = networkMonitor.isConnected.value
            networkMonitor.isConnected.collect { connected ->
                if (connected && !wasConnected) {
                    OfflineSyncScheduler.schedule(this@ZylodApp)
                }
                wasConnected = connected
            }
        }

        // Setup notification channels
        createNotificationChannels()
    }

    /**
     * Shared Coil pipeline (Phase 1 remediation, finding #3 — image decoding
     * strategy): memory + disk caching and a default crossfade. Previously
     * every AsyncImage used the default no-disk-cache loader, so every list
     * scroll re-decoded full-size product images over the network.
     */
    override fun newImageLoader(): coil.ImageLoader =
        coil.ImageLoader.Builder(this)
            .memoryCache {
                coil.memory.MemoryCache.Builder(this)
                    .maxSizePercent(0.20)
                    .build()
            }
            .diskCache {
                coil.disk.DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizeBytes(64L * 1024 * 1024)
                    .build()
            }
            .crossfade(200)
            .build()

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelOrder = NotificationChannel(
                CHANNEL_ORDERS,
                "Consignments & Orders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Real-time updates on wholesale shipments and delivery dispatch"
            }

            val channelEscrow = NotificationChannel(
                CHANNEL_ESCROW,
                "SafePay Escrow Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Escrow release and buyer inspection notifications"
            }

            val channelDeals = NotificationChannel(
                CHANNEL_DEALS,
                "Factory Deals & Price Drops",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Flash wholesale offers and bulk MOQ discounts"
            }

            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannels(listOf(channelOrder, channelEscrow, channelDeals))
        }
    }

    companion object {
        lateinit var instance: ZylodApp
            private set

        const val SECURE_PREFS_FILE = "zylod_secure"
        const val CHANNEL_ORDERS = "zylod_orders_channel"
        const val CHANNEL_ESCROW = "zylod_escrow_channel"
        const val CHANNEL_DEALS = "zylod_deals_channel"
    }
}
