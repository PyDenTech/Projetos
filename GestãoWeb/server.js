require('dotenv').config();
const cors = require('cors');
const express = require('express');
const multer = require('multer');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const path = require('path');
const xlsx = require('xlsx');
const axios = require('axios');
const NodeCache = require('node-cache');
const { format } = require('date-fns');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: 'auto' }
}));

console.log('DATABASE_URL:', process.env.DATABASE_URL);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/docs', express.static(path.join(__dirname, 'public', 'uploads')));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const saltRounds = 10;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: process.env.DB_MAX_CONNECTIONS,
    idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT,
    connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT
});

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

pool.connect(err => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados', err.stack);
    } else {
        console.log('Conectado ao banco de dados');
    }
});

function ensureLoggedIn(req, res, next) {
    if (!req.session.user) {
        res.send(`
            <!DOCTYPE html>
            <html lang="pt-br">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Redirecionando...</title>
            </head>
            <body>
                <script>
                    alert('Você precisa estar logado para acessar esta página.');
                    window.location.href = '/';
                </script>
            </body>
            </html>
        `);
    } else {
        next();
    }
}
function ensureRole(roles) {
    return function (req, res, next) {
        if (req.session.user && roles.includes(req.session.user.role)) {
            next();
        } else {
            res.send(`
                <!DOCTYPE html>
                <html lang="pt-br">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Redirecionando...</title>
                </head>
                <body>
                    <script>
                        alert('Você não tem permissão para acessar esta página.');
                        window.location.href = '/dashboard-escolar';
                    </script>
                </body>
                </html>
            `);
        }
    }
}

async function emailExiste(email) {
    const query = 'SELECT COUNT(*) FROM usuarios WHERE email = $1';
    try {
        const result = await pool.query(query, [email]);
        return result.rows[0].count > 0;
    } catch (error) {
        console.error('Erro ao verificar o email:', error);
        throw error;
    }
}

function isAdmin(req, res, next) {
    if (req.session.admin && req.session.admin.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Acesso negado' });
    }
}

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

function formatNumber(number) {
    if (typeof number !== 'number' || isNaN(number)) {
        return '0,00';
    }
    return number.toFixed(2).replace('.', ',');
}

const diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});


// Função para formatar a data no formato dd/mm/aaaa
function formatDate(date) {
    const d = new Date(date);
    const day = (`0${d.getDate()}`).slice(-2);
    const month = (`0${d.getMonth() + 1}`).slice(-2);
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

const uploadDisk = multer({ storage: diskStorage });

const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({ storage: memoryStorage });
const upload = multer({ storage: diskStorage });


/* API'S PARA APLICATIVO DE GESTÃO WEB */

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/dashboard-escolar', ensureLoggedIn, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'pages', 'dashboard-escolar.html'));
});

app.get('/redefinir-senha/:token', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'redefinir-senha.html'));
});
app.get('/verificar-direito-transporte', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'verificar-direito-transporte.html'));
});

app.get('/dashboard-adm', ensureLoggedIn, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'pages', 'dashboard-adm.html'));
});

app.get('/solicitar-redefinir-senha', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'solicitar-redefinir-senha.html'));
});

app.get('/redefinir-senha/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'redefinir-senha.html'));
});

app.get('/politicaprivacidade', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'politica.html'));
});

app.get('/termos', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'termos.html'));
});

app.get('/solicitar-rota', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'solicitar-rota.html'));
});
app.get('/solicitar-rota-chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'solicitar-rota-chat.html'));
});

app.get('/faq', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'pages', 'faq.html'));
});

app.get('/cadastrar-bairro', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'teste_perimetro.html'));
});

app.post('/api/upload-foto-perfil', ensureLoggedIn, uploadDisk.single('foto_perfil'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('Nenhum arquivo foi enviado.');
    }

    const fotoPerfilPath = `/uploads/${req.file.filename}`;

    try {
        const result = await pool.query(
            'UPDATE usuarios SET foto_perfil = $1 WHERE id = $2 RETURNING foto_perfil',
            [fotoPerfilPath, req.session.user.id]
        );

        if (result.rows.length > 0) {
            res.json({ foto_perfil: result.rows[0].foto_perfil });
        } else {
            res.status(404).send('Usuário não encontrado.');
        }
    } catch (error) {
        console.error('Erro ao atualizar foto de perfil:', error);
        res.status(500).json({ error: error.message });
    }
});

async function sendMail(to, subject, text) {
    try {
        const mailOptions = {
            from: `PyDen™Tech <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            text: text,
        };

        const result = await transporter.sendMail(mailOptions);
        return result;
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
        throw error;
    }
}



const pages = [
    'cadastrar-aluno-form',
    'admin-dashboard',
    'importar-aluno-form',
    'gerenciar-alunos-view',
    'cadastrar-escolas-form',
    'gerenciar-escolas-view',
    'vizualizar-escolas-map',
    'cadastrar-fornecedores-form',
    'cadastrar-rotas-form',
    'desenhar-rotas-map',
    'visualizar-rotas',
    'check-list-view',
    'cadastrar-demandas',
    'gerenciar-motorista-carro-form',
    'users-profile',
    'gerenciar-motoristas-view',
    'cadastrar-abastecimento-view',
    'gerenciar-abastecimento-view',
    'cadastrar-monitores-form',
    'gerenciar-monitores-view',
    'gerenciar-fornecedores-view',
    'cadastrar-motorista-form',
    'cadastrar-motorista-carro-form',
];

const pageRoles = {
    'cadastrar-aluno-form': ['admin', 'gestor'],
    'admin-dashboard': ['admin'],
    'importar-aluno-form': ['admin', 'gestor', 'agente'],
    'gerenciar-alunos-view': ['admin', 'gestor', 'agente'],
    'cadastrar-escolas-form': ['admin', 'gestor', 'agente'],
    'gerenciar-escolas-view': ['admin', 'gestor', 'agente'],
    'vizualizar-escolas-map': ['admin', 'gestor', 'agente'],
    'cadastrar-fornecedores-form': ['admin', 'gestor', 'agente'],
    'cadastrar-rotas-form': ['admin', 'gestor', 'agente'],
    'desenhar-rotas-map': ['admin', 'gestor'],
    'visualizar-rotas': ['admin', 'gestor', 'agente'],
    'check-list-view': ['admin', 'gestor', 'agente'],
    'cadastrar-demandas': ['admin', 'gestor', 'agente'],
    'gerenciar-motorista-carro-form': ['admin', 'gestor', 'agente'],
    'faq': ['admin', 'gestor', 'agente', 'fornecedor', 'motorista', 'monitor', 'visitante'],
    'users-profile': ['admin', 'gestor', 'agente', 'fornecedor', 'motorista', 'monitor'],
    'gerenciar-motoristas-view': ['admin', 'gestor', 'agente'],
    'cadastrar-abastecimento-view': ['admin', 'gestor', 'agente'],
    'gerenciar-abastecimento-view': ['admin', 'gestor', 'agente'],
    'cadastrar-monitores-form': ['admin', 'gestor', 'fornecedor'],
    'gerenciar-monitores-view': ['admin', 'gestor'],
    'gerenciar-fornecedores-view': ['admin', 'gestor'],
    'cadastrar-motorista-form': ['admin', 'gestor', 'fornecedor', 'agente'],
    'cadastrar-motorista-carro-form': ['admin', 'gestor', 'agente']
};

pages.forEach(page => {
    const roles = pageRoles[page] || ['visitante'];
    app.get(`/${page}`, ensureLoggedIn, ensureRole(roles), (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'pages', `${page}.html`));
    });
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'pages', 'admin.html'));
});

app.post('/upload-planilha', uploadDisk.single('file'), async (req, res) => {
    const filePath = req.file.path;
    const escolaId = req.body.id_escola;

    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        for (const row of data) {
            const {
                Unidade,
                ID: id_matricula,
                'Cod. Censo': cod_censo,
                Ano: ano,
                Nome: nome,
                'Dt. nascimento': dt_nascimento,
                Situação: situacao,
                Série: serie,
                Turma: turma,
                Endereço: endereco,
                'Rota transporte': rota_transporte,
                'Usa transporte escolar?': usa_transporte_escolar
            } = row;

            const formattedNascimento = dt_nascimento ? converterData(dt_nascimento) : null;

            const unidade = Unidade || escolaId;

            let id_escola;
            if (isNaN(unidade)) {
                const escolaResult = await pool.query('SELECT id FROM escolas WHERE LOWER(TRIM(nome)) = $1', [normalizeString(unidade)]);
                id_escola = escolaResult.rows[0]?.id;
            } else {
                id_escola = unidade;
            }

            if (id_escola) {
                await pool.query(
                    `INSERT INTO alunos (
                        unidade, id_escola, id_matricula, cod_censo, ano, nome, dt_nascimento, situacao, serie, turma, endereco, rota_transporte, usa_transporte_escolar
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                    [unidade, id_escola, id_matricula, cod_censo, ano, nome, formattedNascimento, situacao, serie, turma, endereco, rota_transporte, usa_transporte_escolar === 'SIM']
                );
            } else {
                console.error(`Escola não encontrada: ${unidade}`);
            }
        }

        res.send('Dados importados com sucesso!');
    } catch (error) {
        console.error('Erro ao importar dados:', error);
        res.status(500).send('Erro ao importar dados');
    }
});

function normalizeString(str) {
    if (!str) return '';
    return str.toLowerCase().trim();
}

function converterData(data) {
    if (!data) return null;
    if (typeof data === 'string') {
        const partes = data.split('/');
        if (partes.length === 3) {
            return `${partes[2]}-${partes[1]}-${partes[0]}`;
        }
    } else if (typeof data === 'number') {
        const excelDate = new Date((data - (25567 + 2)) * 86400 * 1000);
        return excelDate.toISOString().split('T')[0];
    }
    return null;
}

app.get('/admin/dashboard', (req, res) => {
    if (req.session.admin) {
        res.sendFile(path.join(__dirname, 'views', 'pages', 'admin-dashboard.html'));
    } else {
        res.status(403).send("Acesso negado. Por favor, faça login como administrador.");
    }
});

app.get('/usuarios', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome, email, init FROM usuarios');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sessao-usuario', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).send('Usuário não autenticado');
    }
});

app.post('/solicitar-redefinir-senha', async (req, res) => {
    const { email } = req.body;

    try {
        const client = await pool.connect();
        console.log('Conectado ao banco de dados');

        const result = await client.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            console.log(`Usuário não encontrado: ${email}`);
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        const token = crypto.randomBytes(20).toString('hex');
        const resetPasswordExpires = Date.now() + 3600000; // 1 hora
        console.log(`Token gerado: ${token}`);

        await client.query('UPDATE usuarios SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3',
            [token, resetPasswordExpires, email]);

        const resetUrl = `https://semedcanaadoscarajas.pydenexpress.com/redefinir-senha/${token}`;
        console.log(`URL de redefinição: ${resetUrl}`);

        const emailSubject = 'Redefinição de senha';
        const emailText = `
Olá,

Você está recebendo este e-mail porque você (ou alguém) solicitou a redefinição da senha para sua conta.

Para redefinir sua senha, clique no link abaixo ou copie e cole no seu navegador:
${resetUrl}

Se você não solicitou isso, por favor, ignore este e-mail e sua senha permanecerá inalterada.

Obrigado,
Equipe de Suporte
        `;

        await sendMail(email, emailSubject, emailText);
        console.log(`E-mail de redefinição de senha enviado para: ${email}`);

        client.release();
        res.status(200).json({ message: 'E-mail de redefinição de senha enviado com sucesso' });
    } catch (error) {
        console.error('Erro ao solicitar redefinição de senha:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});

app.post('/redefinir-senha/:token', async (req, res) => {
    const { token } = req.params;
    const { senha } = req.body;

    try {
        const client = await pool.connect();
        console.log('Conectado ao banco de dados');

        const result = await client.query('SELECT * FROM usuarios WHERE reset_password_token = $1 AND reset_password_expires > $2', [token, Date.now()]);
        const user = result.rows[0];

        if (!user) {
            console.log(`Token inválido ou expirado: ${token}`);
            return res.status(400).json({ message: 'Token inválido ou expirado' });
        }

        const hashedPassword = await bcrypt.hash(senha, 10);
        await client.query('UPDATE usuarios SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
            [hashedPassword, user.id]);

        client.release();
        res.status(200).json({ message: 'Senha redefinida com sucesso' });
    } catch (error) {
        console.error('Erro ao redefinir senha:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});

app.post('/admin/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const queryResult = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND role = $2', [email, 'admin']);
        if (queryResult.rows.length > 0) {
            const user = queryResult.rows[0];
            if (await bcrypt.compare(senha, user.password)) {
                req.session.admin = {
                    id: user.id,
                    nome: user.nome,
                    email: user.email,
                    role: user.role
                };
                res.redirect('/admin/dashboard');
            } else {
                res.status(401).send('Senha incorreta');
            }
        } else {
            res.status(404).send('Conta administrativa não encontrada');
        }
    } catch (error) {
        console.error('Erro de login', error);
        res.status(500).send('Erro ao processar o login');
    }
});

app.post('/api/loginWeb', async (req, res) => {
    const { email, senha } = req.body;

    try {
        const userQuery = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (userQuery.rows.length === 0) {
            return res.status(404).send('Usuário não encontrado.');
        }

        const user = userQuery.rows[0];
        const isValidPassword = await bcrypt.compare(senha, user.password);

        if (!isValidPassword) {
            return res.status(401).send('Senha incorreta.');
        }

        if (!user.init) {
            return res.status(403).send('Usuário não autorizado a usar o sistema. Por favor, contate o administrador.');
        }

        req.session.user = {
            id: user.id,
            nome: user.nome,
            email: user.email,
            role: user.role
        };

        res.json({ message: "Login successful", redirectUrl: '/dashboard-escolar' });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).send('Erro ao processar o login');
    }
});

app.get('/api/usuario-logado', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Usuário não autenticado');
    }

    try {
        const result = await pool.query('SELECT id, nome, telefone, email, foto_perfil, role FROM usuarios WHERE id = $1', [req.session.user.id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).send('Usuário não encontrado');
        }
    } catch (error) {
        console.error('Erro ao buscar usuário logado:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Erro ao fazer logout');
        }
        res.redirect('/');
    });
});

app.post('/api/usuarios/:userId/status', isAdmin, async (req, res) => {
    const { userId } = req.params;
    const { init } = req.body;
    try {
        const result = await pool.query('UPDATE usuarios SET init = $1 WHERE id = $2 RETURNING *', [init, userId]);
        if (result.rows.length > 0) {
            res.json({ message: 'Status atualizado com sucesso.' });
        } else {
            res.status(404).send({ message: 'Usuário não encontrado.' });
        }
    } catch (error) {
        console.error('Erro ao alterar status do usuário:', error);
        res.status(500).json({ message: 'Erro ao processar a solicitação.' });
    }
});

app.post('/api/usuarios/:userId/cargo', isAdmin, async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;
    try {
        const result = await pool.query('UPDATE usuarios SET role = $1 WHERE id = $2 RETURNING *', [role, userId]);
        if (result.rows.length > 0) {
            res.json({ success: true, message: 'Cargo atualizado com sucesso.' });
        } else {
            res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
    } catch (error) {
        console.error('Erro ao alterar o cargo do usuário:', error);
        res.status(500).json({ success: false, message: 'Erro ao processar a solicitação.' });
    }
});

async function cpfExiste(cpf) {
    const query = 'SELECT COUNT(*) FROM usuarios WHERE cpf = $1';
    try {
        const result = await pool.query(query, [cpf]);
        return result.rows[0].count > 0;
    } catch (error) {
        console.error('Erro ao verificar o CPF:', error);
        throw error;
    }
}

app.post('/api/change-password', ensureLoggedIn, async (req, res) => {
    const { currentPassword, newPassword, renewPassword } = req.body;

    if (newPassword !== renewPassword) {
        return res.status(400).send('A nova senha e a confirmação de senha não coincidem.');
    }

    try {
        const userQuery = await pool.query('SELECT password FROM usuarios WHERE id = $1', [req.session.user.id]);
        if (userQuery.rows.length === 0) {
            return res.status(404).send('Usuário não encontrado.');
        }

        const user = userQuery.rows[0];
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

        if (!isCurrentPasswordValid) {
            return res.status(401).send('Senha atual incorreta.');
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
        await pool.query('UPDATE usuarios SET password = $1 WHERE id = $2', [hashedNewPassword, req.session.user.id]);

        res.send('Senha atualizada com sucesso.');
    } catch (error) {
        console.error('Erro ao atualizar senha:', error);
        res.status(500).send('Erro ao atualizar senha.');
    }
});

app.post('/cadastrar-usuario', async (req, res) => {
    const { nome_completo, cpf, telefone, email_institucional, senha, cnh, empresa } = req.body;

    try {
        const emailJaExiste = await emailExiste(email_institucional);
        const cpfJaExiste = await cpfExiste(cpf);

        if (emailJaExiste) {
            return res.status(400).json({ error: 'Este email já está cadastrado.' });
        }

        if (cpfJaExiste) {
            return res.status(400).json({ error: 'Este CPF já está cadastrado.' });
        }

        const hashedPassword = await bcrypt.hash(senha, saltRounds);
        const novoUsuario = await pool.query(
            'INSERT INTO usuarios (nome, cpf, telefone, email, password, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [nome_completo, cpf, telefone, email_institucional, hashedPassword, 'motorista_escolar']
        );

        const usuarioId = novoUsuario.rows[0].id;

        await pool.query(
            'INSERT INTO motoristas_escolares (nome, cpf, cnh, empresa, usuario_id) VALUES ($1, $2, $3, $4, $5)',
            [nome_completo, cpf, cnh, empresa, usuarioId]
        );

        res.json(novoUsuario.rows[0]);
    } catch (error) {
        console.error('Erro ao inserir novo usuário:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/usuarios-pendentes', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome, email, init, role FROM usuarios');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/estados', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT codigo_uf, nome FROM ibge_estados ORDER BY nome');
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/municipios/:estadoCodigo', async (req, res) => {
    try {
        const estadoCodigo = req.params.estadoCodigo;
        const resultado = await pool.query('SELECT codigo_ibge, nome FROM ibge_municipios WHERE codigo_uf = $1 ORDER BY nome', [estadoCodigo]);
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/cadastrar-escola', async (req, res) => {
    const {
        reglatEscola,
        reglonEscola,
        areaUrbanaEscola,
        inputAddressEscola,
        inputNumberEscola,
        inputComplementEscola,
        inputNeighborhoodEscola,
        inputZipEscola,
        schoolName,
        schoolINEP,
        regular,
        eja,
        profissionalizante,
        especial,
        infantil,
        fundamental,
        medio,
        superior,
        manha,
        tarde,
        noite,
        bairrosAtendidos = []  // Certifique-se de que seja um array
    } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO escolas (
                latitude, longitude, area_urbana, logradouro, numero, complemento, bairro, cep, 
                nome, inep, regular, eja, profissionalizante, especial, infantil, fundamental, medio, 
                superior, manha, tarde, noite, zoneamentos
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
            ) RETURNING *`,
            [
                reglatEscola,
                reglonEscola,
                areaUrbanaEscola === '1',
                inputAddressEscola,
                inputNumberEscola,
                inputComplementEscola,
                inputNeighborhoodEscola,
                inputZipEscola,
                schoolName,
                schoolINEP,
                regular === '1',
                eja === '1',
                profissionalizante === '1',
                especial === '1',
                infantil === '1',
                fundamental === '1',
                medio === '1',
                superior === '1',
                manha === '1',
                tarde === '1',
                noite === '1',
                JSON.stringify(bairrosAtendidos) // Certifique-se de enviar um array
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao cadastrar escola:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/cadastrar-bairro', async (req, res) => {
    const { nomeBairro } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO bairros (nome) VALUES ($1) RETURNING *`,
            [nomeBairro]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao cadastrar bairro:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/bairros', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome FROM zoneamentos ORDER BY nome');
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao obter bairros:', error);
        res.status(500).json({ error: error.message });
    }
});


app.put('/api/editar-bairro/:id', async (req, res) => {
    const { id } = req.params;
    const { nomeBairro } = req.body;

    try {
        const result = await pool.query(
            `UPDATE bairros SET nome = $1 WHERE id = $2 RETURNING *`,
            [nomeBairro, id]
        );

        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Bairro não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao editar bairro:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/excluir-bairro/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `DELETE FROM bairros WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rows.length > 0) {
            res.json({ message: 'Bairro excluído com sucesso' });
        } else {
            res.status(404).json({ error: 'Bairro não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao excluir bairro:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/escolas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM escolas WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            const escola = result.rows[0];

            // Garantir que 'zoneamentos' seja um objeto JSON
            escola.zoneamentos = typeof escola.zoneamentos === 'string' ? JSON.parse(escola.zoneamentos) : escola.zoneamentos;

            res.json(escola);
        } else {
            res.status(404).json({ error: 'Escola não encontrada' });
        }
    } catch (error) {
        console.error('Erro ao buscar escola:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/editar-escola/:id', async (req, res) => {
    const { id } = req.params;
    const {
        nome, inep, latitude, longitude, logradouro, numero, complemento, bairro, cep, area_urbana, zoneamentos
    } = req.body;

    try {
        const result = await pool.query(
            `UPDATE escolas SET nome = $1, inep = $2, latitude = $3, longitude = $4, logradouro = $5,
            numero = $6, complemento = $7, bairro = $8, cep = $9, area_urbana = $10, zoneamentos = $11 WHERE id = $12 RETURNING *`,
            [nome, inep, latitude, longitude, logradouro, numero, complemento, bairro, cep, area_urbana, zoneamentos, id]
        );

        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Escola não encontrada' });
        }
    } catch (error) {
        console.error('Erro ao editar escola:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/excluir-escola/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM escolas WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Escola não encontrada' });
        }
    } catch (error) {
        console.error('Erro ao excluir escola:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/zoneamentos-editar', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM zoneamentos');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar zoneamentos:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.get('/api/lista-escolas', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome FROM escolas');
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar lista de escolas:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/cadastrar-rota', async (req, res) => {
    const {
        identificadorUnico,
        tipoRota,
        nomeRota,
        horariosFuncionamento,
        dificuldadesAcesso,
        areaUrbana,
        escolasAtendidas,
        alunosAtendidos
    } = req.body;

    try {
        // Verificar se o identificador único já existe
        const existingRota = await pool.query(
            'SELECT * FROM rotas WHERE identificador_unico = $1',
            [identificadorUnico]
        );

        if (existingRota.rows.length > 0) {
            return res.status(400).json({ error: 'Identificador único já existe.' });
        }

        // Inserir nova rota
        const result = await pool.query(
            `INSERT INTO rotas (
                identificador_unico,
                tipo_rota, 
                nome_rota, 
                horarios_funcionamento, 
                dificuldades_acesso, 
                area_urbana,
                escolas_atendidas, 
                alunos_atendidos
            ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::jsonb, $8::jsonb) RETURNING *`,
            [
                identificadorUnico,
                tipoRota,
                nomeRota,
                JSON.stringify(horariosFuncionamento),
                JSON.stringify(dificuldadesAcesso),
                areaUrbana,
                JSON.stringify(escolasAtendidas),
                JSON.stringify(alunosAtendidos)
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao cadastrar rota:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/cadastrar-tracado-rota', async (req, res) => {
    const {
        rotaId,
        nomeRota,
        distanciaTotal,
        tempoTotal,
        pontoInicial,
        pontoFinal,
        pontosParada,
        escolasAtendidas
    } = req.body;

    try {
        // Verifica se já existe um traçado cadastrado para a rota
        const existingRoute = await pool.query(
            'SELECT * FROM rotas_geradas WHERE rota_id = $1',
            [rotaId]
        );

        if (existingRoute.rows.length > 0) {
            return res.status(409).json({ error: 'Já existe um traçado cadastrado para essa rota. Deseja sobrescrever?' });
        }

        // Insira os dados na tabela rotas_geradas
        const result = await pool.query(
            `INSERT INTO rotas_geradas (
                rota_id,
                nome_rota,
                distancia_total,
                tempo_total,
                ponto_inicial,
                ponto_final,
                pontos_parada,
                escolas_atendidas
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
                parseInt(rotaId),
                nomeRota,
                parseFloat(distanciaTotal),
                parseFloat(tempoTotal),
                pontoInicial,
                pontoFinal,
                pontosParada,
                escolasAtendidas
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao cadastrar traçado da rota:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/atualizar-tracado-rota', async (req, res) => {
    const {
        rotaId,
        nomeRota,
        distanciaTotal,
        tempoTotal,
        pontoInicial,
        pontoFinal,
        pontosParada,
        escolasAtendidas
    } = req.body;

    try {
        // Atualize os dados na tabela rotas_geradas
        const result = await pool.query(
            `UPDATE rotas_geradas SET
                nome_rota = $2,
                distancia_total = $3,
                tempo_total = $4,
                ponto_inicial = $5,
                ponto_final = $6,
                pontos_parada = $7,
                escolas_atendidas = $8
            WHERE rota_id = $1 RETURNING *`,
            [
                parseInt(rotaId),
                nomeRota,
                parseFloat(distanciaTotal),
                parseFloat(tempoTotal),
                pontoInicial,
                pontoFinal,
                pontosParada,
                escolasAtendidas
            ]
        );

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar traçado da rota:', error);
        res.status(500).json({ error: error.message });
    }
});


app.get('/api/rotas', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM rotas
            ORDER BY 
                CAST(regexp_replace(identificador_unico, '[^0-9]', '', 'g') AS INTEGER),
                regexp_replace(identificador_unico, '[0-9]', '', 'g')
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar rotas:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/consultar-rotas-com-escolas', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 15;
        const offset = parseInt(req.query.offset) || 0;

        const rotasResult = await pool.query(`
            SELECT id, identificador_unico, nome_rota, escolas_atendidas
            FROM rotas
            ORDER BY
                CAST(regexp_replace(identificador_unico::text, '[^0-9]', '', 'g') AS INTEGER),
                regexp_replace(identificador_unico::text, '[0-9]', '', 'g')
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const rotas = rotasResult.rows;

        // Prepare to fetch school names
        const escolasIds = [];
        rotas.forEach(rota => {
            rota.escolas_atendidas.forEach(id => {
                if (!escolasIds.includes(id)) {
                    escolasIds.push(id);
                }
            });
        });

        const escolasResult = await pool.query(`
            SELECT id, nome
            FROM escolas
            WHERE id = ANY($1::int[])
        `, [escolasIds]);

        const escolasMap = {};
        escolasResult.rows.forEach(escola => {
            escolasMap[escola.id] = escola.nome;
        });

        // Map school names to routes
        rotas.forEach(rota => {
            rota.escolas_atendidas_nomes = rota.escolas_atendidas.map(id => escolasMap[id]);
        });

        const totalResult = await pool.query('SELECT COUNT(*) FROM rotas');
        const totalRotas = parseInt(totalResult.rows[0].count);

        res.status(200).json({ rotas, totalRotas });
    } catch (error) {
        console.error('Erro ao consultar rotas:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/rotas-geradas/:rotaId', async (req, res) => {
    const { rotaId } = req.params;

    try {
        const result = await pool.query('SELECT * FROM rotas_geradas WHERE rota_id = $1', [rotaId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Rota não encontrada.' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar rota gerada:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/verificar-rota-gerada', async (req, res) => {
    const { rota_id } = req.body;

    try {
        const result = await pool.query('SELECT * FROM rotas_geradas WHERE rota_id = $1', [rota_id]);

        if (result.rows.length > 0) {
            res.json({ existe: true });
        } else {
            res.json({ existe: false });
        }
    } catch (error) {
        console.error('Erro ao verificar rota gerada:', error);
        res.status(500).json({ error: 'Erro ao verificar rota gerada' });
    }
});

app.post('/api/salvar-rota-gerada', async (req, res) => {
    const { ponto_inicial, pontos_parada, ponto_final, rota_id, distancia_total, tempo_total } = req.body;

    console.log('Dados recebidos:', {
        ponto_inicial,
        pontos_parada,
        ponto_final,
        rota_id,
        distancia_total,
        tempo_total
    });

    const pontoInicialStr = `${ponto_inicial.lat},${ponto_inicial.lng}`;
    const pontoFinalStr = `${ponto_final.lat},${ponto_final.lng}`;
    const pontosParadaStr = pontos_parada.map(p => `${p.lat},${p.lng}`);

    try {
        const result = await pool.query(
            `INSERT INTO rotas_geradas (
                ponto_inicial, 
                pontos_parada, 
                ponto_final, 
                rota_id, 
                distancia_total, 
                tempo_total
            ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                pontoInicialStr,
                pontosParadaStr,
                pontoFinalStr,
                rota_id,
                distancia_total,
                tempo_total
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao salvar rota gerada:', error.message);
        console.error(error.stack); // Adicionado para obter mais detalhes do erro
        res.status(500).json({ error: 'Erro ao salvar rota gerada' });
    }
});

app.post('/api/escolas-nomes', async (req, res) => {
    const { ids } = req.body;

    try {
        const result = await pool.query('SELECT id, nome, latitude, longitude FROM escolas WHERE id = ANY($1::int[])', [ids]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao obter nomes das escolas:', error);
        res.status(500).json({ error: 'Erro ao obter nomes das escolas' });
    }
});

app.get('/api/rotas/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('SELECT * FROM rotas WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Rota não encontrada' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar rota:', error);
        res.status(500).json({ error: 'Erro ao buscar rota' });
    }
});

app.get('/api/rotas/:rotaId/escolas', async (req, res) => {
    const { rotaId } = req.params;

    try {
        const rota = await pool.query('SELECT escolas_atendidas FROM rotas WHERE id = $1', [rotaId]);

        if (rota.rows.length === 0) {
            return res.status(404).json({ error: 'Rota não encontrada.' });
        }

        const escolasIds = rota.rows[0].escolas_atendidas;

        const escolas = await pool.query('SELECT id, latitude, longitude FROM escolas WHERE id = ANY($1)', [escolasIds]);

        res.json(escolas.rows);
    } catch (error) {
        console.error('Erro ao buscar escolas da rota:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/atualizar-rota/:id', async (req, res) => {
    const { id } = req.params;
    const {
        identificadorUnico,
        tipoRota,
        nomeRota,
        horariosFuncionamento,
        dificuldadesAcesso,
        escolasAtendidas,
        alunosAtendidos,
        areaUrbana
    } = req.body;

    try {
        const result = await pool.query(
            `UPDATE rotas 
            SET identificador_unico = $1,
                tipo_rota = $2,
                nome_rota = $3,
                horarios_funcionamento = $4,
                dificuldades_acesso = $5,
                escolas_atendidas = $6,
                alunos_atendidos = $7,
                area_urbana = $8
            WHERE id = $9
            RETURNING *`,
            [
                identificadorUnico,
                tipoRota,
                nomeRota,
                horariosFuncionamento,
                dificuldadesAcesso,
                escolasAtendidas,
                alunosAtendidos,
                areaUrbana,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Rota não encontrada' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar rota:', error);
        res.status(500).json({ error: 'Erro ao atualizar rota' });
    }
});

app.delete('/api/rotas/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Começar uma transação
        await pool.query('BEGIN');

        // Excluir rotas geradas associadas à rota
        await pool.query('DELETE FROM rotas_geradas WHERE rota_id = $1', [id]);

        // Excluir a rota
        await pool.query('DELETE FROM rotas WHERE id = $1', [id]);

        // Commit da transação
        await pool.query('COMMIT');

        res.json({ message: 'Rota excluída com sucesso.' });
    } catch (err) {
        // Rollback da transação em caso de erro
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).send('Erro ao excluir a rota');
    }
});

app.post('/api/cadastrar-aluno', async (req, res) => {
    const {
        latitude,
        longitude,
        areaUrbana,
        dificuldades_acesso,
        endereco_logradouro,
        endereco_numero,
        endereco_complemento,
        bairro,
        cep,
        nome_aluno,
        cpf_aluno,
        data_nascimento,
        telefone_responsavel,
        grau_parentesco,
        sexo_aluno,
        cor_aluno,
        deficiencias,
        escola,
        rota,
        turno_estudo,
        nivel_ensino
    } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO alunos (
                latitude, longitude, area_urbana, dificuldades_acesso,
                endereco_logradouro, endereco_numero, endereco_complemento,
                bairro, cep, nome_aluno, cpf_aluno, data_nascimento,
                telefone_responsavel, grau_parentesco, sexo_aluno,
                cor_aluno, deficiencias, escola, rota, turno_estudo, nivel_ensino
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21
            ) RETURNING id`,
            [
                latitude, longitude, areaUrbana, dificuldades_acesso, endereco_logradouro,
                endereco_numero, endereco_complemento, bairro, cep, nome_aluno, cpf_aluno,
                data_nascimento, telefone_responsavel, grau_parentesco, sexo_aluno, cor_aluno,
                deficiencias, escola, rota, turno_estudo, nivel_ensino
            ]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.get('/api/alunos', async (req, res) => {
    const escolaId = req.query.escolaId;

    try {
        const result = await pool.query('SELECT * FROM alunos WHERE id_escola = $1', [escolaId]);
        const alunos = result.rows;

        // Corrigir possível erro de dados undefined
        alunos.forEach(aluno => {
            aluno.dt_nascimento = aluno.dt_nascimento ? aluno.dt_nascimento.toISOString().split('T')[0] : null;
        });

        res.json(alunos);
    } catch (error) {
        console.error('Erro ao buscar alunos:', error);
        res.status(500).json({ error: 'Erro ao buscar alunos' });
    }
});

app.get('/api/alunos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM alunos WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).send('Aluno não encontrado');
        }
    } catch (error) {
        console.error('Erro ao buscar aluno:', error);
        res.status(500).send('Erro ao buscar aluno');
    }
});

app.put('/api/alunos/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, dt_nascimento, situacao, serie, turma, endereco, rota_transporte, usa_transporte_escolar } = req.body;

    try {
        const result = await pool.query(
            `UPDATE alunos SET nome = $1, dt_nascimento = $2, situacao = $3, serie = $4, turma = $5, 
            endereco = $6, rota_transporte = $7, usa_transporte_escolar = $8 WHERE id = $9 RETURNING *`,
            [nome, dt_nascimento, situacao, serie, turma, endereco, rota_transporte, usa_transporte_escolar, id]
        );

        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).send('Aluno não encontrado');
        }
    } catch (error) {
        console.error('Erro ao editar dados do aluno:', error);
        res.status(500).send('Erro ao editar dados do aluno');
    }
});

app.get('/api/dashboard-data', async (req, res) => {
    let client;
    try {
        client = await pool.connect();

        // Consultas para obter dados
        const [escolasResult, alunosResult, rotasResult, quilometragemTotalResult, rotasMensaisResult, quilometragemMediaResult, tempoMedioResult] = await Promise.all([
            client.query('SELECT COUNT(*) AS count FROM escolas'),
            client.query('SELECT COUNT(*) AS count FROM alunos'),
            client.query('SELECT COUNT(*) AS count FROM rotas'),
            client.query('SELECT SUM(distancia_total) AS quilometragemTotal FROM rotas_geradas'),
            client.query(`
                    SELECT 
                        EXTRACT(YEAR FROM data_cadastro) AS ano, 
                        EXTRACT(MONTH FROM data_cadastro) AS mes, 
                        COUNT(*) AS total,
                        SUM(CASE WHEN area_urbana THEN 1 ELSE 0 END) AS urbana,
                        SUM(CASE WHEN NOT area_urbana THEN 1 ELSE 0 END) AS rural
                    FROM rotas
                    GROUP BY EXTRACT(YEAR FROM data_cadastro), EXTRACT(MONTH FROM data_cadastro)
                    ORDER BY EXTRACT(YEAR FROM data_cadastro), EXTRACT(MONTH FROM data_cadastro);
            `),
            client.query('SELECT AVG(distancia_total) AS quilometragemMedia FROM rotas_geradas'),
            client.query('SELECT AVG(tempo_total) AS tempoMedio FROM rotas_geradas')
        ]);

        // Processando os resultados
        const escolasCount = escolasResult.rows[0].count;
        const alunosCount = alunosResult.rows[0].count;
        const rotasCount = rotasResult.rows[0].count;
        const quilometragemTotal = quilometragemTotalResult.rows[0].quilometragemtotal || 0;
        const quilometragemMedia = quilometragemMediaResult.rows[0].quilometragemmedia || 0;
        const tempoMedio = tempoMedioResult.rows[0].tempomedio || 0;

        // Adicionando logs para depuração
        console.log('Dados do Dashboard:');
        console.log('Escolas Count:', escolasCount);
        console.log('Alunos Count:', alunosCount);
        console.log('Rotas Count:', rotasCount);
        console.log('Quilometragem Total:', quilometragemTotal);
        console.log('Quilometragem Média:', quilometragemMedia);
        console.log('Tempo Médio:', tempoMedio);

        const rotasMensais = rotasMensaisResult.rows.reduce((acc, row) => {
            const key = `${row.ano}-${String(row.mes).padStart(2, '0')}`;
            acc[key] = {
                total: parseInt(row.total),
                urbana: parseInt(row.urbana),
                rural: parseInt(row.rural)
            };
            return acc;
        }, {});

        res.json({
            escolasCount,
            alunosCount,
            rotasCount,
            quilometragemTotal,
            quilometragemMedia,
            tempoMedio,
            rotasMensais
        });
    } catch (error) {
        console.error('Erro ao buscar dados do dashboard:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do dashboard' });
    } finally {
        if (client) client.release();
    }
});


app.get('/api/stop-points', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM stop_points');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching stop points:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/stop-points', async (req, res) => {
    const points = req.body;

    if (!Array.isArray(points) || points.length === 0) {
        return res.status(400).json({ error: 'Invalid data format' });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get the current highest ID from the database
            const result = await client.query('SELECT MAX(id) as max_id FROM stop_points');
            let maxId = result.rows[0].max_id || 0;

            const queries = points.map(point => {
                maxId += 1;
                const { latitude, longitude } = point;
                const name = `Ponto ${maxId}`;
                return client.query(
                    'INSERT INTO stop_points (id, name, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING *',
                    [maxId, name, latitude, longitude]
                );
            });

            const results = await Promise.all(queries);
            await client.query('COMMIT');

            res.status(201).json(results.map(result => result.rows[0]));
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Error storing stop points:', err);
            res.status(500).json({ error: 'Internal server error' });
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error connecting to database:', err);
        res.status(500).json({ error: 'Database connection error' });
    }
});

app.post('/api/fornecedores', async (req, res) => {
    const { nomeFornecedor, tipoContrato, cnpjFornecedor, contatoFornecedor, latitude, longitude, endereco } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO fornecedores (nome_fornecedor, tipo_contrato, cnpj, contato, latitude, longitude, endereco) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [nomeFornecedor, tipoContrato, cnpjFornecedor, contatoFornecedor, latitude, longitude, endereco]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao cadastrar fornecedor' });
    }
});

app.get('/api/fornecedores', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM fornecedores');
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar fornecedores:', error);
        res.status(500).json({ error: 'Erro ao buscar fornecedores' });
    }
});

app.get('/api/fornecedores/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const result = await pool.query('SELECT * FROM fornecedores WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Fornecedor não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao buscar fornecedor:', error);
        res.status(500).json({ error: 'Erro ao buscar fornecedor' });
    }
});

app.put('/api/fornecedores/:id', async (req, res) => {
    const id = req.params.id;
    const { nomeFornecedor, tipoContrato, cnpjFornecedor, contatoFornecedor, latitude, longitude, endereco } = req.body;

    try {
        const result = await pool.query(
            'UPDATE fornecedores SET nome_fornecedor = $1, tipo_contrato = $2, cnpj_fornecedor = $3, contato_fornecedor = $4, latitude = $5, longitude = $6, endereco = $7 WHERE id = $8 RETURNING *',
            [nomeFornecedor, tipoContrato, cnpjFornecedor, contatoFornecedor, latitude, longitude, endereco, id]
        );

        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Fornecedor não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao editar fornecedor:', error);
        res.status(500).json({ error: 'Erro ao editar fornecedor' });
    }
});

app.delete('/api/fornecedores/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const result = await pool.query('DELETE FROM fornecedores WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length > 0) {
            res.json({ message: 'Fornecedor excluído com sucesso' });
        } else {
            res.status(404).json({ error: 'Fornecedor não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao excluir fornecedor:', error);
        res.status(500).json({ error: 'Erro ao excluir fornecedor' });
    }
});

app.get('/api/escolas', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.*, 
                ARRAY_AGG(z.nome) AS zoneamentos_nomes,
                ARRAY_AGG(z.coordenadas) AS zoneamentos_coordenadas
            FROM escolas e
            LEFT JOIN LATERAL (
                SELECT z.nome, z.coordenadas
                FROM zoneamentos z
                WHERE z.id = ANY (SELECT jsonb_array_elements_text(e.zoneamentos)::int)
            ) z ON TRUE
            GROUP BY e.id
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar escolas:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/zoneamentos', async (req, res) => {
    const zoneamentos = req.body;

    if (!Array.isArray(zoneamentos) || zoneamentos.length === 0) {
        return res.status(400).json({ error: 'Nenhum zoneamento foi enviado.' });
    }

    try {
        const client = await pool.connect();
        await client.query('BEGIN');

        for (const zoneamento of zoneamentos) {
            const { name, color, coordinates } = zoneamento;

            if (!name || !color || !coordinates) {
                throw new Error('Dados inválidos recebidos.');
            }

            await client.query(
                'INSERT INTO zoneamentos (nome, cor, coordenadas) VALUES ($1, $2, $3)',
                [name, color, JSON.stringify(coordinates)]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Zoneamentos salvos com sucesso.' });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Erro ao salvar o zoneamento:', err);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});


// Rota para obter todos os zoneamentos
app.get('/api/zoneamentos', async (req, res) => {
    try {
        const result = await pool.query('SELECT nome, cor, coordenadas FROM zoneamentos');
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar zoneamentos:', err);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});


app.get('/api/motoristas', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome_completo AS nome, cpf, cnh, status FROM motoristas_administrativos');
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar motoristas:', error);
        res.status(500).json({ error: 'Erro ao buscar motoristas' });
    }
});

app.post('/api/cadastrar-monitor', uploadDisk.fields([
    { name: 'docRH', maxCount: 1 },
    { name: 'docMonitor', maxCount: 1 },
    { name: 'docEnsinoMedio', maxCount: 1 }
]), async (req, res) => {
    const { nomeCompleto, cpf, empresa, rotas } = req.body;

    const docRH = req.files['docRH'] ? req.files['docRH'][0].filename : null;
    const docMonitor = req.files['docMonitor'] ? req.files['docMonitor'][0].filename : null;
    const docEnsinoMedio = req.files['docEnsinoMedio'] ? req.files['docEnsinoMedio'][0].filename : null;

    if (!nomeCompleto || !cpf || !empresa || !docRH || !docMonitor || !docEnsinoMedio || !rotas) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    try {
        const client = await pool.connect();
        const result = await client.query(
            'INSERT INTO monitores (nome_completo, cpf, empresa, doc_rh, doc_monitor, doc_ensino_medio, rotas) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [nomeCompleto, cpf, empresa, docRH, docMonitor, docEnsinoMedio, JSON.parse(rotas)]
        );
        client.release();
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao cadastrar monitor');
    }
});

app.post('/api/cadastrar-motorista', uploadDisk.fields([
    { name: 'certificadoTransporte', maxCount: 1 },
    { name: 'certificadoEscolar', maxCount: 1 },
    { name: 'documentoCnh', maxCount: 1 }
]), async (req, res) => {
    const { nomeCompleto, cpf, cnh, empresa, veiculo, placa, email, senha } = req.body;

    const certificadoTransporte = req.files['certificadoTransporte'] ? req.files['certificadoTransporte'][0].filename : null;
    const certificadoEscolar = req.files['certificadoEscolar'] ? req.files['certificadoEscolar'][0].filename : null;
    const documentoCnh = req.files['documentoCnh'] ? req.files['documentoCnh'][0].filename : null;

    if (!nomeCompleto || !cpf || !cnh || !empresa || !veiculo || !placa || !certificadoTransporte || !certificadoEscolar || !documentoCnh) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    try {
        const hashedPassword = await bcrypt.hash(senha, 10);

        const client = await pool.connect();
        const result = await client.query(
            'INSERT INTO motoristas_escolares (nome_completo, cpf, cnh, empresa, veiculo, placa, certificado_transporte, certificado_escolar, documento_cnh, email, senha) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
            [nomeCompleto, cpf, cnh, empresa, veiculo, placa, certificadoTransporte, certificadoEscolar, documentoCnh, email, hashedPassword]
        );
        client.release();
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao cadastrar motorista');
    }
});

app.get('/api/monitores', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome_completo, cpf, empresa, doc_rh, doc_monitor, doc_ensino_medio, rotas, data_cadastro FROM monitores');
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar dados dos monitores:', err);
        res.status(500).json({ error: 'Erro ao buscar dados dos monitores' });
    }
});

app.put('/api/monitores/:id', async (req, res) => {
    const { id } = req.params;
    const { nome_completo, cpf, empresa, rotas } = req.body;

    try {
        await pool.query(
            'UPDATE monitores SET nome_completo = $1, cpf = $2, empresa = $3, rotas = $4 WHERE id = $5',
            [nome_completo, cpf, empresa, rotas, id]
        );
        res.json({ message: 'Monitor atualizado com sucesso' });
    } catch (err) {
        console.error('Erro ao atualizar monitor:', err);
        res.status(500).json({ error: 'Erro ao atualizar monitor' });
    }
});

app.delete('/api/monitores/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query('DELETE FROM monitores WHERE id = $1', [id]);
        res.json({ message: 'Monitor excluído com sucesso' });
    } catch (err) {
        console.error('Erro ao excluir monitor:', err);
        res.status(500).json({ error: 'Erro ao excluir monitor' });
    }
});

/* API'S PARA APLICATIVO DE TRANSPORTE ADMINISTRATIVO E GESTÃO WEB COMBINADOS */

app.post('/api/criarDemanda', async (req, res) => {
    const { origem, destino, data_hora_partida, data_hora_termino_estimado, solicitante, tem_carga, quantidade_passageiros, motoristas } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const demandaResult = await client.query(
            'INSERT INTO demandas (origem, destino, data_hora_partida, data_hora_termino_estimado, solicitante, tem_carga, quantidade_passageiros, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
            [origem, destino, data_hora_partida, data_hora_termino_estimado, solicitante, tem_carga, quantidade_passageiros, 'Pendente']
        );
        const demandaId = demandaResult.rows[0].id;

        const insertPromises = motoristas.map(motoristaId => {
            return client.query(
                'INSERT INTO demanda_motorista (demanda_id, motorista_id) VALUES ($1, $2)',
                [demandaId, motoristaId]
            );
        });

        await Promise.all(insertPromises);

        await client.query('COMMIT');
        res.json({ id: demandaId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao criar demanda:', error);
        res.status(500).json({ error: 'Erro ao criar demanda' });
    } finally {
        client.release();
    }
});

app.post('/api/obterDemandas', async (req, res) => {
    const { motorista_id } = req.body;

    try {
        const pendentes = await pool.query(
            `SELECT d.id, d.origem, d.destino, d.solicitante, d.data_hora_partida, d.data_hora_termino_estimado, d.status, d.atraso
         FROM demandas d
         JOIN demanda_motorista dm ON d.id = dm.demanda_id
         WHERE dm.motorista_id = $1 AND d.status = 'Pendente'`,
            [motorista_id]
        );

        const emAtendimento = await pool.query(
            `SELECT d.id, d.origem, d.destino, d.solicitante, d.data_hora_partida, d.data_hora_termino_estimado, d.status, d.atraso
         FROM demandas d
         JOIN demanda_motorista dm ON d.id = dm.demanda_id
         WHERE dm.motorista_id = $1 AND d.status = 'Em Atendimento'`,
            [motorista_id]
        );

        res.json({ pendentes: pendentes.rows, emAtendimento: emAtendimento.rows });
    } catch (error) {
        console.error('Erro ao buscar demandas:', error);
        res.status(500).json({ error: 'Erro ao buscar demandas' });
    }
});

app.get('/api/solicitacoes-recentes', async (req, res) => {
    const limit = parseInt(req.query.limit) || 10; // Número padrão de itens por página
    const page = parseInt(req.query.page) || 1; // Página padrão
    const offset = (page - 1) * limit;

    try {
        // Consultar o número total de solicitações
        const totalResult = await pool.query('SELECT COUNT(*) FROM demandas');
        const totalSolicitacoes = parseInt(totalResult.rows[0].count);

        // Consultar as solicitações com paginação
        const result = await pool.query(`
            SELECT d.id, d.origem, d.destino, d.data_hora_partida, d.data_hora_termino_estimado, d.solicitante, d.tem_carga, d.quantidade_passageiros, d.data_criacao, d.status, d.atraso, m.nome_completo AS motorista_nome
            FROM demandas d
            LEFT JOIN demanda_motorista dm ON d.id = dm.demanda_id
            LEFT JOIN motoristas_administrativos m ON dm.motorista_id = m.id
            LIMIT $1 OFFSET $2;
        `, [limit, offset]);

        res.json({
            solicitacoes: result.rows,
            totalSolicitacoes
        });
    } catch (err) {
        console.error('Erro ao carregar solicitações:', err);
        res.status(500).send('Erro ao carregar solicitações');
    }
});

app.get('/api/motoristas-mais-ativos', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT m.id, m.nome_completo,
                SUM(
                    EXTRACT(EPOCH FROM (e.horas_trabalhadas - e.horas_almoco))
                ) AS total_horas_trabalhadas
            FROM expediente e
            LEFT JOIN motoristas_administrativos m ON e.motorista_id = m.id
            GROUP BY m.id, m.nome_completo
            ORDER BY total_horas_trabalhadas DESC
            LIMIT 10;
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao carregar motoristas mais ativos:', err);
        res.status(500).send('Erro ao carregar motoristas mais ativos');
    }
});


app.post('/api/demandasPendentes', async (req, res) => {
    const { motorista_id } = req.body;

    try {
        const result = await pool.query(
            `SELECT d.id, d.origem, d.destino, d.solicitante, d.data_hora_partida, d.data_hora_termino_estimado
         FROM demandas d
         JOIN demanda_motorista dm ON d.id = dm.demanda_id
         WHERE dm.motorista_id = $1 AND d.status = 'Pendente'`,
            [motorista_id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar demandas pendentes:', error);
        res.status(500).json({ error: 'Erro ao buscar demandas pendentes' });
    }
});

app.post('/api/iniciarDemanda', async (req, res) => {
    const { demanda_id, motorista_id } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verificar se o motorista está livre e o expediente iniciado
        const motoristaResult = await client.query(
            'SELECT status FROM motoristas_administrativos WHERE id = $1',
            [motorista_id]
        );
        const motoristaStatus = motoristaResult.rows[0]?.status;

        if (motoristaStatus !== 'Livre') {
            throw new Error('Motorista não está livre ou o expediente não foi iniciado.');
        }

        // Atualizar o status da demanda e do motorista
        await client.query(
            'UPDATE demandas SET status = $1 WHERE id = $2',
            ['Em Atendimento', demanda_id]
        );
        await client.query(
            'UPDATE motoristas_administrativos SET status = $1 WHERE id = $2',
            ['Ocupado', motorista_id]
        );

        await client.query('COMMIT');
        res.status(200).json({ message: 'Demanda iniciada com sucesso.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao iniciar demanda:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

app.post('/api/cancelarDemanda', async (req, res) => {
    const { demanda_id } = req.body;

    if (!demanda_id) {
        return res.status(400).json({ error: 'demanda_id é necessário' });
    }

    try {
        const query = 'UPDATE demandas SET status = $1 WHERE id = $2 RETURNING *';
        const values = ['Cancelada', demanda_id];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Demanda não encontrada' });
        }

        res.status(200).json({ message: 'Demanda cancelada com sucesso', demanda: result.rows[0] });
    } catch (error) {
        console.error('Erro ao cancelar demanda:', error);
        res.status(500).json({ error: 'Erro ao cancelar demanda' });
    }
});

app.post('/api/finalizarDemanda', async (req, res) => {
    const { demanda_id, motorista_id } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Atualizar o status da demanda e do motorista
        await client.query(
            'UPDATE demandas SET status = $1 WHERE id = $2',
            ['Concluída', demanda_id]
        );
        await client.query(
            'UPDATE motoristas_administrativos SET status = $1 WHERE id = $2',
            ['Livre', motorista_id]
        );

        await client.query('COMMIT');
        res.status(200).json({ message: 'Demanda finalizada com sucesso.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao finalizar demanda:', error);
        res.status(500).json({ error: 'Erro ao finalizar demanda' });
    } finally {
        client.release();
    }
});

app.post('/api/informarAtraso', async (req, res) => {
    const { demanda_id } = req.body;

    try {
        const result = await pool.query(
            'UPDATE demandas SET atraso = $1 WHERE id = $2 RETURNING *',
            [true, demanda_id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao informar atraso:', error);
        res.status(500).json({ error: 'Erro ao informar atraso' });
    }
});

app.post('/api/getMotorista', async (req, res) => {
    const { email } = req.body;

    try {
        // Verificar se os dados do motorista estão no cache
        const cachedMotorista = cache.get(email);
        if (cachedMotorista) {
            console.log('Dados do motorista retornados do cache');
            return res.status(200).json(cachedMotorista);
        }

        // Se os dados não estiverem no cache, buscar no banco de dados
        const result = await pool.query(
            'SELECT id, nome_completo, empresa FROM motoristas_administrativos WHERE email = $1',
            [email]
        );

        if (result.rows.length > 0) {
            const motorista = result.rows[0];
            // Armazenar os dados no cache
            cache.set(email, motorista);
            res.status(200).json(motorista);
        } else {
            res.status(404).json({ error: 'Motorista não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao buscar dados do motorista:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do motorista' });
    }
});

app.post('/api/registrarExpediente', async (req, res) => {
    const { motorista_id, horas_trabalhadas, horas_almoco } = req.body;

    console.log('Dados recebidos:', req.body); // Adicione este log para verificar os dados recebidos

    try {
        const client = await pool.connect(); // Obtenha uma conexão do pool
        try {
            const result = await client.query(
                `INSERT INTO expediente (motorista_id, horas_trabalhadas, horas_almoco, data) 
           VALUES ($1, $2, $3, CURRENT_DATE) RETURNING *`,
                [motorista_id, horas_trabalhadas, horas_almoco]
            );

            res.status(201).json(result.rows[0]);
        } finally {
            client.release(); // Libere a conexão de volta para o pool
        }
    } catch (error) {
        console.error('Erro ao registrar expediente:', error);
        res.status(500).json({ error: 'Erro ao registrar expediente' });
    }
});

app.post('/api/atualizarLocalizacao', async (req, res) => {
    const { motorista_id, latitude, longitude, status } = req.body;

    console.log('Dados recebidos para atualização:', req.body); // Adicione este log para verificar os dados recebidos

    try {
        const client = await pool.connect(); // Obtenha uma conexão do pool
        try {
            const result = await client.query(
                `UPDATE motoristas_administrativos
           SET latitude = $1, longitude = $2, status = $3
           WHERE id = $4 RETURNING *`,
                [latitude, longitude, status, motorista_id]
            );

            res.status(200).json(result.rows[0]);
        } finally {
            client.release(); // Libere a conexão de volta para o pool
        }
    } catch (error) {
        console.error('Erro ao atualizar localização:', error);
        res.status(500).json({ error: 'Erro ao atualizar localização' });
    }
});

app.get('/api/motoristas/:id/localizacao', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('SELECT latitude, longitude FROM motoristas_administrativos WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Motorista não encontrado' });
        }

        const { latitude, longitude } = result.rows[0];
        res.json({ latitude, longitude });
    } catch (error) {
        console.error('Erro ao obter a localização do motorista:', error);
        res.status(500).json({ error: 'Erro ao obter a localização do motorista' });
    }
});

app.put('/api/motoristas/:id', (req, res) => {
    const id = req.params.id;
    const {
        nome_completo,
        cpf,
        cnh,
        email,
        empresa,
        tipo_veiculo,
        modelo,
        placa,
        status
    } = req.body;

    const query = `
        UPDATE motoristas_administrativos
        SET 
            nome_completo = $1,
            cpf = $2,
            cnh = $3,
            email = $4,
            empresa = $5,
            tipo_veiculo = $6,
            modelo = $7,
            placa = $8,
            status = $9
        WHERE id = $10
    `;

    const values = [nome_completo, cpf, cnh, email, empresa, tipo_veiculo, modelo, placa, status, id];

    pool.query(query, values)
        .then(result => {
            res.status(200).json({ message: 'Motorista atualizado com sucesso.' });
        })
        .catch(error => {
            console.error('Erro ao atualizar motorista:', error);
            res.status(500).json({ message: 'Erro ao atualizar motorista.' });
        });
});


app.get('/api/motoristas/:id', (req, res) => {
    const id = req.params.id;

    pool.query('SELECT * FROM motoristas_administrativos WHERE id = $1', [id])
        .then(result => {
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Motorista não encontrado.' });
            }
            res.status(200).json(result.rows[0]);
        })
        .catch(error => {
            console.error('Erro ao carregar motorista:', error);
            res.status(500).json({ message: 'Erro ao carregar motorista.' });
        });
});

app.delete('/api/motoristas/:id', async (req, res) => {
    const motoristaId = req.params.id;
    console.log(`Tentando excluir motorista com ID: ${motoristaId}`);

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN'); // Inicia uma transação

            // Exclui todos os registros da tabela expediente relacionados ao motorista
            const deleteExpedienteResult = await client.query('DELETE FROM expediente WHERE motorista_id = $1', [motoristaId]);
            console.log(`Excluídos ${deleteExpedienteResult.rowCount} registros da tabela expediente relacionados ao motorista com ID: ${motoristaId}`);

            // Exclui o motorista da tabela motoristas_administrativos
            const deleteMotoristaResult = await client.query('DELETE FROM motoristas_administrativos WHERE id = $1 RETURNING *', [motoristaId]);
            if (deleteMotoristaResult.rowCount === 0) {
                console.log(`Motorista com ID: ${motoristaId} não encontrado.`);
                await client.query('ROLLBACK'); // Desfaz a transação
                return res.status(404).json({ message: 'Motorista não encontrado.' });
            }

            await client.query('COMMIT'); // Confirma a transação
            console.log(`Motorista com ID: ${motoristaId} excluído com sucesso.`);
            res.json({ message: 'Motorista excluído com sucesso.' });
        } catch (error) {
            await client.query('ROLLBACK'); // Desfaz a transação em caso de erro
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Erro ao excluir motorista:', error);
        res.status(500).json({ message: 'Erro ao excluir motorista.', error: error.message });
    }
});

app.post('/api/avisos', async (req, res) => {
    const { titulo, mensagem, destinatario } = req.body;

    try {
        await pool.query(
            'INSERT INTO avisos (titulo, mensagem, destinatario) VALUES ($1, $2, $3)',
            [titulo, mensagem, destinatario]
        );
        res.status(201).json({ message: 'Aviso criado com sucesso' });
    } catch (error) {
        console.error('Erro ao criar aviso:', error);
        res.status(500).json({ error: 'Erro ao criar aviso' });
    }
});

app.post('/api/avisosMotorista', async (req, res) => {
    const { motorista_id } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM avisos WHERE destinatario = $1 OR destinatario = \'geral\' ORDER BY data_criacao DESC',
            [motorista_id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar avisos:', error);
        res.status(500).json({ error: 'Erro ao buscar avisos' });
    }
});

app.post('/api/marcarAvisoComoRecebido', async (req, res) => {
    const { aviso_id } = req.body;

    try {
        await pool.query('DELETE FROM avisos WHERE id = $1', [aviso_id]);
        res.status(200).json({ message: 'Aviso marcado como recebido' });
    } catch (error) {
        console.error('Erro ao marcar aviso como recebido:', error);
        res.status(500).json({ error: 'Erro ao marcar aviso como recebido' });
    }
});

app.delete('/api/usuarios/:userId', isAdmin, async (req, res) => {
    const { userId } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Excluir de motoristas_escolares primeiro se existir
        await client.query('DELETE FROM motoristas_escolares WHERE id = $1', [userId]);

        // Excluir de usuarios
        const result = await client.query('DELETE FROM usuarios WHERE id = $1 RETURNING *', [userId]);

        if (result.rows.length > 0) {
            await client.query('COMMIT');
            res.json({ message: 'Usuário excluído com sucesso.' });
        } else {
            await client.query('ROLLBACK');
            res.status(404).json({ message: 'Usuário não encontrado.' });
        }
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao excluir usuário:', error);
        res.status(500).json({ message: 'Erro ao processar a solicitação.' });
    } finally {
        client.release();
    }
});

app.post('/api/cadastrar-abastecimento-administrativos', async (req, res) => {
    const {
        reqId,
        carro,
        placa,
        odometro,
        combustivel,
        litros,
        motoristaId
    } = req.body;

    let valorUnitario = 0;

    if (combustivel === 'Gasolina Comum') {
        valorUnitario = 5.8;
    } else if (combustivel === 'Diesel S10') {
        valorUnitario = 6.9;
    }

    const valorTotal = (litros * valorUnitario).toFixed(2);

    try {
        const result = await pool.query(
            'INSERT INTO abastecimentos (req_id, carro, placa, quilometragem, tipo_combustivel, quantidade_litros, valor_total, motorista_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [reqId, carro, placa, odometro, combustivel, litros, valorTotal, motoristaId]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Erro ao cadastrar abastecimento:', err);
        res.status(500).json({ error: 'Erro ao cadastrar abastecimento' });
    }
});

/* API'S PARA APLICATIVO DE TRANSPORTE ESCOLAR E GESTÃO WEB */


// Endpoint para obter um motorista escolar por ID
app.get('/api/motoristas_escolares/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const motoristaResult = await pool.query('SELECT * FROM motoristas_escolares WHERE id = $1', [id]);

        if (motoristaResult.rows.length > 0) {
            const motorista = motoristaResult.rows[0];

            // Buscar as rotas associadas ao motorista
            const rotasResult = await pool.query(
                `SELECT r.id, r.nome_rota
                 FROM motorista_rotas mr
                 JOIN rotas r ON mr.rota_id = r.id
                 WHERE mr.motorista_id = $1`,
                [id]
            );

            motorista.rotas = rotasResult.rows;  // Adicionar as rotas ao objeto do motorista

            res.status(200).json(motorista);
        } else {
            res.status(404).json({ message: 'Motorista não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao buscar dados do motorista:', error);
        res.status(500).json({ message: 'Erro ao processar a solicitação' });
    }
});

app.delete('/api/motoristas_escolares/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM motoristas_escolares WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length > 0) {
            res.status(200).json({ message: 'Motorista excluído com sucesso' });
        } else {
            res.status(404).json({ message: 'Motorista não encontrado' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/motoristas_escolares/:id', async (req, res) => {
    const { id } = req.params;
    const { nome_completo, cpf, cnh, empresa, rota_ids } = req.body;  // rota_ids será um array de IDs de rotas

    try {
        const result = await pool.query(
            `UPDATE motoristas_escolares
             SET nome_completo = $1, cpf = $2, cnh = $3, empresa = $4
             WHERE id = $5 RETURNING *`,
            [nome_completo, cpf, cnh, empresa, id]
        );

        if (result.rows.length > 0) {
            // Primeiro, removemos todas as rotas associadas ao motorista
            await pool.query('DELETE FROM motorista_rotas WHERE motorista_id = $1', [id]);

            // Depois, associamos as novas rotas
            if (rota_ids && rota_ids.length > 0) {
                const insertPromises = rota_ids.map(rotaId => {
                    return pool.query(
                        'INSERT INTO motorista_rotas (motorista_id, rota_id) VALUES ($1, $2)',
                        [id, rotaId]
                    );
                });
                await Promise.all(insertPromises);
            }

            res.status(200).json(result.rows[0]);
        } else {
            res.status(404).json({ message: 'Motorista não encontrado' });
        }
    } catch (err) {
        console.error('Erro ao atualizar motorista:', err);
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/motoristas_escolares', async (req, res) => {
    try {
        const result = await pool.query(`
        SELECT 
            m.id, 
            m.nome_completo, 
            m.cpf, 
            m.cnh, 
            m.empresa, 
            m.veiculo, 
            m.placa, 
            m.certificado_transporte, 
            m.certificado_escolar, 
            m.documento_cnh, 
            array_agg(r.id) AS rota_ids, 
            array_agg(r.nome_rota) AS rota_nomes
        FROM 
            motoristas_escolares m
        LEFT JOIN 
            motorista_rotas mr ON m.id = mr.motorista_id
        LEFT JOIN 
            rotas r ON mr.rota_id = r.id
        GROUP BY 
            m.id
      `);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar motoristas:', error);
        res.status(500).json({ error: 'Erro ao processar a solicitação' });
    }
});


app.get('/api/rotas/motorista/:motorista_id', async (req, res) => {
    const { motorista_id } = req.params;
    try {
        console.log(`Buscando rotas para o motorista com ID: ${motorista_id}`);
        const result = await pool.query(
            `SELECT r.id, r.nome_rota
             FROM rotas r
             JOIN motoristas_escolares m ON r.id = m.rota_id
             WHERE m.usuario_id = $1`,
            [motorista_id]
        );

        if (result.rows.length > 0) {
            console.log(`Rotas encontradas: ${JSON.stringify(result.rows)}`);
            res.json(result.rows);
        } else {
            console.log('Nenhuma rota encontrada para o motorista.');
            res.status(404).json({ message: 'Nenhuma rota encontrada para o motorista.' });
        }
    } catch (error) {
        console.error('Erro ao buscar rotas do motorista:', error);
        res.status(500).json({ error: 'Erro ao buscar rotas do motorista' });
    }
});

app.get('/api/rota-gerada/:rota_id', async (req, res) => {
    const { rota_id } = req.params;

    try {
        const result = await pool.query(
            'SELECT ponto_inicial, pontos_parada, ponto_final FROM rotas_geradas WHERE rota_id = $1',
            [rota_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Rota gerada não encontrada' });
        }

        const rotaGerada = result.rows[0];
        const pontoInicial = JSON.parse(rotaGerada.ponto_inicial);
        const pontosParada = JSON.parse(rotaGerada.pontos_parada);
        const pontoFinal = JSON.parse(rotaGerada.ponto_final);

        const pontos = [pontoInicial, ...pontosParada, pontoFinal];

        res.json(pontos);
    } catch (err) {
        console.error('Erro ao buscar a rota gerada:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Endpoint para buscar motoristas
app.get('/api/motoristas-abastecimento', async (req, res) => {
    const tipo = req.query.tipo;

    let query = 'SELECT id, nome_completo FROM ';
    if (tipo === 'motoristas_escolares') {
        query += 'motoristas_escolares';
    } else if (tipo === 'motoristas_administrativos') {
        query += 'motoristas_administrativos';
    } else {
        return res.status(400).json({ error: 'Tipo de motorista inválido' });
    }

    try {
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar motoristas:', err);
        res.status(500).json({ error: 'Erro ao buscar motoristas' });
    }
});

app.post('/api/cadastrar-abastecimento-escolares', async (req, res) => {
    const {
        reqId,
        carro,
        placa,
        odometro,
        combustivel,
        litros,
        motoristaId
    } = req.body;

    let valorUnitario = 0;

    if (combustivel === 'Gasolina Comum') {
        valorUnitario = 5.8;
    } else if (combustivel === 'Diesel S10') {
        valorUnitario = 6.9;
    }

    const valorTotal = (litros * valorUnitario).toFixed(2);

    try {
        const result = await pool.query(
            'INSERT INTO abastecimentos (req_id, carro, placa, quilometragem, tipo_combustivel, quantidade_litros, valor_total, motorista_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [reqId, carro, placa, odometro, combustivel, litros, valorTotal, motoristaId]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Erro ao cadastrar abastecimento:', err);
        res.status(500).json({ error: 'Erro ao cadastrar abastecimento' });
    }
});

// Endpoint para buscar abastecimentos com filtros
app.get('/api/abastecimentos', async (req, res) => {
    const { combustivel, motorista, mes, requisicao } = req.query;

    let query = `
        SELECT a.id, a.req_id, a.carro, a.placa, a.quilometragem, a.tipo_combustivel, a.quantidade_litros, a.valor_total, a.data_abastecimento,
               CASE
                   WHEN m.id IS NOT NULL THEN m.nome_completo
                   WHEN ma.id IS NOT NULL THEN ma.nome_completo
                   ELSE 'Desconhecido'
               END AS nome_motorista
        FROM abastecimentos a
        LEFT JOIN motoristas_escolares m ON a.motorista_id = m.id
        LEFT JOIN motoristas_administrativos ma ON a.motorista_id = ma.id
        WHERE 1=1
    `;

    const queryParams = [];
    if (combustivel) {
        queryParams.push(combustivel);
        query += ` AND a.tipo_combustivel = $${queryParams.length}`;
    }
    if (motorista) {
        queryParams.push(motorista);
        query += ` AND a.motorista_id = $${queryParams.length}`;
    }
    if (mes) {
        queryParams.push(mes + '-01', mes + '-31');
        query += ` AND a.data_abastecimento BETWEEN $${queryParams.length - 1} AND $${queryParams.length}`;
    }
    if (requisicao) {
        queryParams.push(requisicao);
        query += ` AND a.req_id = $${queryParams.length}`;
    }

    query += ' ORDER BY a.data_abastecimento DESC';

    try {
        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar abastecimentos:', err);
        res.status(500).json({ error: 'Erro ao buscar abastecimentos' });
    }
});

// Endpoint para buscar um abastecimento específico pelo ID
app.get('/api/abastecimentos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM abastecimentos WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Abastecimento não encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar abastecimento:', error);
        res.status(500).json({ error: 'Erro ao buscar abastecimento' });
    }
});

// Endpoint para atualizar um abastecimento
app.put('/api/abastecimentos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            req_id,
            carro,
            placa,
            quilometragem,
            tipo_combustivel,
            quantidade_litros,
            valor_total,
            data_abastecimento,
            motorista_id,
        } = req.body;

        const result = await pool.query(
            `UPDATE abastecimentos 
             SET req_id = $1, carro = $2, placa = $3, quilometragem = $4, tipo_combustivel = $5, quantidade_litros = $6, valor_total = $7, data_abastecimento = $8, motorista_id = $9 
             WHERE id = $10 
             RETURNING *`,
            [req_id, carro, placa, quilometragem, tipo_combustivel, quantidade_litros, valor_total, data_abastecimento, motorista_id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Abastecimento não encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar abastecimento:', error);
        res.status(500).json({ error: 'Erro ao atualizar abastecimento' });
    }
});

// Endpoint para excluir um abastecimento
app.delete('/api/abastecimentos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query('DELETE FROM abastecimentos WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Abastecimento não encontrado' });
        }
        res.json({ message: 'Abastecimento excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir abastecimento:', error);
        res.status(500).json({ error: 'Erro ao excluir abastecimento' });
    }
});

app.get('/api/motoristas-editar-abastecimento', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome_completo FROM motoristas');
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar motoristas:', error);
        res.status(500).json({ error: 'Erro ao buscar motoristas' });
    }
});

// Endpoint para buscar motoristas
app.get('/api/motoristas-gerenciar-abastecimento', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, nome_completo 
            FROM motoristas_escolares
            UNION
            SELECT id, nome_completo
            FROM motoristas_administrativos
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar motoristas:', err);
        res.status(500).json({ error: 'Erro ao buscar motoristas' });
    }
});

/* API'S PARA APLICATIVO DE TRANSPORTE ADMINISTRATIVO */

app.post('/api/registroMotoristasAdministrativos', async (req, res) => {
    console.log('Recebendo requisição de registro');

    const {
        nome_completo,
        cpf,
        cnh,
        email,
        password,
        empresa,
        tipo_veiculo,
        modelo,
        placa,
    } = req.body;

    console.log('Dados recebidos:', req.body);

    if (
        !nome_completo ||
        !cpf ||
        !cnh ||
        !email ||
        !password ||
        !empresa ||
        !tipo_veiculo ||
        !modelo ||
        !placa
    ) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO motoristas_administrativos (nome_completo, cpf, cnh, email, senha, empresa, tipo_veiculo, modelo, placa)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
            [nome_completo, cpf, cnh, email, hashedPassword, empresa, tipo_veiculo, modelo, placa]
        );

        console.log('Motorista registrado com sucesso:', result.rows[0].id);

        res.status(201).json({ id: result.rows[0].id, message: 'Motorista registrado com sucesso' });
    } catch (err) {
        console.error('Erro ao registrar motorista:', err);

        if (err.code === '23505') {
            res.status(400).json({ error: 'CPF, CNH, email ou placa já cadastrados' });
        } else {
            res.status(500).json({ error: 'Erro ao registrar motorista' });
        }
    }
});

app.post('/api/loginMotoristasAdministrativos', async (req, res) => {
    const { email, senha } = req.body;

    try {
        const userQuery = await pool.query('SELECT * FROM motoristas_administrativos WHERE email = $1', [email]);
        if (userQuery.rows.length === 0) {
            return res.status(404).send('Usuário não encontrado.');
        }

        const user = userQuery.rows[0];
        const isValidPassword = await bcrypt.compare(senha, user.senha);

        if (!isValidPassword) {
            return res.status(401).send('Senha incorreta.');
        }

        req.session.user = {
            id: user.id,
            nome: user.nome_completo,
            email: user.email,
            role: 'motorista_administrativo'
        };

        res.json({ userId: user.id, nome: user.nome_completo, empresa: user.empresa });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).send('Erro ao processar o login');
    }
});

/* API'S PARA APLICATIVO DE TRANSPORTE ESCOLAR*/

app.post('/api/motoristas_escolares/register', async (req, res) => {
    const {
        nome_completo,
        cpf,
        cnh,
        tipo_veiculo,
        placa,
        empresa,
        email,
        senha,
        status,
        criado_em,
        rota_id,
    } = req.body;

    console.log('Recebendo requisição de cadastro:', req.body);

    try {
        const hashedPassword = await bcrypt.hash(senha, 10);
        const result = await pool.query(
            `INSERT INTO motoristas_escolares (nome_completo, cpf, cnh, tipo_veiculo, placa, empresa, email, senha, status, criado_em, rota_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
            [nome_completo, cpf, cnh, tipo_veiculo, placa, empresa, email, hashedPassword, status, criado_em, rota_id]
        );
        console.log('Cadastro realizado com sucesso, ID:', result.rows[0].id);
        res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
        console.error('Erro ao cadastrar motorista:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/loginMotoristasEscolares', async (req, res) => {
    const { email, senha } = req.body;

    console.log('Tentativa de login com:', email, senha);  // Adiciona log para depuração

    try {
        const query = `
        SELECT id, nome_completo AS nome, senha
        FROM public.motoristas_escolares
        WHERE email = $1
        LIMIT 1
      `;
        const values = [email];
        const result = await pool.query(query, values);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            const match = await bcrypt.compare(senha, user.senha);
            if (match) {
                res.json({ id: user.id, nome: user.nome });
            } else {
                res.status(401).json({ message: 'Credenciais inválidas' });
            }
        } else {
            res.status(401).json({ message: 'Credenciais inválidas' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

app.post('/api/solicitarTransporte', async (req, res) => {
    const { nome_responsavel, cpf_responsavel, nome_aluno, id_matricula, coordenadas_aluno } = req.body;

    // Verificação para garantir que as coordenadas estão presentes
    if (!coordenadas_aluno || !coordenadas_aluno.lat || !coordenadas_aluno.lng) {
        return res.status(400).json({ success: false, message: 'Coordenadas do aluno são inválidas ou não foram fornecidas.' });
    }

    try {
        const coordenadasString = `${coordenadas_aluno.lat},${coordenadas_aluno.lng}`;

        // Log dos dados que serão enviados ao banco de dados
        console.log('Dados a serem inseridos:', {
            nome_responsavel,
            cpf_responsavel,
            nome_aluno,
            id_matricula,
            coordenadas_aluno: coordenadasString
        });

        const result = await pool.query(
            `INSERT INTO solicitacoes_transporte (nome_responsavel, cpf_responsavel, nome_aluno, id_matricula, coordenadas_aluno) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id`,
            [nome_responsavel, cpf_responsavel, nome_aluno, id_matricula, coordenadasString]
        );

        res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erro ao processar a solicitação' });
    }
});




app.get('/api/verificar-direito-transporte', async (req, res) => {
    const { endereco, latitude, longitude, escola_id } = req.query;

    try {
        // Buscar as coordenadas da escola no banco de dados usando o Pool
        const query = 'SELECT latitude, longitude FROM escolas WHERE id = $1';
        const result = await pool.query(query, [escola_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Escola não encontrada.' });
        }

        const escolaCoords = result.rows[0];
        const escolaLatitude = escolaCoords.latitude;
        const escolaLongitude = escolaCoords.longitude;

        // Construir a URL da API do Google Maps Directions
        const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${latitude},${longitude}&destination=${escolaLatitude},${escolaLongitude}&mode=walking&key=AIzaSyCAwvAt4l0Pkb1c52FLUE-ttVxm4YZ9J8M`;

        // Chamar a API do Google Maps Directions
        const response = await axios.get(directionsUrl);
        const distanceInMeters = response.data.routes[0].legs[0].distance.value;

        // Verificar se o aluno tem direito ao transporte
        const distanceInKilometers = distanceInMeters / 1000;
        const temDireito = distanceInKilometers >= 2;

        // Enviar a resposta
        res.json({
            direitoTransporte: temDireito,
            mensagem: temDireito ? 'O aluno tem direito ao transporte escolar.' : 'O aluno não tem direito ao transporte escolar.',
        });

    } catch (error) {
        console.error('Erro ao verificar direito ao transporte:', error);
        res.status(500).json({ error: 'Erro ao processar a solicitação.' });
    }
});


app.post('/api/enviar-feedback', async (req, res) => {
    console.log('Corpo da requisição:', req.body);

    const { nome, mensagem } = req.body;

    try {
        const query = 'INSERT INTO feedback (nome, mensagem) VALUES ($1, $2)';
        const values = [nome, mensagem];
        await pool.query(query, values);

        res.status(200).json({ message: 'Feedback enviado com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar o feedback:', error);
        res.status(500).json({ message: 'Erro ao enviar o feedback. Tente novamente mais tarde.' });
    }
});

// BOT DO SETOR DE TRANSPORTE

app.post('/api/verificar-id', async (req, res) => {
    const { id_aluno } = req.body;

    console.log('ID de matrícula recebido:', id_aluno);  // Log do ID recebido

    if (!id_aluno) {
        console.log('ID de matrícula do aluno não foi fornecido');
        return res.status(400).json({ status: 'fail', message: 'ID de matrícula do aluno não fornecido' });
    }

    try {
        // Consulta SQL para buscar as informações do aluno
        const query = 'SELECT id_matricula, nome, dt_nascimento, endereco FROM public.alunos WHERE id_matricula = $1';
        console.log('Consulta SQL:', query);  // Log da consulta SQL
        const result = await pool.query(query, [id_aluno]);

        console.log('Resultado da consulta:', result.rows);  // Log do resultado da consulta

        if (result.rows.length > 0) {
            const aluno = result.rows[0];
            const formattedDate = formatDate(aluno.dt_nascimento);  // Formatar a data de nascimento
            console.log('ID de matrícula encontrado:', aluno.id_matricula);
            res.status(200).json({
                status: 'success',
                message: 'ID de matrícula encontrado',
                data: {
                    nome: aluno.nome,
                    dt_nascimento: formattedDate,
                    endereco: aluno.endereco
                }
            });
        } else {
            console.log('ID de matrícula não encontrado');
            res.status(404).json({ status: 'fail', message: 'ID de matrícula não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao verificar ID de matrícula:', error);
        res.status(500).json({ status: 'error', message: 'Erro no servidor' });
    }
});

app.post('/api/enviar-solicitacao', upload.fields([
    { name: 'comprovante_endereco', maxCount: 1 },
    { name: 'laudo_deficiencia', maxCount: 1 }
]), async (req, res) => {
    try {
        const {
            nome_responsavel,
            cpf_responsavel,
            celular_responsavel,
            cep,
            numero,
            endereco,
            latitude,
            longitude,
            id_matricula_aluno,
            deficiencia,
            escola_id
        } = req.body;

        const comprovanteEnderecoPath = req.files['comprovante_endereco'] ? req.files['comprovante_endereco'][0].path : null;
        const laudoDeficienciaPath = req.files['laudo_deficiencia'] ? req.files['laudo_deficiencia'][0].path : null;

        // Inserir os dados no banco de dados
        const query = `
            INSERT INTO solicitacoes_rota 
            (nome_responsavel, cpf_responsavel, celular_responsavel, cep, numero, endereco, latitude, longitude, id_matricula_aluno, deficiencia, escola_id, comprovante_endereco, laudo_deficiencia)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id;
        `;
        const values = [
            nome_responsavel,
            cpf_responsavel,
            celular_responsavel,
            cep,
            numero,
            endereco,
            latitude,
            longitude,
            id_matricula_aluno,
            deficiencia,
            escola_id,
            comprovanteEnderecoPath,
            laudoDeficienciaPath
        ];

        const result = await pool.query(query, values);

        res.status(200).json({ message: 'Solicitação enviada com sucesso!', id: result.rows[0].id });
    } catch (error) {
        console.error('Erro ao enviar a solicitação:', error);
        res.status(500).json({ message: 'Erro ao enviar a solicitação. Tente novamente mais tarde.' });
    }
});

app.post('/consulta_motorista', async (req, res) => {
    const { cpf } = req.body;

    try {
        const query = 'SELECT nome_completo, cpf, cnh, empresa, tipo_veiculo, placa FROM motoristas_administrativos WHERE cpf = $1 LIMIT 1';
        const result = await pool.query(query, [cpf]);

        if (result.rows.length > 0) {
            const motorista = result.rows[0];
            res.json(motorista);
        } else {
            res.status(404).json({ error: 'Motorista não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao consultar motorista:', error);
        res.status(500).json({ error: 'Erro ao consultar motorista' });
    }
});

app.post('/atualizar_status', async (req, res) => {
    const { cpf, status } = req.body;

    try {
        const query = 'UPDATE motoristas_administrativos SET status = $1 WHERE cpf = $2';
        const result = await pool.query(query, [status, cpf]);

        if (result.rowCount > 0) {
            res.json({ message: 'Status atualizado com sucesso' });
        } else {
            res.status(404).json({ error: 'Motorista não encontrado para atualização' });
        }
    } catch (error) {
        console.error('Erro ao atualizar status do motorista:', error);
        res.status(500).json({ error: 'Erro ao atualizar status do motorista' });
    }
});

// ================================================================
// ===================== BOT DE AUTOATENDIMENTO ====================
// ================================================================

const ACCESS_TOKEN = 'EAAUjWN47iroBO0SMKeV0Nt8FI9XT1fIvM0CgYoGq2asPD7eTok1F1A8kaOJutrAZBAzaTCxZBObRZBly2ZB26Tg7nOZAeD5n1ze5oHwzC0oB0eANgibK45CWEBbgiOoT3LV8XKUoBjxBSD1HfMOPEDlipM9X9xgMqlPaT5ZCNmRi8BAe9p7ZANiOZAiASfyJq5dGOKDn20DZBtQMZAbvl5bpPRV3baPpptPcFqSDU1';
const PHONE_NUMBER_ID = '447260911797954';
const WHATSAPP_API_URL = 'https://graph.facebook.com/v20.0';

app.post('/webhook', async (req, res) => {
    const data = req.body;
  
    // Verifica se é uma mensagem
    if (data.object && data.entry && data.entry[0].changes && data.entry[0].changes[0].value.messages) {
      const message = data.entry[0].changes[0].value.messages[0];
  
      // Verifica se não é mensagem de grupo
      if (message.type !== 'group') {
        const senderNumber = message.from;
  
        // Envia a mensagem de menu interativo
        await sendInteractiveMenu(senderNumber);
      }
    }
  
    res.sendStatus(200);
  });
  
  // Função para enviar menu interativo
  async function sendInteractiveMenu(to) {
    const menuMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: '🚍 Bem-vindo ao Sistema de Autoatendimento do Setor de Transporte Municipal! 🚍\n\nAqui você encontra as opções de serviço para facilitar o seu atendimento.\n\nPor favor, selecione o número correspondente à sua opção:'
        },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'option_1', title: '1️⃣ Pais Responsáveis e Alunos' } },
            { type: 'reply', reply: { id: 'option_2', title: '2️⃣ Servidores SEMED' } },
            { type: 'reply', reply: { id: 'option_3', title: '3️⃣ Servidores Escola' } },
            { type: 'reply', reply: { id: 'option_4', title: '4️⃣ Fornecedores' } },
            { type: 'reply', reply: { id: 'option_5', title: '5️⃣ Motoristas' } },
            { type: 'reply', reply: { id: 'option_6', title: '❌ Encerrar Atendimento' } },
          ]
        }
      }
    };
  
    try {
      const response = await axios.post(
        `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
        menuMessage,
        { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
      );
  
      console.log('Mensagem enviada:', response.data);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error.response ? error.response.data : error.message);
    }
  }


app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, 'views', 'pages', '404.html'));
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});