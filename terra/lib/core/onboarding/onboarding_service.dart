import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

/// Merkt sich über eine kleine Flag-Datei, ob die Intro schon gezeigt wurde.
/// Bewusst dateibasiert (path_provider ist bereits vorhanden) – keine neue
/// native Abhängigkeit, kein DB-Schema-Umbau.
Future<File> _flagFile() async {
  final dir = await getApplicationSupportDirectory();
  return File('${dir.path}/onboarding_seen.flag');
}

/// `true`, wenn die Intro bereits einmal gesehen wurde.
final onboardingSeenProvider = FutureProvider<bool>((ref) async {
  try {
    return (await _flagFile()).existsSync();
  } catch (_) {
    return true; // Im Zweifel nicht nerven.
  }
});

Future<void> markOnboardingSeen() async {
  try {
    final f = await _flagFile();
    await f.create(recursive: true);
    await f.writeAsString('seen');
  } catch (_) {
    // Nicht schlimm – dann erscheint die Intro halt nochmal.
  }
}
