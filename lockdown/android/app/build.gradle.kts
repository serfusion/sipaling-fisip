plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "id.sipaling.cbt.lockdown"
    compileSdk = 35

    defaultConfig {
        applicationId = "id.sipaling.cbt.lockdown"
        // API 24 (Android 7.0). FLAG_SECURE sudah ada jauh sebelum itu; yang
        // menentukan batas bawah ini adalah WebView modern yang menjalankan
        // halaman ujiannya, bukan penguncian layarnya.
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        // Alamat ujian ditanam saat membangun, bukan diketik peserta.
        // Aplikasi ujian yang meminta alamat lebih dulu adalah aplikasi yang
        // dapat diarahkan ke tempat lain oleh orang yang memakainya.
        buildConfigField(
            "String",
            "ALAMAT_UJIAN",
            "\"${project.findProperty("sipaling.alamatUjian") ?: "https://cbt.contoh.ac.id/ujian"}\"",
        )
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // TANDATANGANI SEBELUM DIBAGIKAN. Berkas .apk yang ditandatangani
            // kunci debug akan ditolak sebagian perangkat dan tidak dapat
            // diperbarui di atas pemasangan sebelumnya — dan pembaruan itu
            // yang membuat versi lama yang bermasalah dapat ditarik.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Sengaja sedikit. Setiap pustaka tambahan adalah satu pintu lagi ke dalam
    // aplikasi yang seluruh gunanya adalah menutup pintu.
    implementation("androidx.activity:activity-ktx:1.9.3")
}
