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
const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
const SECRET_KEY = 'DeD-140619';
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

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 20,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 2000,
});

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // TTL padrão de 300 segundos (5 minutos)

// Middleware de autenticação
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, motorista) => {
        if (err) return res.sendStatus(403);
        req.motorista = motorista;
        next();
    });
};

pool.connect(err => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados', err.stack);
    } else {
        console.log('Conectado ao banco de dados');
    }
});

function ensureLoggedIn(req, res, next) {
    if (!req.session.user) {
        return res.status(401).send('Você precisa estar logado para acessar esta página.');
    }
    next();
}

function isAdmin(req, res, next) {
    if (req.session.admin && req.session.admin.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Acesso negado' });
    }
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/dashboard-escolar', ensureLoggedIn, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'pages', 'dashboard-escolar.html'));
});

app.get('/dashboard-adm', ensureLoggedIn, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'pages', 'dashboard-adm.html'));
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

app.post('/api/upload-foto-perfil', ensureLoggedIn, upload.single('foto_perfil'), async (req, res) => {
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

const pages = [
    'cadastrar-aluno-form',
    'admin-dashboard',
    'importar-aluno-form',
    'gerenciar-alunos-view',
    'cadastrar-escolas-form',
    'cadastrar-pontos',
    'gerenciar-escolas-view',
    'vizualizar-escolas-map',
    'cadastrar-fornecedores-form',
    'cadastrar-rotas-form',
    'desenhar-rotas-map',
    'visualizar-rotas',
    'cadastrar-zona-form',
    'gerenciar-zona-view',
    'check-list-view',
    'cadastrar-demandas',
    'gerenciar-motorista-carro-form',
    'faq',
    'users-profile',
    'gerenciar-motoristas-view'
];

pages.forEach(page => {
    app.get(`/${page}`, ensureLoggedIn, (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'pages', `${page}.html`));
    });
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'pages', 'admin.html'));
});

// Função para converter data no formato DD/MM/YYYY para YYYY-MM-DD
function converterData(data) {
    if (typeof data === 'number') {
        const excelDate = new Date((data - (25567 + 1)) * 86400 * 1000);
        return excelDate.toISOString().split('T')[0];
    } else if (typeof data === 'string') {
        const [dia, mes, ano] = data.split('/');
        return `${ano}-${mes}-${dia}`;
    } else {
        throw new Error('Data deve ser uma string ou número');
    }
}

// Função para normalizar strings
function normalizeString(str) {
    return str.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
}
// Rota para upload de arquivo Excel
app.post('/upload-planilha', upload.single('file'), async (req, res) => {
    const filePath = req.file.path;

    try {
        // Ler o arquivo Excel
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        // Inserir dados no banco de dados
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

            // Normalizar o nome da escola
            const normalizedUnidade = normalizeString(Unidade);

            // Encontrar a escola correspondente
            const escolaResult = await pool.query('SELECT id FROM escolas WHERE LOWER(TRIM(nome)) = $1', [normalizedUnidade]);
            const id_escola = escolaResult.rows[0]?.id;

            if (id_escola) {
                await pool.query(
                    `INSERT INTO alunos (
                        unidade, id_escola, id_matricula, cod_censo, ano, nome, dt_nascimento, situacao, serie, turma, endereco, rota_transporte, usa_transporte_escolar
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                    [Unidade, id_escola, id_matricula, cod_censo, ano, nome, formattedNascimento, situacao, serie, turma, endereco, rota_transporte, usa_transporte_escolar === 'SIM']
                );
            } else {
                console.error(`Escola não encontrada: ${Unidade}`);
            }
        }

        res.send('Dados importados com sucesso!');
    } catch (error) {
        console.error('Erro ao importar dados:', error);
        res.status(500).send('Erro ao importar dados');
    }
});

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

app.post('/admin/login', async (req, res) => {
    const { email, senha } = req.body;

    try {
        const userQuery = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND role = $2', [email, 'admin']);
        if (userQuery.rows.length === 0) {
            return res.status(404).send('Usuário não encontrado.');
        }

        const user = userQuery.rows[0];
        const isValidPassword = await bcrypt.compare(senha, user.password);

        if (!isValidPassword) {
            return res.status(401).send('Senha incorreta.');
        }

        if (!user.init) {
            return res.status(403).send('Usuário não ativado. Por favor, contate o administrador.');
        }

        req.session.user = {
            id: user.id,
            nome: user.nome,
            email: user.email,
            role: 'admin'
        };

        res.json({ message: "Login successful", redirectUrl: '/admin-dashboard' });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).send('Erro ao processar o login');
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


app.post('/api/loginMotoristasEscolares', async (req, res) => {
    const { email, senha } = req.body;

    try {
        const userQuery = await pool.query('SELECT * FROM motoristasescolares WHERE email = $1', [email]);
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
            role: 'motorista_escolar'
        };

        res.json({ userId: user.id, nome: user.nome_completo, empresa: user.empresa });
    } catch (error) {
        console.error('Erro no login:', error);
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
            role: 'web'
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

const saltRounds = 10;

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

// Rota unificada de cadastro
app.post('/api/cadastrar-usuario', async (req, res) => {
    const { nome_completo, cpf, telefone, email, senha, cnh, empresa, tipo_veiculo, modelo, placa, tipo } = req.body;

    try {
        const emailJaExiste = await emailExiste(email);
        const cpfJaExiste = await cpfExiste(cpf);

        if (emailJaExiste) {
            return res.status(400).json({ error: 'Este email já está cadastrado.' });
        }

        if (cpfJaExiste) {
            return res.status(400).json({ error: 'Este CPF já está cadastrado.' });
        }

        const hashedPassword = await bcrypt.hash(senha, saltRounds);
        let usuarioId;

        switch (tipo) {
            case 'admin':
                const novoAdmin = await pool.query(
                    'INSERT INTO usuarios (nome, cpf, telefone, email, password, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                    [nome_completo, cpf, telefone, email, hashedPassword, 'admin']
                );
                usuarioId = novoAdmin.rows[0].id;
                break;
            case 'motorista_escolar':
                const novoMotoristaEscolar = await pool.query(
                    'INSERT INTO motoristasescolares (nome_completo, cpf, cnh, tipo_veiculo, placa, empresa, email, senha) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                    [nome_completo, cpf, cnh, tipo_veiculo, placa, empresa, email, hashedPassword]
                );
                usuarioId = novoMotoristaEscolar.rows[0].id;
                break;
            case 'motorista_administrativo':
                const novoMotoristaAdministrativo = await pool.query(
                    'INSERT INTO motoristas_administrativos (nome_completo, cpf, cnh, empresa, tipo_veiculo, modelo, placa, email, senha) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
                    [nome_completo, cpf, cnh, empresa, tipo_veiculo, modelo, placa, email, hashedPassword]
                );
                usuarioId = novoMotoristaAdministrativo.rows[0].id;
                break;
            default:
                return res.status(400).json({ error: 'Tipo de usuário inválido.' });
        }

        res.status(201).json({ message: 'Usuário cadastrado com sucesso.', usuarioId });
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
        const result = await pool.query('SELECT id, nome FROM bairros ORDER BY nome');
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
            res.json(result.rows[0]);
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
        nome, inep, latitude, longitude, logradouro, numero, complemento, bairro, cep, area_urbana
    } = req.body;

    try {
        const result = await pool.query(
            `UPDATE escolas SET nome = $1, inep = $2, latitude = $3, longitude = $4, logradouro = $5,
            numero = $6, complemento = $7, bairro = $8, cep = $9, area_urbana = $10 WHERE id = $11 RETURNING *`,
            [nome, inep, latitude, longitude, logradouro, numero, complemento, bairro, cep, area_urbana, id]
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
        tipoRota,
        nomeRota,
        horariosFuncionamento,
        dificuldadesAcesso,
        areaUrbana,
        escolasAtendidas,
        alunosAtendidos
    } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO rotas (
                tipo_rota, 
                nome_rota, 
                horarios_funcionamento, 
                dificuldades_acesso, 
                area_urbana,
                escolas_atendidas, 
                alunos_atendidos
            ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6::jsonb, $7::jsonb) RETURNING *`,
            [
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


app.get('/api/rotas', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM rotas');

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Nenhuma rota encontrada' });
        }

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar rotas:', error);
        res.status(500).json({ error: 'Erro ao buscar rotas' });
    }
});

// Endpoint para buscar informações de uma rota por ID
app.get('/api/rotas', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                r.id, 
                r.nome_rota, 
                r.horarios_funcionamento, 
                r.escolas_atendidas, 
                r.area_urbana, 
                r.dificuldades_acesso, 
                r.alunos_atendidos, 
                r.data_cadastro, 
                rg.detalhes, 
                rg.distancia, 
                rg.tempo 
            FROM rotas r 
            LEFT JOIN rotas_geradas rg ON r.id = rg.rota_id
        `);
        const rotas = result.rows.map(rota => ({
            ...rota,
            horarios_funcionamento: JSON.parse(rota.horarios_funcionamento),
            escolas_atendidas: JSON.parse(rota.escolas_atendidas),
            alunos_atendidos: rota.alunos_atendidos ? JSON.parse(rota.alunos_atendidos) : null,
            distancia: rota.distancia ? rota.distancia.toString().replace('.', ',') : 'undefined',
            tempo: rota.tempo ? rota.tempo.toString().replace('.', ',') : 'undefined'
        }));
        res.json(rotas);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Endpoint para obter os nomes das escolas pelos IDs
app.post('/api/escolas-nomes', async (req, res) => {
    const { ids } = req.body;
    try {
        const result = await pool.query(
            'SELECT id, nome FROM escolas WHERE id = ANY($1)',
            [ids]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});


// Endpoint para editar uma rota
app.put('/api/rotas/:id', async (req, res) => {
    const { id } = req.params;
    const { tipo_rota, nome_rota, horarios_funcionamento, dificuldades_acesso, escolas_atendidas, alunos_atendidos, area_urbana } = req.body;

    try {
        const result = await pool.query(
            `UPDATE rotas
             SET tipo_rota = $1, nome_rota = $2, horarios_funcionamento = $3, dificuldades_acesso = $4,
                 escolas_atendidas = $5, alunos_atendidos = $6, area_urbana = $7
             WHERE id = $8
             RETURNING *`,
            [tipo_rota, nome_rota, horarios_funcionamento, dificuldades_acesso, escolas_atendidas, alunos_atendidos, area_urbana, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Rota não encontrada' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao editar rota:', error);
        res.status(500).json({ error: 'Erro ao editar rota' });
    }
});

// Endpoint para excluir uma rota
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

// Endpoint para buscar alunos por escola
app.get('/api/alunos', async (req, res) => {
    const { escolaIds } = req.query;
    try {
        const result = await pool.query('SELECT * FROM alunos WHERE id_escola = ANY($1::int[])', [escolaIds.split(',').map(id => parseInt(id, 10))]);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar alunos:', error);
        res.status(500).send('Erro ao buscar alunos');
    }
});

// Endpoint para buscar um aluno específico por ID
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

// Endpoint para editar um aluno
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

// Endpoint para excluir um aluno
app.delete('/api/alunos/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM alunos WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length > 0) {
            res.json({ message: 'Aluno excluído com sucesso' });
        } else {
            res.status(404).send('Aluno não encontrado');
        }
    } catch (error) {
        console.error('Erro ao excluir aluno:', error);
        res.status(500).send('Erro ao excluir aluno');
    }
});


// Endpoint para obter uma rota gerada específica

/* app.get('/api/rota-gerada/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT coordenadas FROM rotas_geradas WHERE rota_id = $1', [id]);
        if (result.rows.length > 0) {
            res.json(JSON.parse(result.rows[0].coordenadas));
        } else {
            res.status(404).json({ message: 'Rota gerada não encontrada' });
        }
    } catch (error) {
        console.error('Erro ao buscar rota gerada:', error);
        res.status(500).json({ message: 'Erro ao buscar rota gerada' });
    }
}); */


app.get('/api/dashboard-data', async (req, res) => {
    let client;
    try {
        client = await pool.connect();

        // Consultas para obter dados
        const [escolasResult, alunosResult, rotasResult, quilometragemTotalResult, rotasMensaisResult] = await Promise.all([
            client.query('SELECT COUNT(*) AS count FROM escolas'),
            client.query('SELECT COUNT(*) AS count FROM alunos'),
            client.query('SELECT COUNT(*) AS count FROM rotas'),
            client.query('SELECT SUM(distancia) AS quilometragemTotal FROM rotas_geradas'),
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
            `)
        ]);

        // Processando os resultados
        const escolasCount = escolasResult.rows[0].count;
        const alunosCount = alunosResult.rows[0].count;
        const rotasCount = rotasResult.rows[0].count;
        const quilometragemTotal = quilometragemTotalResult.rows[0].quilometragemtotal;

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
            rotasMensais
        });
    } catch (error) {
        console.error('Erro ao buscar dados do dashboard:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do dashboard' });
    } finally {
        if (client) client.release();
    }
});

// Endpoint para obter todos os pontos de parada
app.get('/api/stop-points', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM stop_points');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching stop points:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint para armazenar os pontos de parada
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

// Endpoint para buscar todos os fornecedores
app.get('/api/fornecedores', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM fornecedores');
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar fornecedores:', error);
        res.status(500).json({ error: 'Erro ao buscar fornecedores' });
    }
});

// Endpoint para buscar um fornecedor específico
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

// Endpoint para obter todas as escolas
app.get('/api/escolas', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM escolas');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching schools:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint para salvar a rota gerada
app.post('/api/salvar-rota-gerada', async (req, res) => {
    const { rotaId, coordenadas, detalhes, distancia, tempo, pontos_parada } = req.body;

    if (!rotaId || !coordenadas || !detalhes || !distancia || !tempo || !pontos_parada) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Verificar se a rota já foi salva
            const checkQuery = 'SELECT * FROM rotas_geradas WHERE rota_id = $1';
            const checkResult = await client.query(checkQuery, [rotaId]);

            if (checkResult.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'Rota já foi salva anteriormente' });
            }

            const insertQuery = `
                INSERT INTO rotas_geradas (rota_id, coordenadas, detalhes, distancia, tempo, pontos_parada)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `;

            const result = await client.query(insertQuery, [
                rotaId,
                coordenadas,
                detalhes,
                distancia,
                tempo,
                JSON.stringify(pontos_parada)
            ]);

            await client.query('COMMIT');

            res.status(201).json(result.rows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Erro ao salvar rota gerada:', err);
            res.status(500).json({ error: 'Erro interno do servidor' });
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
        res.status(500).json({ error: 'Erro de conexão com o banco de dados' });
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


// Endpoint para buscar demandas pendentes
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


// Endpoint para criar um novo aviso
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

        // Excluir de motoristasescolares primeiro se existir
        await client.query('DELETE FROM motoristasescolares WHERE id = $1', [userId]);

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

app.get('/api/motoristasescolares', async (req, res) => {
    try {
        const result = await pool.query(`
        SELECT m.*, r.id AS rota_id, r.nome_rota AS rota_nome
        FROM motoristasescolares m
        LEFT JOIN rotas r ON m.rota_id = r.id
      `);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar motoristas:', error);
        res.status(500).json({ error: 'Erro ao processar a solicitação' });
    }
});

// Endpoint para obter um motorista escolar por ID
app.get('/api/motoristasescolares/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('SELECT * FROM motoristasescolares WHERE id = $1', [id]);

        if (result.rows.length > 0) {
            res.status(200).json(result.rows[0]);
        } else {
            res.status(404).json({ message: 'Motorista não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao buscar dados do motorista:', error);
        res.status(500).json({ message: 'Erro ao processar a solicitação' });
    }
});

app.get('/api/rotas/motorista/:motorista_id', async (req, res) => {
    const { motorista_id } = req.params;
    try {
        console.log(`Buscando rotas para o motorista com ID: ${motorista_id}`);
        const result = await pool.query(
            `SELECT r.id, r.nome_rota
             FROM rotas r
             JOIN motoristasescolares m ON r.id = m.rota_id
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


app.get('/api/rota-gerada/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT coordenadas FROM rotas_geradas WHERE rota_id = $1', [id]);
        if (result.rows.length > 0) {
            res.json(JSON.parse(result.rows[0].coordenadas));
        } else {
            res.status(404).json({ message: 'Rota gerada não encontrada' });
        }
    } catch (error) {
        console.error('Erro ao buscar rota gerada:', error);
        res.status(500).json({ message: 'Erro ao buscar rota gerada' });
    }
});


app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, 'views', 'pages', '404.html'));
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
