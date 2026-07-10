import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

Future<File> _flagFile() async {
  final dir = await getApplicationSupportDirectory();
  return File('${dir.path}/nova_intro_seen.flag');
}

/// `true`, wenn die Anleitung bereits gesehen wurde.
final introSeenProvider = FutureProvider<bool>((ref) async {
  try {
    return (await _flagFile()).existsSync();
  } catch (_) {
    return true;
  }
});

Future<void> markIntroSeen() async {
  try {
    final f = await _flagFile();
    await f.create(recursive: true);
    await f.writeAsString('seen');
  } catch (_) {
    // Nicht schlimm – dann erscheint die Anleitung halt nochmal.
  }
}
