// notify.dart – Lokale Tipp-Erinnerungen (kein Server, keine Daten nach außen).
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

class Notifier {
  static final _plugin = FlutterLocalNotificationsPlugin();
  static bool _ready = false;

  static Future<void> init() async {
    if (_ready) return;
    tzdata.initializeTimeZones();
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    await _plugin.initialize(const InitializationSettings(android: android));
    _ready = true;
  }

  /// Fragt (Android 13+) die Benachrichtigungserlaubnis ab.
  static Future<bool> requestPermission() async {
    final impl = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    final granted = await impl?.requestNotificationsPermission();
    return granted ?? true;
  }

  static const _details = NotificationDetails(
    android: AndroidNotificationDetails(
      'tip_reminders',
      'Tipp-Erinnerungen',
      channelDescription: 'Erinnert vor Anpfiff ans Tippen',
      importance: Importance.high,
      priority: Priority.high,
    ),
  );

  /// Plant eine Erinnerung zur lokalen Zeit [whenLocal]. Liegt sie in der
  /// Vergangenheit, passiert nichts.
  static Future<void> schedule({
    required int id,
    required DateTime whenLocal,
    required String title,
    required String body,
  }) async {
    if (!_ready) return;
    if (!whenLocal.isAfter(DateTime.now())) return;
    try {
      // whenLocal ist lokale Zeit -> als absoluten Zeitpunkt (UTC) planen.
      await _plugin.zonedSchedule(
        id, title, body,
        tz.TZDateTime.from(whenLocal.toUtc(), tz.UTC),
        _details,
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
      );
    } catch (_) {
      // Scheduling fehlgeschlagen (z. B. fehlende Erlaubnis) -> still ignorieren
    }
  }

  static Future<void> cancel(int id) async {
    try {
      await _plugin.cancel(id);
    } catch (_) {}
  }

  static Future<void> cancelAll() async {
    try {
      await _plugin.cancelAll();
    } catch (_) {}
  }
}
