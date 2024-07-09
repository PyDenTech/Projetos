import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:fluttertoast/fluttertoast.dart';
import 'dart:convert';
import '../theme/app_theme.dart';
import 'login_page.dart';
import 'home_page.dart';
import 'tarefas_page.dart';

class PerfilPage extends StatefulWidget {
  final String email;

  const PerfilPage({super.key, required this.email});

  @override
  PerfilPageState createState() => PerfilPageState();
}

class PerfilPageState extends State<PerfilPage> {
  String _motoristaNome = '';
  String _motoristaEmpresa = '';
  String _cnh = '';
  String _cpf = '';
  bool _isLoading = true;
  int _motoristaId = 0;
  List<dynamic> _avisos = [];

  @override
  void initState() {
    super.initState();
    _fetchMotoristaData();
  }

  Future<void> _fetchMotoristaData() async {
    const String apiUrl = 'http://18.231.172.222:3000/api/getMotorista';

    final response = await http.post(
      Uri.parse(apiUrl),
      headers: <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: jsonEncode(<String, String>{
        'email': widget.email,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      print('Dados recebidos: $data');

      setState(() {
        _motoristaNome = data['nome_completo'] ?? '';
        _motoristaEmpresa = data['empresa'] ?? '';
        _cnh = data['cnh'] ?? '';
        _cpf = data['cpf'] ?? '';
        _motoristaId = data['id'] ?? 0;
        _isLoading = false;
      });

      _fetchAvisos();
    } else {
      Fluttertoast.showToast(
        msg: "Erro ao buscar dados do motorista: ${response.body}",
        toastLength: Toast.LENGTH_SHORT,
        gravity: ToastGravity.BOTTOM,
        backgroundColor: Colors.red,
        textColor: Colors.white,
        fontSize: 16.0,
      );
    }
  }

  Future<void> _fetchAvisos() async {
    const String apiUrl = 'http://18.231.172.222:3000/api/avisosMotorista';

    final response = await http.post(
      Uri.parse(apiUrl),
      headers: <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: jsonEncode(<String, int>{
        'motorista_id': _motoristaId,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      setState(() {
        _avisos = data;
      });
    } else {
      Fluttertoast.showToast(
        msg: "Erro ao buscar avisos: ${response.body}",
        toastLength: Toast.LENGTH_SHORT,
        gravity: ToastGravity.BOTTOM,
        backgroundColor: Colors.red,
        textColor: Colors.white,
        fontSize: 16.0,
      );
    }
  }

  Future<void> _marcarAvisoComoRecebido(int avisoId) async {
    const String apiUrl = 'http://18.231.172.222:3000/api/marcarAvisoComoRecebido';

    final response = await http.post(
      Uri.parse(apiUrl),
      headers: <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: jsonEncode(<String, int>{
        'aviso_id': avisoId,
      }),
    );

    if (response.statusCode == 200) {
      setState(() {
        _avisos.removeWhere((aviso) => aviso['id'] == avisoId);
      });
      Fluttertoast.showToast(
        msg: "Aviso marcado como recebido.",
        toastLength: Toast.LENGTH_SHORT,
        gravity: ToastGravity.BOTTOM,
        backgroundColor: Colors.green,
        textColor: Colors.white,
        fontSize: 16.0,
      );
    } else {
      Fluttertoast.showToast(
        msg: "Erro ao marcar aviso como recebido: ${response.body}",
        toastLength: Toast.LENGTH_SHORT,
        gravity: ToastGravity.BOTTOM,
        backgroundColor: Colors.red,
        textColor: Colors.white,
        fontSize: 16.0,
      );
    }
  }

  void _logout() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (context) => LoginPage()),
      (Route<dynamic> route) => false,
    );
  }

  void _onItemTapped(int index) {
    if (index == 0) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => TarefasPage(
            email: widget.email,
          ),
        ),
      );
    } else if (index == 1) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => HomePage(email: widget.email),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Perfil do Usuário'),
        backgroundColor: AppTheme.primaryColor,
        actions: <Widget>[
          IconButton(
            icon: const Icon(Icons.notifications, color: Colors.white),
            onPressed: () {
              // Lógica para notificações
            },
          ),
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'logout') {
                _logout();
              }
            },
            itemBuilder: (BuildContext context) {
              return [
                PopupMenuItem<String>(
                  value: 'motorista',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Nome: $_motoristaNome'),
                      Text('Empresa: $_motoristaEmpresa'),
                    ],
                  ),
                ),
                const PopupMenuItem<String>(
                  value: 'logout',
                  child: Row(
                    children: [
                      Icon(Icons.logout, color: AppTheme.primaryColor),
                      SizedBox(width: 8),
                      Text('Sair'),
                    ],
                  ),
                ),
              ];
            },
            icon: const Icon(Icons.person, color: Colors.white),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Nome: $_motoristaNome',
                      style: const TextStyle(fontSize: 18)),
                  const SizedBox(height: 10),
                  Text('Empresa: $_motoristaEmpresa',
                      style: const TextStyle(fontSize: 18)),
                  const SizedBox(height: 10),
                  Text('CNH: $_cnh', style: const TextStyle(fontSize: 18)),
                  const SizedBox(height: 10),
                  Text('CPF: $_cpf', style: const TextStyle(fontSize: 18)),
                  const SizedBox(height: 20),
                  const Text('Avisos',
                      style:
                          TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  Expanded(
                    child: ListView.builder(
                      itemCount: _avisos.length,
                      itemBuilder: (context, index) {
                        final aviso = _avisos[index];
                        return Card(
                          margin: const EdgeInsets.symmetric(vertical: 10),
                          child: ListTile(
                            title: Text(aviso['titulo']),
                            subtitle: Text(aviso['mensagem']),
                            trailing: IconButton(
                              icon: const Icon(Icons.check),
                              onPressed: () {
                                _marcarAvisoComoRecebido(aviso['id']);
                              },
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
      bottomNavigationBar: BottomNavigationBar(
        items: const <BottomNavigationBarItem>[
          BottomNavigationBarItem(
            icon: Icon(Icons.task),
            label: 'Tarefas',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person),
            label: 'Perfil',
          ),
        ],
        currentIndex: 2, // Índice da página de perfil
        selectedItemColor: AppTheme.secondaryColor,
        backgroundColor: AppTheme.primaryColor,
        unselectedItemColor: Colors.white,
        onTap: _onItemTapped,
      ),
    );
  }
}
