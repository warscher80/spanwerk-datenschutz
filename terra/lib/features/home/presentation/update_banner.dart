import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme.dart';
import '../../../core/update/update_service.dart';

/// Dezenter Banner, der erscheint, sobald ein Update verfügbar ist.
/// Tippen öffnet einen Dialog; „Jetzt laden“ öffnet die APK im Browser,
/// der den Download startet – zum Installieren tippt man die Datei an.
class UpdateBanner extends ConsumerWidget {
  const UpdateBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final info = ref.watch(updateCheckProvider).valueOrNull;
    final dismissed = ref.watch(updateDismissedProvider);
    if (info == null || dismissed) return const SizedBox.shrink();

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _showDialog(context, info),
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: Colors.black.withValues(alpha: 0.45),
            border: Border.all(color: TerraColors.amber.withValues(alpha: 0.55)),
          ),
          child: Row(
            children: [
              const Icon(Icons.auto_awesome, size: 18, color: TerraColors.amber),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Neue Version verfügbar${info.version.isNotEmpty ? ' · ${info.version}' : ''}',
                  style: const TextStyle(
                    fontSize: 13.5,
                    color: Color(0xFFE7E2D6),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              TextButton(
                onPressed: () => _openDownload(context, info),
                style: TextButton.styleFrom(
                  foregroundColor: TerraColors.amber,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: const Size(0, 32),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('Laden'),
              ),
              IconButton(
                icon: Icon(Icons.close,
                    size: 16, color: const Color(0xFFE7E2D6).withValues(alpha: 0.6)),
                visualDensity: VisualDensity.compact,
                onPressed: () =>
                    ref.read(updateDismissedProvider.notifier).state = true,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showDialog(BuildContext context, UpdateInfo info) {
    return showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF141B18),
        title: const Text('Update verfügbar'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (info.version.isNotEmpty)
              Text('Version ${info.version}',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Text(info.notes?.isNotEmpty == true
                ? info.notes!
                : 'Eine neuere Version von Terra ist verfügbar.'),
            const SizedBox(height: 12),
            Text(
              'Die APK wird im Browser geladen. Zum Installieren die '
              'heruntergeladene Datei öffnen.',
              style: TextStyle(
                  fontSize: 12.5,
                  color: const Color(0xFFE7E2D6).withValues(alpha: 0.6)),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Später'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              _openDownload(context, info);
            },
            child: const Text('Jetzt laden'),
          ),
        ],
      ),
    );
  }

  Future<void> _openDownload(BuildContext context, UpdateInfo info) async {
    final uri = Uri.parse(info.apkUrl);
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Download konnte nicht geöffnet werden.')),
      );
    }
  }
}
