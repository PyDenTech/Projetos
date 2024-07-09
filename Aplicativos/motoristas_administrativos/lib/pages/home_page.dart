import 'package:flutter/material.dart';
import 'tarefas_page.dart';
import 'package:http/http.dart' as http;
import 'package:fluttertoast/fluttertoast.dart';
import 'package:geolocator/geolocator.dart';
import 'dart:async';
import 'dart:convert';
import '../theme/app_theme.dart';
import 'login_page.dart';
import 'perfil_page.dart';

class HomePage extends StatefulWidget {
  final String email;

  const HomePage({super.key, required this.email});

  @override
  HomePageState createState() => HomePageState();
}

class HomePageState extends State<HomePage> {
  int _selectedIndex = 1; // Começamos com o índice da home page
  String _motoristaNome = '';
  String _motoristaEmpresa = '';
  int _motoristaId = 0;
  bool _isWorking = false;
  bool _isOnLunch = false;
  late Stopwatch _workStopwatch;
  late Stopwatch _lunchStopwatch;
  late Position _currentPosition;
  Timer? _locationUpdateTimer;

  @override
  void initState() {
    super.initState();
    _fetchMotoristaData();
    _workStopwatch = Stopwatch();
    _lunchStopwatch = Stopwatch();
  }

  @override
  void dispose() {
    _locationUpdateTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchMotoristaData() async {
    const String apiUrl = 'http://localhost:3000/api/getMotorista';

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
        _motoristaId = data['id'] ?? 0;
      });
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

  Future<void> _requestLocationPermission() async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        Fluttertoast.showToast(
          msg:
              "Permissão de localização é necessária para iniciar o expediente.",
          toastLength: Toast.LENGTH_SHORT,
          gravity: ToastGravity.BOTTOM,
          backgroundColor: Colors.red,
          textColor: Colors.white,
          fontSize: 16.0,
        );
        return;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      Fluttertoast.showToast(
        msg: "Permissão de localização foi permanentemente negada.",
        toastLength: Toast.LENGTH_SHORT,
        gravity: ToastGravity.BOTTOM,
        backgroundColor: Colors.red,
        textColor: Colors.white,
        fontSize: 16.0,
      );
      return;
    }

    _startWorkShift();
  }

  void _startWorkShift() async {
    _currentPosition = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high);
    setState(() {
      _isWorking = true;
      _workStopwatch.start();
    });

    _updateLocation(
        _currentPosition.latitude, _currentPosition.longitude, "Livre");

    _locationUpdateTimer =
        Timer.periodic(const Duration(seconds: 30), (timer) async {
      Position position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high);
      _updateLocation(position.latitude, position.longitude, "Livre");
    });
  }

  void _startLunchBreak() {
    setState(() {
      _isOnLunch = true;
      _workStopwatch.stop();
      _lunchStopwatch.start();
    });

    Future.delayed(const Duration(hours: 2), () {
      if (_isOnLunch) {
        _endLunchBreak();
      }
    });
  }

  void _endLunchBreak() {
    setState(() {
      _isOnLunch = false;
      _lunchStopwatch.stop();
      _workStopwatch.start();
    });

    Fluttertoast.showToast(
      msg: "Almoço finalizado.",
      toastLength: Toast.LENGTH_SHORT,
      gravity: ToastGravity.BOTTOM,
      backgroundColor: Colors.green,
      textColor: Colors.white,
      fontSize: 16.0,
    );
  }

  void _endWorkShift() {
    if (_isOnLunch) {
      Fluttertoast.showToast(
        msg: "Você precisa sair do almoço antes de finalizar o expediente.",
        toastLength: Toast.LENGTH_SHORT,
        gravity: ToastGravity.BOTTOM,
        backgroundColor: Colors.red,
        textColor: Colors.white,
        fontSize: 16.0,
      );
      return;
    }

    setState(() {
      _isWorking = false;
      _workStopwatch.stop();
    });

    _locationUpdateTimer?.cancel();
    _updateLocation(_currentPosition.latitude, _currentPosition.longitude,
        "Fora de Serviço");

    final int totalWorkSeconds = _workStopwatch.elapsed.inSeconds;
    final int totalLunchSeconds = _lunchStopwatch.elapsed.inSeconds;

    _registerWorkShift(totalWorkSeconds, totalLunchSeconds);
  }

  Future<void> _updateLocation(
      double latitude, double longitude, String status) async {
    const String apiUrl = 'http://localhost:3000/api/atualizarLocalizacao';

    final response = await http.post(
      Uri.parse(apiUrl),
      headers: <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: jsonEncode(<String, dynamic>{
        'motorista_id': _motoristaId,
        'latitude': latitude,
        'longitude': longitude,
        'status': status,
      }),
    );

    if (response.statusCode != 200) {
      Fluttertoast.showToast(
        msg: "Erro ao atualizar localização: ${response.body}",
        toastLength: Toast.LENGTH_SHORT,
        gravity: ToastGravity.BOTTOM,
        backgroundColor: Colors.red,
        textColor: Colors.white,
        fontSize: 16.0,
      );
    }
  }

  Future<void> _registerWorkShift(int workSeconds, int lunchSeconds) async {
    const String apiUrl = 'http://localhost:3000/api/registrarExpediente';

    final requestBody = jsonEncode(<String, dynamic>{
      'motorista_id': _motoristaId,
      'horas_trabalhadas': Duration(seconds: workSeconds).toString(),
      'horas_almoco': Duration(seconds: lunchSeconds).toString(),
    });

    print('Enviando dados: $requestBody');

    final response = await http.post(
      Uri.parse(apiUrl),
      headers: <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: requestBody,
    );

    if (response.statusCode == 201) {
      Fluttertoast.showToast(
        msg: "Expediente registrado com sucesso.",
        toastLength: Toast.LENGTH_SHORT,
        gravity: ToastGravity.BOTTOM,
        backgroundColor: Colors.green,
        textColor: Colors.white,
        fontSize: 16.0,
      );
    } else {
      Fluttertoast.showToast(
        msg: "Erro ao registrar expediente: ${response.body}",
        toastLength: Toast.LENGTH_SHORT,
        gravity: ToastGravity.BOTTOM,
        backgroundColor: Colors.red,
        textColor: Colors.white,
        fontSize: 16.0,
      );
    }
  }

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
      if (index == 0) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => TarefasPage(
              email: widget.email,
            ),
          ),
        );
      } else if (index == 2) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => PerfilPage(
              email: widget.email,
            ),
          ),
        );
      }
    });
  }

  void _logout() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (context) => LoginPage()),
      (Route<dynamic> route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Página Inicial'),
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
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (!_isWorking)
              ElevatedButton(
                onPressed: _requestLocationPermission,
                child: const Text('Iniciar Expediente'),
              ),
            if (_isWorking && !_isOnLunch)
              ElevatedButton(
                onPressed: _startLunchBreak,
                child: const Text('Entrar em Almoço'),
              ),
            if (_isOnLunch)
              ElevatedButton(
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (BuildContext context) {
                      return AlertDialog(
                        title: const Text("Finalizar Almoço"),
                        content:
                            const Text("Você quer mesmo finalizar o almoço?"),
                        actions: [
                          TextButton(
                            onPressed: () {
                              Navigator.of(context).pop();
                            },
                            child: const Text("Cancelar"),
                          ),
                          TextButton(
                            onPressed: () {
                              _endLunchBreak();
                              Navigator.of(context).pop();
                            },
                            child: const Text("Sim"),
                          ),
                        ],
                      );
                    },
                  );
                },
                child: const Text('Sair do Almoço'),
              ),
            if (_isWorking)
              ElevatedButton(
                onPressed: _endWorkShift,
                child: const Text('Finalizar Expediente'),
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
        currentIndex: _selectedIndex,
        selectedItemColor: AppTheme.secondaryColor,
        backgroundColor: AppTheme
            .primaryColor, // Define a cor de fundo da barra de navegação inferior
        unselectedItemColor:
            Colors.white, // Define a cor dos itens não selecionados
        onTap: _onItemTapped,
      ),
    );
  }
}
