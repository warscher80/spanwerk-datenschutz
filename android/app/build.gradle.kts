
plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Fester, mitgelieferter Signaturschluessel.
//
// Ohne festen Schluessel signiert Gradle die Release-Fassung mit dem
// Debug-Schluessel. In der CI wird der bei JEDEM Lauf neu und zufaellig
// erzeugt - jedes APK bekaeme eine andere Signatur, und Android verweigert das
// Update ueber eine bestehende Installation ("Paket in Konflikt mit einem
// bestehenden Paket"). Man muesste vor jedem Update deinstallieren.
//
// Deshalb liegt ein eigener Release-Keystore fest im Projekt
// (android/app/kickprophet-release.jks). Damit hat JEDES gebaute APK - lokal
// wie in der CI - dieselbe Signatur, und Updates lassen sich problemlos
// darueberlegen. Das Passwort steht bewusst im Klartext: der Keystore ist
// oeffentlich, das Passwort schuetzt hier nichts. Es geht nur um eine
// gleichbleibende Signatur, nicht um Geheimhaltung (Sideload-App, kein Store).
val releaseKeystore = file("kickprophet-release.jks")
val hatEigenenSchluessel = releaseKeystore.exists()

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
                storeFile = releaseKeystore
                storePassword = "kickprophet"
                keyAlias = "kickprophet"
                keyPassword = "kickprophet"
            }
        }
    }

    buildTypes {
        release {
            // Mit dem festen Projekt-Schluessel signieren, sonst (nur falls die
            // Keystore-Datei fehlt) mit dem Debug-Schluessel, damit
            // `flutter run --release` ohne Einrichtung weiterhin funktioniert.
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
