plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")   // Kotlin itself is built into AGP 9
}

android {
    namespace = "com.example.helloworld"
    compileSdk = 37            // Android 17

    defaultConfig {
        applicationId = "com.example.helloworld"
        minSdk = 24            // runs on Android 7.0 and newer
        targetSdk = 37         // Android 17
        versionCode = 2
        versionName = "1.1"
    }

    buildFeatures {
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.09.00")
    implementation(composeBom)
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
