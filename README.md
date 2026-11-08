# Spaceship – Hello World for Android

A minimal Android app that shows **"Hello, World!"**. Built for Android 17 (API 37), runs on Android 7.0 and newer.

## 📱 Install on your phone

1. On your Android phone, open this link:
   **[⬇️ Download HelloWorld.apk](https://github.com/nyw899b9y4-lang/Spaceship/releases/latest/download/HelloWorld.apk)**
2. Open the downloaded file.
3. If Android asks, allow your browser to **install unknown apps**, then tap **Install**.
4. Start **Hello World** from your app drawer.

## How it's built

Every push to `main` triggers GitHub Actions (`.github/workflows/build.yml`), which compiles the APK and publishes it as a new [Release](https://github.com/nyw899b9y4-lang/Spaceship/releases).

To build locally: open the folder in Android Studio (Panda 3 or newer) and press Run, or run `./gradlew assembleDebug`.
