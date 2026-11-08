# Spaceship – Hello World for Android & iPhone

A minimal app for Android (`app/`) and iPhone (`ios/`) that shows **"Hello, World!"**. Built for Android 17 (API 37), runs on Android 7.0 and newer.

## 📱 Install on your phone

1. On your Android phone, open this link:
   **[⬇️ Download HelloWorld.apk](https://github.com/nyw899b9y4-lang/Spaceship/releases/latest/download/HelloWorld.apk)**
2. Open the downloaded file.
3. If Android asks, allow your browser to **install unknown apps**, then tap **Install**.
4. Start **Hello World** from your app drawer.

## 🍏 iPhone version (`ios/`)

Apple doesn't allow installing apps on an iPhone from a download link. Instead you build it on a Mac with Xcode:

**Run it in the iPhone Simulator (free, no Apple account needed)**
1. Install **Xcode** from the Mac App Store (needs an Apple-silicon Mac).
2. Clone this repo and open `ios/HelloWorld.xcodeproj`.
3. Pick an iPhone simulator at the top of the window (e.g. *iPhone 17*) and press **▶ Run** (⌘R).

Or, without opening the project: download `HelloWorld-iOS-Simulator.zip` from the [iOS releases](https://github.com/nyw899b9y4-lang/Spaceship/releases), unzip it, start the Simulator (Xcode → Open Developer Tool → Simulator) and drag `HelloWorld.app` onto the simulated iPhone.

**Run it on your own iPhone**
1. Xcode → Settings → Accounts → add your Apple ID.
2. Select the *HelloWorld* target → *Signing & Capabilities* → choose your team, and change the bundle ID to something unique (e.g. `com.yourname.helloworld`).
3. Connect the iPhone via USB, enable **Developer Mode** on it (Settings → Privacy & Security), select it in Xcode and press **▶ Run**.

With a free Apple ID the app stays installed for 7 days; with a paid Apple Developer membership you can share it via TestFlight or the App Store.

## 🤖 Android emulator

Install Android Studio, open this folder, create a virtual device under *Device Manager* and press **▶ Run**.

## How it's built

- Android: every push to `main` runs `.github/workflows/build.yml`, which compiles the APK and publishes it as a new [Release](https://github.com/nyw899b9y4-lang/Spaceship/releases).
- iPhone: changes in `ios/` run `.github/workflows/ios.yml` on a Mac, which builds the app, launches it in an iPhone Simulator and attaches a screenshot plus the simulator build to an `ios-v…` release.

To build locally: open the folder in Android Studio (Panda 3 or newer) and press Run, or run `./gradlew assembleDebug`.
