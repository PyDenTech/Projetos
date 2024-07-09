CREATE TABLE solicitacoes_transporte (
    id SERIAL PRIMARY KEY,
    contato_responsavel VARCHAR(255),
    latitude NUMERIC,
    longitude NUMERIC,
    id_matricula_aluno VARCHAR(50),
    data_solicitacao TIMESTAMP,
    tipo_solicitacao VARCHAR(50),
    dados_aluno JSON,
    documentos JSON,
    possui_deficiencia BOOLEAN
);
