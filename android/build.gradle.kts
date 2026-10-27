plugins {
    id("com.android.application") version "8.6.1" apply false
    // t217: Kotlin 2.0.20 — K2 + compose-compiler plugin (strong skipping ON
    // by default). KSP 2.0.20-1.0.25 keeps KSP1 as default engine (Room 2.6.1
    // compatible). kotlinx-serialization-json runtime bumped to 1.7.3
    // (Kotlin-2.0-built) in app/build.gradle.kts.
    id("org.jetbrains.kotlin.android") version "2.0.20" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.20" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.0.20" apply false
    id("com.google.devtools.ksp") version "2.0.20-1.0.25" apply false
}

tasks.register("clean", Delete::class) {
    delete(rootProject.layout.buildDirectory)
}
