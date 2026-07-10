import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';

/// Informationen über eine verfügbare neuere Version.
class UpdateInfo {
  const UpdateInfo({
    required this.version,
    required this.buildNumber,
    required this.apkUrl,
    this.notes,
  });

  final String version;
  final int buildNumber;
  final String apkUrl;
  final String? notes;
}

/// Stabile URL der Update-Metadaten im GitHub-Release `terra-latest`.
/// Wird bei jedem CI-Build überschrieben und enthält die neueste Build-Nummer.
const String _latestJsonUrl =
    'https://github.com/warscher80/spanwerk-datenschutz/releases/download/terra-latest/latest.json';

/// Prüft still auf ein Update. Liefert [UpdateInfo] nur, wenn eine **neuere**
/// Version verfügbar ist – sonst `null`. Fehler (offline, kein Release, kaputte
/// Antwort) werden bewusst verschluckt: Der Update-Check darf die App nie stören.
final updateCheckProvider = FutureProvider<UpdateInfo?>((ref) async {
  try {
    final info = await PackageInfo.fromPlatform();
    final localBuild = int.tryParse(info.buildNumber) ?? 0;

    // Cache-Busting, da `terra-latest` ein bewegliches Tag ist.
    final uri = Uri.parse(
        '$_latestJsonUrl?t=${DateTime.now().millisecondsSinceEpoch}');
    final resp = await http.get(uri).timeout(const Duration(seconds: 8));
    if (resp.statusCode != 200) return null;

    final data = jsonDecode(resp.body) as Map<String, dynamic>;
    final remoteBuild = (data['buildNumber'] as num?)?.toInt() ?? 0;
    final apkUrl = data['apkUrl']?.toString() ?? '';
    if (remoteBuild <= localBuild || apkUrl.isEmpty) return null;

    return UpdateInfo(
      version: data['version']?.toString() ?? '',
      buildNumber: remoteBuild,
      apkUrl: apkUrl,
      notes: data['notes']?.toString(),
    );
  } catch (_) {
    return null;
  }
});

/// Merkt sich, ob der Banner in dieser Sitzung bereits weggewischt wurde.
final updateDismissedProvider = StateProvider<bool>((ref) => false);
