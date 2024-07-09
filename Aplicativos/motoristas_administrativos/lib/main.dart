import 'package:flutter/material.dart';
import 'theme/app_theme.dart';
import 'pages/login_page.dart'; // Certifique-se de que o caminho está correto

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Motoristas Administrativos',
      theme: AppTheme.lightTheme,
      home: LoginPage(),
    );
  }
}
