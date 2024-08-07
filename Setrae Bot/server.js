const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

const INSTANCE_ID = '3D363C45E2820081F63472B70F2FFCF9';
const TOKEN = '4B9583F1D7B1FAA4ACF4A1B0';
const CLIENT_TOKEN = 'Fd71010f216234a139e51574825ca357fS';
const Z_API_URL = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${TOKEN}/send-option-list`;

app.post('/webhook', async (req, res) => {
    const { phone, text, isGroup } = req.body;

    // Verificar se a mensagem é de um grupo
    if (isGroup) {
        res.sendStatus(200);
        return;
    }

    // Enviar a mensagem de menu principal com opções para qualquer mensagem recebida
    await sendMainMenu(phone);

    res.sendStatus(200);
});

const sendMainMenu = async (phone) => {
    try {
        await axios.post(Z_API_URL, {
            phone,
            message: 'Olá! 👋\nBem-vindo ao sistema de autoatendimento do Setor de Transporte Escolar. 🚍\n\nEscolha uma das opções abaixo para continuar:',
            optionList: {
                title: 'Menu Principal',
                buttonLabel: 'Abrir lista de opções',
                options: [
                    { id: '1', title: 'Pais, Responsáveis e Alunos', description: 'Informações para Pais, Responsáveis e Alunos' },
                    { id: '2', title: 'Servidores SEMED', description: 'Informações para Servidores SEMED' },
                    { id: '3', title: 'Servidores Escola', description: 'Informações para Servidores Escola' },
                    { id: '4', title: 'Fornecedores', description: 'Informações para Fornecedores' }
                ]
            }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Client-Token': CLIENT_TOKEN
            }
        });
    } catch (error) {
        console.error('Error sending main menu:', error);
    }
};

const sendMessage = async (phone, message) => {
    const Z_API_MESSAGE_URL = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${TOKEN}/send-message`;
    try {
        await axios.post(Z_API_MESSAGE_URL, {
            phone,
            message
        });
    } catch (error) {
        console.error('Error sending message:', error);
    }
};

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
