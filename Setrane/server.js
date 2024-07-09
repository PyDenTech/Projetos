const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const accountSid = 'AC0f6e6f925600db5b30152675a73962a3'; // Substitua pelo seu Account SID
const authToken = 'dc5bf847e6210d378d447d501f38470c'; // Substitua pelo seu Auth Token
const client = twilio(accountSid, authToken);

let userSessions = {}; // Para armazenar o estado das sessões dos usuários

app.post('/whatsapp', (req, res) => {
    const incomingMsg = req.body.Body.trim().toLowerCase();
    const from = req.body.From;

    let responseMsg = '';

    if (!userSessions[from]) {
        userSessions[from] = { stage: 'menu' };
    }

    const userSession = userSessions[from];

    if (userSession.stage === 'menu') {
        responseMsg = `*Bem-vindo ao Serviço de Atendimento de Transporte Escolar.*\n` +
                      `Por favor, identifique-se:\n` +
                      `1. Pais, Responsáveis e Alunos\n` +
                      `2. Servidor SEMED\n` +
                      `3. Servidor Escolar\n` +
                      `4. Fornecedor\n` +
                      `5. Encerrar atendimento`;
        userSession.stage = 'identification';
    } else if (userSession.stage === 'identification') {
        switch (incomingMsg) {
            case '1':
                responseMsg = 'Você selecionou: Pais, Responsáveis e Alunos.\nPor favor, envie o ID do aluno (5 dígitos).';
                userSession.stage = 'parent_id';
                break;
            case '2':
                responseMsg = 'Você selecionou: Servidor SEMED. Como posso ajudá-lo?';
                userSession.stage = 'semed';
                break;
            case '3':
                responseMsg = 'Você selecionou: Servidor Escolar. Como posso ajudá-lo?';
                userSession.stage = 'school_staff';
                break;
            case '4':
                responseMsg = 'Você selecionou: Fornecedor. Como posso ajudá-lo?';
                userSession.stage = 'supplier';
                break;
            case '5':
                responseMsg = 'Encerrando atendimento. Obrigado por nos contatar!';
                delete userSessions[from];
                break;
            default:
                responseMsg = 'Opção inválida. Por favor, selecione uma opção válida:\n' +
                              '1. Pais, Responsáveis e Alunos\n' +
                              '2. Servidor SEMED\n' +
                              '3. Servidor Escolar\n' +
                              '4. Fornecedor\n' +
                              '5. Encerrar atendimento';
        }
    } else if (userSession.stage === 'parent_id' && /^\d{5}$/.test(incomingMsg)) {
        const studentId = incomingMsg;
        // Aqui você pode adicionar a lógica para consultar o banco de dados com o ID do aluno
        responseMsg = `Você enviou o ID ${studentId}. Consultando informações...`;
        // Simulação de resposta da consulta ao banco de dados
        responseMsg += `\nID: ${studentId}, Nome: João da Silva, Turma: 5B`;
        userSession.stage = 'menu';
    } else {
        responseMsg = 'Desculpe, não entendi sua mensagem. Por favor, selecione uma opção válida:\n' +
                      '1. Pais, Responsáveis e Alunos\n' +
                      '2. Servidor SEMED\n' +
                      '3. Servidor Escolar\n' +
                      '4. Fornecedor\n' +
                      '5. Encerrar atendimento';
        userSession.stage = 'menu';
    }

    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(responseMsg);

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
