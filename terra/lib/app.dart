import 'package:flutter/material.dart';

import 'core/router.dart';
import 'core/theme.dart';

class TerraApp extends StatelessWidget {
  const TerraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Terra',
      debugShowCheckedModeBanner: false,
      theme: TerraTheme.dark,
      routerConfig: appRouter,
    );
  }
}
