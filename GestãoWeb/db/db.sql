CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR NOT NULL,
    cpf VARCHAR,
    telefone VARCHAR,
    email VARCHAR NOT NULL,
    password VARCHAR NOT NULL,
    foto_perfil VARCHAR,
    init BOOLEAN DEFAULT FALSE,
    role VARCHAR
);


CREATE TABLE escolas (
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


CREATE TABLE bairros (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS rotas (
    id SERIAL PRIMARY KEY,
    tipo_rota VARCHAR NOT NULL,
    nome_rota VARCHAR NOT NULL,
    horarios_funcionamento JSONB NOT NULL,
    dificuldades_acesso JSONB,
    escolas_atendidas JSONB NOT NULL,
    alunos_atendidos JSONB,
    data_cadastro TIMESTAMP DEFAULT NOW(),
    area_urbana BOOLEAN
);

CREATE TABLE alunos (
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

CREATE TABLE IF NOT EXISTS rotas_geradas (
    id SERIAL PRIMARY KEY,
    rota_id INT REFERENCES rotas(id),
    coordenadas JSONB,
    detalhes TEXT,
    distancia FLOAT,
    tempo FLOAT
);

CREATE TABLE IF NOT EXISTS motoristasescolares (
    id SERIAL PRIMARY KEY,
    nome VARCHAR NOT NULL,
    cpf VARCHAR NOT NULL,
    cnh VARCHAR NOT NULL,
    empresa VARCHAR NOT NULL,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    rota_id INTEGER REFERENCES rotas(id)
);

CREATE TABLE stop_points (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    latitude DECIMAL(9, 6),
    longitude DECIMAL(9, 6)
);

CREATE TABLE fornecedores (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    tipo_contrato VARCHAR(255),
    cnpj VARCHAR(20),
    endereco VARCHAR(255),
    contato VARCHAR(20),
    latitude DECIMAL(9, 6),
    longitude DECIMAL(9, 6)
);

CREATE TABLE expediente (
    id SERIAL PRIMARY KEY,
    motorista_id INTEGER REFERENCES motoristas_administrativos(id),
    horas_trabalhadas INTERVAL,
    horas_almoco INTERVAL,
    data DATE DEFAULT CURRENT_DATE
);