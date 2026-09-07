// Satu modul saja, dan itu memang cukup: seluruh aplikasi ini adalah satu
// Activity yang membuka satu WebView dengan satu bendera keamanan.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "SiPalingCBT-Lockdown"
include(":app")
