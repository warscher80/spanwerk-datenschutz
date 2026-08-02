import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Fester Signaturschluessel, falls android/key.properties vorhanden ist.
//
// Ohne festen Schluessel signiert Gradle die Release-Fassung mit dem
// Debug-Schluessel. Auf einem Entwicklerrechner ist der stabil, in der CI
// aber nicht: dort erzeugen die Android-Werkzeuge bei jedem Lauf einen neuen,
// zufaelligen. Jedes CI-APK bekaeme damit eine andere Signatur, und Android
// verweigert die Installation ueber eine bestehende App mit abweichender
// Signatur ("App nicht installiert"). Man muesste vor jedem Update
// deinstallieren und verloere dabei die gelernten Elo-Daten.
//
// key.properties und die Keystore-Datei sind in .gitignore ausgeschlossen und
// gehoeren NICHT ins Repository. In der CI werden sie aus Secrets erzeugt.
val keystorePropertiesFile = rootProject.file("key.properties")
val hatEigenenSchluessel = keystorePropertiesFile.exists()
val keystoreProperties = Properties().apply {
    if (hatEigenenSchluessel) {
        keystorePropertiesFile.inputStream().use { load(it) }
    }
}

android {
    namespace = "com.kickprophet.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        // Erforderlich für flutter_local_notifications (java.time auf alten Geräten)
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.kickprophet.app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hatEigenenSchluessel) {
            create("release") {
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
            }
        }
    }

    buildTypes {
        release {
            // Mit eigenem Schluessel signieren, sonst wie bisher mit dem
            // Debug-Schluessel, damit `flutter run --release` ohne Einrichtung
            // weiterhin funktioniert.
            signingConfig = if (hatEigenenSchluessel) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
