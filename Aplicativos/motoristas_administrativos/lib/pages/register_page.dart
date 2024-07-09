import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:fluttertoast/fluttertoast.dart';
import 'dart:convert';
import '../theme/app_theme.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  RegisterPageState createState() => RegisterPageState();
}

class RegisterPageState extends State<RegisterPage> {
  final TextEditingController _nomeCompletoController = TextEditingController();
  final TextEditingController _cpfController = TextEditingController();
  final TextEditingController _cnhController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  String? _empresaSelecionada;
  String? _tipoVeiculoSelecionado;
  final TextEditingController _modeloController = TextEditingController();
  final TextEditingController _placaController = TextEditingController();

  Future<void> _register() async {
    const String apiUrl =
        'http://18.231.172.222:3000/api/registroMotoristasAdministrativos';

    final response = await http.post(
      Uri.parse(apiUrl),
      headers: <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: jsonEncode(<String, String>{
        'nome_completo': _nomeCompletoController.text,
        'cpf': _cpfController.text,
        'cnh': _cnhController.text,
        'email': _emailController.text,
        'password': _passwordController.text,
        'empresa': _empresaSelecionada!,
        'tipo_veiculo': _tipoVeiculoSelecionado!,
        'modelo': _modeloController.text,
        'placa': _placaController.text,
      }),
    );

    if (response.statusCode == 201) {
      Fluttertoast.showToast(
        msg: "Motorista registrado com sucesso.",
        toastLength: Toast.LENGTH_SHORT,
        gravity: ToastGravity.BOTTOM,
        backgroundColor: Colors.green,
        textColor: Colors.white,
        fontSize: 16.0,
      );
      Navigator.of(context).pop();
    } else {
      Fluttertoast.showToast(
        msg: "Erro ao registrar motorista: ${response.body}",
        toastLength: Toast.LENGTH_SHORT,
        gravity: ToastGravity.BOTTOM,
        backgroundColor: Colors.red,
        textColor: Colors.white,
        fontSize: 16.0,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.primaryColor,
      appBar: AppBar(
        title: const Text('Registro'),
        backgroundColor: AppTheme.primaryColor,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: SingleChildScrollView(
            child: Column(
              children: [
                TextField(
                  controller: _nomeCompletoController,
                  decoration: InputDecoration(
                    labelText: 'Nome Completo',
                    labelStyle: const TextStyle(color: AppTheme.secondaryColor),
                    prefixIcon: const Icon(Icons.person,
                        color: AppTheme.secondaryColor),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8.0),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _cpfController,
                  decoration: InputDecoration(
                    labelText: 'CPF',
                    labelStyle: const TextStyle(color: AppTheme.secondaryColor),
                    prefixIcon: const Icon(Icons.credit_card,
                        color: AppTheme.secondaryColor),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8.0),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _cnhController,
                  decoration: InputDecoration(
                    labelText: 'CNH',
                    labelStyle: const TextStyle(color: AppTheme.secondaryColor),
                    prefixIcon: const Icon(Icons.directions_car,
                        color: AppTheme.secondaryColor),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8.0),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  decoration: InputDecoration(
                    labelText: 'Empresa/Instituição',
                    labelStyle: const TextStyle(color: AppTheme.secondaryColor),
                    prefixIcon: const Icon(Icons.business,
                        color: AppTheme.secondaryColor),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8.0),
                    ),
                  ),
                  value: _empresaSelecionada,
                  items: <String>['SEMED', 'DIAMOND', 'TALISMÃ']
                      .map<DropdownMenuItem<String>>((String value) {
                    return DropdownMenuItem<String>(
                      value: value,
                      child: Text(value),
                    );
                  }).toList(),
                  onChanged: (String? newValue) {
                    setState(() {
                      _empresaSelecionada = newValue;
                    });
                  },
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  decoration: InputDecoration(
                    labelText: 'Tipo de Veículo',
                    labelStyle: const TextStyle(color: AppTheme.secondaryColor),
                    prefixIcon: const Icon(Icons.directions_bus,
                        color: AppTheme.secondaryColor),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8.0),
                    ),
                  ),
                  value: _tipoVeiculoSelecionado,
                  items: <String>[
                    'Caminhão',
                    'Microônibus',
                    'Van',
                    'Caminhonete',
                    'Pick-up',
                    'Sedan',
                    'Hatch'
                  ].map<DropdownMenuItem<String>>((String value) {
                    return DropdownMenuItem<String>(
                      value: value,
                      child: Text(value),
                    );
                  }).toList(),
                  onChanged: (String? newValue) {
                    setState(() {
                      _tipoVeiculoSelecionado = newValue;
                    });
                  },
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _modeloController,
                  decoration: InputDecoration(
                    labelText: 'Modelo',
                    labelStyle: const TextStyle(color: AppTheme.secondaryColor),
                    prefixIcon: const Icon(Icons.directions_car,
                        color: AppTheme.secondaryColor),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8.0),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _placaController,
                  decoration: InputDecoration(
                    labelText: 'Placa',
                    labelStyle: const TextStyle(color: AppTheme.secondaryColor),
                    prefixIcon: const Icon(Icons.confirmation_number,
                        color: AppTheme.secondaryColor),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8.0),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _emailController,
                  decoration: InputDecoration(
                    labelText: 'Email',
                    labelStyle: const TextStyle(color: AppTheme.secondaryColor),
                    prefixIcon:
                        const Icon(Icons.email, color: AppTheme.secondaryColor),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8.0),
                    ),
                  ),
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _passwordController,
                  decoration: InputDecoration(
                    labelText: 'Senha',
                    labelStyle: const TextStyle(color: AppTheme.secondaryColor),
                    prefixIcon:
                        const Icon(Icons.lock, color: AppTheme.secondaryColor),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8.0),
                    ),
                  ),
                  obscureText: true,
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _register,
                  style: ElevatedButton.styleFrom(
                    foregroundColor: Colors.white, backgroundColor: AppTheme.secondaryColor,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 32, vertical: 12),
                    textStyle: const TextStyle(fontSize: 18),
                  ),
                  child: const Text('Cadastrar'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
