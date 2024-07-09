import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:intl/intl.dart';
import 'package:fluttertoast/fluttertoast.dart';
import 'home_page.dart';
import 'login_page.dart';
import 'perfil_page.dart'; // Importar a página de perfil
import '../theme/app_theme.dart';

class TarefasPage extends StatefulWidget {
  final String email;

  const TarefasPage({super.key, required this.email});

  @override
  _TarefasPageState createState() => _TarefasPageState();
}

class _TarefasPageState extends State<TarefasPage> {
  List<dynamic> demandasPendentes = [];
  List<dynamic> demandasEmAtendimento = [];
  String _motoristaNome = '';
  String _motoristaEmpresa = '';

  @override
  void initState() {
    super.initState();
    _fetchDemandas();
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

  Future<void> _fetchDemandas() async {
    const String apiUrl = 'http://18.231.172.222:3000/api/obterDemandas';

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
      setState(() {
        demandasPendentes = data['pendentes'];
        demandasEmAtendimento = data['emAtendimento'];
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erro ao buscar demandas: ${response.body}'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  String _formatDateTime(String dateTime) {
    final DateTime dt = DateTime.parse(dateTime);
    final DateFormat formatter = DateFormat('dd-MM-yyyy HH:mm');
    return formatter.format(dt);
  }

  Future<void> _iniciarDemanda(int demandaId) async {
    const String apiUrl = 'http://18.231.172.222:3000/api/iniciarDemanda';

    final response = await http.post(
      Uri.parse(apiUrl),
      headers: <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: jsonEncode(<String, dynamic>{
        'demanda_id': demandaId,
        'email': widget.email,
      }),
    );

    if (response.statusCode == 200) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Demanda iniciada com sucesso.'),
          backgroundColor: Colors.green,
        ),
      );
      _fetchDemandas();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erro ao iniciar demanda: ${response.body}'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _finalizarDemanda(int demandaId) async {
    const String apiUrl = 'http://18.231.172.222:3000/api/finalizarDemanda';

    final response = await http.post(
      Uri.parse(apiUrl),
      headers: <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: jsonEncode(<String, dynamic>{
        'demanda_id': demandaId,
        'email': widget.email,
      }),
    );

    if (response.statusCode == 200) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Demanda finalizada com sucesso.'),
          backgroundColor: Colors.green,
        ),
      );
      _fetchDemandas();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erro ao finalizar demanda: ${response.body}'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _informarAtraso(int demandaId) async {
    const String apiUrl = 'http://18.231.172.222:3000/api/informarAtraso';

    final response = await http.post(
      Uri.parse(apiUrl),
      headers: <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: jsonEncode(<String, dynamic>{
        'demanda_id': demandaId,
      }),
    );

    if (response.statusCode == 200) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Atraso informado com sucesso.'),
          backgroundColor: Colors.green,
        ),
      );
      _fetchDemandas();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erro ao informar atraso: ${response.body}'),
          backgroundColor: Colors.red,
        ),
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
    setState(() {
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
      } else if (index == 2) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => PerfilPage(email: widget.email),
          ),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tarefas'),
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
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildSectionTitle('Demandas Pendentes'),
            _buildDemandasList(demandasPendentes, true),
            _buildSectionTitle('Demandas Em Atendimento'),
            _buildDemandasList(demandasEmAtendimento, false),
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
        currentIndex: 0,
        selectedItemColor: AppTheme.secondaryColor,
        backgroundColor: AppTheme.primaryColor,
        unselectedItemColor: Colors.white,
        onTap: _onItemTapped,
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.all(8.0),
      child: Text(
        title,
        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildDemandasList(List<dynamic> demandas, bool isPendente) {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: demandas.length,
      itemBuilder: (context, index) {
        final demanda = demandas[index];
        return Card(
          margin: const EdgeInsets.all(10),
          child: ListTile(
            title: Text(
                'Origem: ${demanda['origem']} - Destino: ${demanda['destino']}'),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Solicitante: ${demanda['solicitante']}'),
                Text(
                    'Data e Hora de Saída: ${_formatDateTime(demanda['data_hora_partida'])}'),
                Text(
                    'Previsão de Retorno: ${_formatDateTime(demanda['data_hora_termino_estimado'])}'),
                Text('Status: ${demanda['status']}'),
                if (demanda['status'] == 'Em Atendimento')
                  Text('Atraso: ${demanda['atraso'] ? 'Sim' : 'Não'}'),
              ],
            ),
            trailing: isPendente
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ElevatedButton(
                        onPressed: () => _iniciarDemanda(demanda['id']),
                        style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFF85A40)),
                        child: const Text('Iniciar'),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed:
                            () {},
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.red), // Adicione lógica para cancelar demanda, se necessário
                        child: const Text('Cancelar'),
                      ),
                    ],
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ElevatedButton(
                        onPressed: () => _finalizarDemanda(demanda['id']),
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                        child: const Text('Finalizar'),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: () => _informarAtraso(demanda['id']),
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
                        child: const Text('Informar Atraso'),
                      ),
                    ],
                  ),
          ),
        );
      },
    );
  }
}
