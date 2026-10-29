pluginManagement {
    repositories {
        google()
        maven { url = uri("https://repo1.maven.org/maven2") } // Maven Central CDN mirror (429 fallback)
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        maven { url = uri("https://repo1.maven.org/maven2") } // Maven Central CDN mirror (429 fallback)
        mavenCentral()
    }
}

rootProject.name = "ZylodWholesale"
include(":app")
