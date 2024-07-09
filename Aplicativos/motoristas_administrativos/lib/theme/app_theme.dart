import 'package:flutter/material.dart';

class AppTheme {
  static const Color primaryColor = Color(0xFF008374);
  static const Color secondaryColor = Color(0xFFF85A40);

  static ThemeData get lightTheme {
    return ThemeData(
      primaryColor: primaryColor,
      scaffoldBackgroundColor: primaryColor,
      textTheme: const TextTheme(
        displayLarge: TextStyle(
            fontSize: 32.0, fontWeight: FontWeight.bold, color: secondaryColor),
        bodyLarge: TextStyle(fontSize: 16.0, color: Colors.white),
      ),
      inputDecorationTheme: InputDecorationTheme(
        labelStyle: const TextStyle(color: secondaryColor),
        focusedBorder: OutlineInputBorder(
          borderSide: const BorderSide(color: secondaryColor),
          borderRadius: BorderRadius.circular(8.0),
        ),
        enabledBorder: OutlineInputBorder(
          borderSide: const BorderSide(color: Colors.white),
          borderRadius: BorderRadius.circular(8.0),
        ),
      ),
      buttonTheme: ButtonThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.0)),
        buttonColor: secondaryColor,
        textTheme: ButtonTextTheme.primary,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          foregroundColor: Colors.white, backgroundColor: secondaryColor,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8.0),
          ),
        ),
      ),
      colorScheme: ColorScheme.fromSwatch().copyWith(
        primary: primaryColor,
        secondary: secondaryColor,
      ),
    );
  }
}
