plugins {
    id("com.android.application")
}

android {
    namespace = "com.example.helloworld"
    compileSdk = 37            // Android 17

    defaultConfig {
        applicationId = "com.example.helloworld"
        minSdk = 24            // runs on Android 7.0 and newer
        targetSdk = 37         // Android 17
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
