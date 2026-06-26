// update.dart – In-App-Update-Prüfung für die sideload-Installation.
// Liest eine kleine version.json im Repo und vergleicht mit der laufenden App.
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';

/// Rohe URL der Versions-Info (zeigt immer auf den aktuellen Branch-Stand).
const _versionUrl =
    'https://raw.githubusercontent.com/warscher80/spanwerk-datenschutz/claude/football-betting-apk-m9fb1c/version.json';

class UpdateInfo {
  final int versionCode;
  final String versionName;
  final String url; // Download-Link der neuen APK
  final String notes;
  const UpdateInfo(this.versionCode, this.versionName, this.url, this.notes);
}

/// Gibt Update-Infos zurück, wenn online eine neuere Version vorliegt – sonst null.
Future<UpdateInfo?> checkForUpdate() async {
  try {
    final info = await PackageInfo.fromPlatform();
    final current = int.tryParse(info.buildNumber) ?? 0;
    final res = await http
        .get(Uri.parse(_versionUrl))
        .timeout(const Duration(seconds: 8));
    if (res.statusCode != 200) return null;
    final j = jsonDecode(res.body) as Map<String, dynamic>;
    final vc = (j['versionCode'] as num?)?.toInt() ?? 0;
    if (vc <= current) return null;
    return UpdateInfo(
      vc,
      (j['versionName'] ?? '').toString(),
      (j['url'] ?? '').toString(),
      (j['notes'] ?? '').toString(),
    );
  } catch (_) {
    return null; // offline / kein Update -> still
  }
}
