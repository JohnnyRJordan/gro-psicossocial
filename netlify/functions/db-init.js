const { neon } = require('@netlify/neon');

exports.handler = async function(event, context) {
  const sql = neon(process.env.NETLIFY_DATABASE_URL);
  try {
    await sql`CREATE TABLE IF NOT EXISTS empresas (id SERIAL PRIMARY KEY, nome VARCHAR(255) NOT NULL, cnpj VARCHAR(20), created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS usuarios (id SERIAL PRIMARY KEY, empresa_id INTEGER, nome VARCHAR(255), perfil VARCHAR(20) NOT NULL, senha_hash VARCHAR(255) NOT NULL, ativo BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS avaliacoes (id SERIAL PRIMARY KEY, empresa_id INTEGER, setor VARCHAR(255), respostas JSONB, scores JSONB NOT NULL, score_geral INTEGER NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS inventario (id SERIAL PRIMARY KEY, empresa_id INTEGER, perigo VARCHAR(500) NOT NULL, agravos TEXT, setor VARCHAR(255), severidade INTEGER, probabilidade INTEGER, medidas TEXT, origem VARCHAR(50), origem_score INTEGER, auto BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS plano_acao (id SERIAL PRIMARY KEY, empresa_id INTEGER, acao TEXT NOT NULL, responsavel VARCHAR(255), prazo DATE, prioridade VARCHAR(20), status VARCHAR(30) DEFAULT 'Pendente', created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS checklist (id SERIAL PRIMARY KEY, empresa_id INTEGER, item_id VARCHAR(10) NOT NULL, concluido BOOLEAN DEFAULT false, UNIQUE(empresa_id, item_id))`;
    await sql`CREATE TABLE IF NOT EXISTS relatos_assedio (id SERIAL PRIMARY KEY, empresa_id INTEGER, setor VARCHAR(255), respostas JSONB, identificacao JSONB, created_at TIMESTAMPTZ DEFAULT NOW())`;

    // Empresa padrão
    const emp = await sql`SELECT id FROM empresas WHERE id=1 LIMIT 1`;
    if (emp.length === 0) {
      await sql`INSERT INTO empresas (id, nome, cnpj) VALUES (1, 'Minha Empresa', '00.000.000/0000-00') ON CONFLICT DO NOTHING`;
    }

    // Usuários padrão
    const crypto = require('crypto');
    const hashRH = crypto.createHash('sha256').update('rh1234gro_nr1_salt_2026').digest('hex');
    const hashSST = crypto.createHash('sha256').update('sst1234gro_nr1_salt_2026').digest('hex');
    await sql`INSERT INTO usuarios (empresa_id, nome, perfil, senha_hash) VALUES (1, 'Gestor RH', 'rh', ${hashRH}) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO usuarios (empresa_id, nome, perfil, senha_hash) VALUES (1, 'Técnico SST', 'sst', ${hashSST}) ON CONFLICT DO NOTHING`;

    return { statusCode: 200, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ok: true, message: 'Banco inicializado' }) };
  } catch (error) {
    return { statusCode: 500, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ok: false, error: error.message }) };
  }
};
