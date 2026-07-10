import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../theme.dart';
import 'update_service.dart';

/// Dezenter Banner, sobald ein Update verfügbar ist. „Laden“ öffnet die APK
/// im Browser (Download); zum Installieren tippt man die Datei an.
class UpdateBanner extends ConsumerWidget {
  const UpdateBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final info = ref.watch(updateCheckProvider).valueOrNull;
    final dismissed = ref.watch(updateDismissedProvider);
    if (info == null || dismissed) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 8, 6, 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: Colors.black.withValues(alpha: 0.35),
        border: Border.all(color: NovaColors.gold.withValues(alpha: 0.55)),
      ),
      child: Row(
        children: [
          const Icon(Icons.auto_awesome, size: 18, color: NovaColors.gold),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Neue Version verfügbar${info.version.isNotEmpty ? ' · ${info.version}' : ''}',
              style: const TextStyle(
                  fontSize: 13, color: NovaColors.text, fontWeight: FontWeight.w500),
            ),
          ),
          TextButton(
            onPressed: () => _open(context, info),
            style: TextButton.styleFrom(
              foregroundColor: NovaColors.gold,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: const Size(0, 32),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text('Laden'),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: Icon(Icons.close,
                size: 16, color: NovaColors.text.withValues(alpha: 0.6)),
            onPressed: () =>
                ref.read(updateDismissedProvider.notifier).state = true,
          ),
        ],
      ),
    );
  }

  Future<void> _open(BuildContext context, UpdateInfo info) async {
    final ok = await launchUrl(Uri.parse(info.apkUrl),
        mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Download konnte nicht geöffnet werden.')),
      );
    }
  }
}
