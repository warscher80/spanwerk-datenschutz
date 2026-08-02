// update.dart – In-App-Update-Prüfung für die Sideload-Installation.
//
// Quelle ist das von der CI gepflegte Release "kickprophet-latest". Damit gibt
// es keine Datei mehr, die bei jeder Version von Hand nachgezogen werden muss.
//
// Vorher lag die Info in einer handgepflegten version.json, und ihr
// Download-Link zeigte auf die im Repo mitversionierte KickProphet.apk. Beides
// war brüchig: die Datei wurde bei jeder Version vergessen oder falsch
// gesetzt, und sobald das APK nicht mehr im Repo liegt, führt der Link ins
// Leere. Die Release-Adresse ist dagegen fest und wird bei jedem Build
// automatisch aktualisiert.
import 'dart:convert';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';

const _repo = 'warscher80/spanwerk-datenschutz';
const _tag = 'kickprophet-latest';

/// Release-Daten (die GitHub-API sendet CORS-Header und ist ohne Anmeldung
/// lesbar, solange das Repo öffentlich ist).
const _releaseUrl = 'https://api.github.com/repos/$_repo/releases/tags/$_tag';

/// Feste Adresse des APK im Release – ändert sich über Versionen hinweg nicht.
const kApkUrl =
    'https://github.com/$_repo/releases/download/$_tag/KickProphet.apk';

/// Vorberechnetes Modell, von der CI bei jedem Build neu erzeugt.
const kModellUrl =
    'https://github.com/$_repo/releases/download/$_tag/modell.json';

/// Lädt das vorberechnete Modell. Gibt null zurück, wenn es nicht erreichbar
/// oder unbrauchbar ist – die App lernt dann wie bisher selbst.
///
/// Im Browser wird zuerst die Datei **neben der App** versucht. Grund: GitHub
/// liefert Release-Dateien über einen Host ohne CORS-Header, ein Browser darf
/// sie deshalb nicht von einer fremden Seite laden – der Abruf scheitert mit
/// „Failed to fetch". In der installierten App gilt CORS nicht, dort ist die
/// Release-Adresse der richtige Weg.
Future<Map<String, dynamic>?> ladeFertigmodell() async {
  final adressen = <Uri>[
    if (kIsWeb) Uri.base.resolve('modell.json'),
    Uri.parse(kModellUrl),
  ];
  for (final u in adressen) {
    try {
      final res = await http.get(u).timeout(const Duration(seconds: 20));
      if (res.statusCode != 200) continue;
      final j = jsonDecode(res.body);
      if (j is Map<String, dynamic>) return j;
    } catch (_) {
      // nächste Adresse versuchen
    }
  }
  return null;
}

class UpdateInfo {
  final int versionCode;
  final String versionName;
  final String url; // Download-Link der neuen APK
  final String notes;
  const UpdateInfo(this.versionCode, this.versionName, this.url, this.notes);
}

/// Version aus dem Release-Text lesen.
///
/// Die CI schreibt dort "KickProphet 1.12.1+26 · Build 27 · Commit abc1234".
/// Maßgeblich ist die Build-Nummer hinter dem Pluszeichen – sie entspricht
/// dem, was `PackageInfo.buildNumber` in der installierten App liefert.
/// Gibt null zurück, wenn im Text keine Version steht.
({int code, String name})? versionAusText(String text) {
  final m = RegExp(r'(\d+\.\d+\.\d+)\+(\d+)').firstMatch(text);
  if (m == null) return null;
  final code = int.tryParse(m.group(2)!);
  if (code == null) return null;
  return (code: code, name: m.group(1)!);
}

/// Gibt Update-Infos zurück, wenn online eine neuere Version vorliegt – sonst null.
Future<UpdateInfo?> checkForUpdate() async {
  try {
    final info = await PackageInfo.fromPlatform();
    final current = int.tryParse(info.buildNumber) ?? 0;

    final res = await http.get(
      Uri.parse(_releaseUrl),
      headers: const {'Accept': 'application/vnd.github+json'},
    ).timeout(const Duration(seconds: 8));
    if (res.statusCode != 200) return null;

    final j = jsonDecode(res.body) as Map<String, dynamic>;
    final v = versionAusText('${j['body'] ?? ''}\n${j['name'] ?? ''}');
    if (v == null || v.code <= current) return null;

    // Download-Adresse bevorzugt aus dem Release selbst, sonst die feste.
    var url = kApkUrl;
    final assets = (j['assets'] as List?) ?? const [];
    for (final a in assets) {
      if (a is Map && '${a['name']}'.toLowerCase().endsWith('.apk')) {
        final u = a['browser_download_url'];
        if (u is String && u.isNotEmpty) url = u;
        break;
      }
    }

    return UpdateInfo(v.code, v.name, url, '${j['body'] ?? ''}'.trim());
  } catch (_) {
    return null; // offline / kein Update -> still
  }
}
