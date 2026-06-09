-- ═══════════════════════════════════════════════════════════
-- schema.sql · Chá Revelação — Thalyson & Jessica
-- Banco de Dados: PostgreSQL
-- ═══════════════════════════════════════════════════════════

-- ── EXTENSÃO para UUID (opcional, mas recomendada) ──
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ══════════════════════════════════════
-- TABELA: confirmacoes
-- Armazena cada RSVP dos convidados
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS confirmacoes (
    id               SERIAL          PRIMARY KEY,
    nome_convidado   VARCHAR(200)    NOT NULL,
    presenca         BOOLEAN         NOT NULL,               -- true = vai, false = não vai
    palpite          VARCHAR(10)     NOT NULL                -- 'menino' | 'menina' | 'neutro'
                     CHECK (palpite IN ('menino', 'menina', 'neutro')),
    data_resposta    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices para relatórios rápidos
CREATE INDEX IF NOT EXISTS idx_confirmacoes_presenca ON confirmacoes (presenca);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_palpite  ON confirmacoes (palpite);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_data     ON confirmacoes (data_resposta);


-- ══════════════════════════════════════
-- TABELA: metas_pix
-- Controla o progresso das metas de contribuição
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS metas_pix (
    id                SERIAL          PRIMARY KEY,
    item_nome         VARCHAR(50)     NOT NULL UNIQUE,       -- 'fraldas' | 'higiene' | 'ninho'
    titulo            VARCHAR(150)    NOT NULL,              -- título legível para exibir na UI
    descricao         TEXT,
    valor_meta        NUMERIC(10, 2)  NOT NULL,
    valor_arrecadado  NUMERIC(10, 2)  NOT NULL DEFAULT 0.00,
    criado_em         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_metas_item_nome ON metas_pix (item_nome);


-- ══════════════════════════════════════
-- DADOS INICIAIS: metas_pix
-- ══════════════════════════════════════
INSERT INTO metas_pix (item_nome, titulo, descricao, valor_meta, valor_arrecadado)
VALUES
    ('fraldas',
     'Estoque de Fraldas',
     'Cada fralda é um abraço de conforto para o bebê nos primeiros meses.',
     1200.00,
     450.00),

    ('higiene',
     'Higiene do Bebê',
     'Lenços umedecidos, pomadas e creminhos para cuidar da pele delicada.',
     400.00,
     180.00),

    ('ninho',
     'Ninho e Conforto do Berço',
     'Redutor de berço, travesseiros e itens para um soninho tranquilo e seguro.',
     300.00,
     120.00)
ON CONFLICT (item_nome) DO NOTHING;


-- ══════════════════════════════════════
-- FUNÇÃO: atualizar timestamp automático
-- ══════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_metas_pix_updated_at
    BEFORE UPDATE ON metas_pix
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_updated_at();


-- ══════════════════════════════════════
-- VIEWS ÚTEIS
-- ══════════════════════════════════════

-- Resumo de confirmações: totais e palpites
CREATE OR REPLACE VIEW vw_resumo_confirmacoes AS
SELECT
    COUNT(*)                                        AS total_respostas,
    SUM(CASE WHEN presenca = true  THEN 1 ELSE 0 END) AS confirmados,
    SUM(CASE WHEN presenca = false THEN 1 ELSE 0 END) AS nao_compareceram,
    SUM(CASE WHEN palpite = 'menino' THEN 1 ELSE 0 END) AS time_menino,
    SUM(CASE WHEN palpite = 'menina' THEN 1 ELSE 0 END) AS time_menina,
    SUM(CASE WHEN palpite = 'neutro' THEN 1 ELSE 0 END) AS time_neutro
FROM confirmacoes;

-- Progresso das metas em percentual
CREATE OR REPLACE VIEW vw_progresso_metas AS
SELECT
    id,
    item_nome,
    titulo,
    valor_meta,
    valor_arrecadado,
    ROUND((valor_arrecadado / NULLIF(valor_meta, 0)) * 100, 1) AS percentual,
    (valor_meta - valor_arrecadado)                             AS falta
FROM metas_pix;


-- ══════════════════════════════════════
-- QUERIES DE EXEMPLO PARA A API (Node.js / Express)
-- ══════════════════════════════════════

/*
--- INSERT: salvar confirmação de presença ---

INSERT INTO confirmacoes (nome_convidado, presenca, palpite)
VALUES ($1, $2, $3)
RETURNING id, nome_convidado, presenca, palpite, data_resposta;


--- SELECT: listar todas as confirmações ---

SELECT id, nome_convidado, presenca, palpite, data_resposta
FROM confirmacoes
ORDER BY data_resposta DESC;


--- SELECT: buscar resumo ---

SELECT * FROM vw_resumo_confirmacoes;


--- SELECT: buscar todas as metas com progresso ---

SELECT * FROM vw_progresso_metas
ORDER BY item_nome;


--- UPDATE: atualizar valor arrecadado em uma meta ---
--- (Executado pelo admin após confirmar um PIX recebido) ---

UPDATE metas_pix
SET valor_arrecadado = valor_arrecadado + $2
WHERE item_nome = $1
RETURNING *;

*/
