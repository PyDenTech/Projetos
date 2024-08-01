CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR NOT NULL,
    cpf VARCHAR,
    telefone VARCHAR,
    email VARCHAR NOT NULL,
    password VARCHAR NOT NULL,
    foto_perfil VARCHAR,
    init BOOLEAN DEFAULT FALSE,
    role VARCHAR,
    reset_password_token VARCHAR,
    reset_password_expires BIGINT;
);

CREATE TABLE IF NOT EXISTS escolas (
    id SERIAL PRIMARY KEY,
    latitude DECIMAL(9, 6) NOT NULL,
    longitude DECIMAL(9, 6) NOT NULL,
    area_urbana BOOLEAN NOT NULL,
    logradouro VARCHAR(255) NOT NULL,
    numero VARCHAR(50),
    complemento VARCHAR(255),
    bairro VARCHAR(255) NOT NULL,
    cep VARCHAR(20) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    inep VARCHAR(20) NOT NULL,
    regular BOOLEAN,
    eja BOOLEAN,
    profissionalizante BOOLEAN,
    especial BOOLEAN,
    infantil BOOLEAN,
    fundamental BOOLEAN,
    medio BOOLEAN,
    superior BOOLEAN,
    manha BOOLEAN,
    tarde BOOLEAN,
    noite BOOLEAN,
    zoneamentos JSONB NOT NULL,
    bairro_id INT REFERENCES bairros(id)
);

CREATE TABLE IF NOT EXISTS bairros (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS alunos (
    id SERIAL PRIMARY KEY,
    unidade VARCHAR(255),
    id_escola INT REFERENCES escolas(id),
    cod_censo VARCHAR(50),
    ano INT,
    nome VARCHAR(255),
    dt_nascimento DATE,
    situacao VARCHAR(50),
    serie VARCHAR(50),
    turma VARCHAR(50),
    endereco VARCHAR(255),
    rota_transporte VARCHAR(255),
    id_matricula VARCHAR(50) UNIQUE,
    usa_transporte_escolar BOOLEAN
);

CREATE TABLE IF NOT EXISTS rotas (
    id SERIAL PRIMARY KEY,
    tipo_rota VARCHAR NOT NULL,
    nome_rota VARCHAR NOT NULL,
    identificador_unico INTEGER NOT NULL,
    horarios_funcionamento JSONB NOT NULL,
    dificuldades_acesso JSONB,
    escolas_atendidas JSONB NOT NULL,
    alunos_atendidos JSONB,
    data_cadastro TIMESTAMP DEFAULT NOW(),
    area_urbana BOOLEAN
);

CREATE TABLE IF NOT EXISTS rotas_geradas (
    id SERIAL PRIMARY KEY,
    ponto_inicial JSONB NOT NULL,
    pontos_parada JSONB NOT NULL,
    ponto_final JSONB NOT NULL,
    rota_id INTEGER REFERENCES rotas(id),
    distancia_total DOUBLE PRECISION NOT NULL,
    tempo_total DOUBLE PRECISION NOT NULL,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS motoristas (
    id SERIAL PRIMARY KEY,
    nome_completo VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL UNIQUE,
    cnh VARCHAR(20) NOT NULL UNIQUE,
    tipo_veiculo VARCHAR(50) NOT NULL,
    placa VARCHAR(10) NOT NULL UNIQUE,
    empresa VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'fora de serviço',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stop_points (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    latitude DECIMAL(9, 6),
    longitude DECIMAL(9, 6)
);

CREATE TABLE IF NOT EXISTS fornecedores (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    tipo_contrato VARCHAR(255),
    cnpj VARCHAR(20),
    endereco VARCHAR(255),
    contato VARCHAR(20),
    latitude DECIMAL(9, 6),
    longitude DECIMAL(9, 6)
);

CREATE TABLE IF NOT EXISTS expediente (
    id SERIAL PRIMARY KEY,
    motorista_id INTEGER REFERENCES motoristas_administrativos(id),
    horas_trabalhadas INTERVAL,
    horas_almoco INTERVAL,
    data DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS abastecimentos (
    id SERIAL PRIMARY KEY,
    modelo VARCHAR(255) NOT NULL,
    placa VARCHAR(10) NOT NULL,
    quilometragem INTEGER NOT NULL,
    tipo_combustivel VARCHAR(50) NOT NULL,
    quantidade_litros DECIMAL(10, 2) NOT NULL,
    motorista_id INTEGER NOT NULL,
    FOREIGN KEY (motorista_id) REFERENCES motoristas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS motoristas_administrativos (
    id SERIAL PRIMARY KEY,
    nome_completo VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL UNIQUE,
    cnh VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    empresa VARCHAR(50) NOT NULL,
    tipo_veiculo VARCHAR(50) NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    placa VARCHAR(10) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'fora de serviço',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);