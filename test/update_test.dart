// Tests für die Versionserkennung der In-App-Aktualisierung.
//
// Die Build-Nummer entscheidet, ob ein Update angeboten wird. Wird sie falsch
// gelesen, bekommt der Nutzer entweder nie ein Update oder dauernd eines.
import 'package:flutter_test/flutter_test.dart';
import 'package:footy_predict/update.dart';

void main() {
  group('versionAusText', () {
    test('Liest die von der CI geschriebene Zeile', () {
      final v = versionAusText('KickProphet 1.12.1+26 · Build 27 · Commit abc1234');
      expect(v, isNotNull);
      expect(v!.name, '1.12.1');
      expect(v.code, 26);
    });

    test('Build-Nummer zählt, nicht die Build-Nummer der CI', () {
      // "Build 27" darf nicht mit der App-Build-Nummer 26 verwechselt werden.
      expect(versionAusText('KickProphet 2.0.0+41 · Build 99')!.code, 41);
    });

    test('Findet die Version auch mitten im Text', () {
      final v = versionAusText('Neue Fassung\n\nKickProphet 1.13.0+27\nÄnderungen: ...');
      expect(v!.code, 27);
      expect(v.name, '1.13.0');
    });

    test('Ohne Version null', () {
      expect(versionAusText(''), isNull);
      expect(versionAusText('kein Versionsformat hier'), isNull);
      expect(versionAusText('nur 1.12.1 ohne Build-Nummer'), isNull);
    });

    test('Download-Adresse zeigt auf das Release, nicht ins Repo', () {
      // Vorher zeigte sie auf die mitversionierte APK im Branch. Seit die
      // Datei nicht mehr versioniert ist, wäre dieser Link tot.
      expect(kApkUrl, contains('/releases/download/kickprophet-latest/'));
      expect(kApkUrl, isNot(contains('/raw/')));
    });
  });
}
