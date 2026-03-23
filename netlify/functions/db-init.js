import { neon } from '@netlify/neon';

const sql = neon(process.env.NETLIFY_DATABASE_URL);

export default async (req, context) => {
  try {
    // EMPRESAS
    await sql`
      CREATE TABLE IF NOT EXISTS empresas (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        cnpj VARCHAR(20),
        endereco TEXT,
        setor_atividade VARCHAR(255),
        porte VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // USUÁRIOS (perfis)
    await sql`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id),
        nome VARCHAR(255),
        email VARCHAR(255),
        perfil VARCHAR(20) NOT NULL CHECK (perfil IN ('rh','sst','admin')),
        senha_hash VARCHAR(255) NOT NULL,
        ativo BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // AVALIAÇÕES COPSOQ II
    await sql`
      CREATE TABLE IF NOT EXISTS avaliacoes (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id),
        setor VARCHAR(255),
        respostas JSONB NOT NULL,
        scores JSONB NOT NULL,
        score_geral INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // INVENTÁRIO DE RISCOS
    await sql`
      CREATE TABLE IF NOT EXISTS inventario (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id),
        perigo VARCHAR(500) NOT NULL,
        agravos TEXT,
        setor VARCHAR(255),
        severidade INTEGER NOT NULL,
        probabilidade INTEGER NOT NULL,
        medidas TEXT,
        origem VARCHAR(50),
        origem_score INTEGER,
        auto BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // PLANO DE AÇÃO
    await sql`
      CREATE TABLE IF NOT EXISTS plano_acao (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id),
        inventario_id INTEGER REFERENCES inventario(id),
        acao TEXT NOT NULL,
        responsavel VARCHAR(255),
        prazo DATE,
        prioridade VARCHAR(20),
        status VARCHAR(30) DEFAULT 'Pendente',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // CHECKLIST NR-1
    await sql`
      CREATE TABLE IF NOT EXISTS checklist (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id),
        item_id VARCHAR(10) NOT NULL,
        concluido BOOLEAN DEFAULT false,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(empresa_id, item_id)
      )
    `;

    // RELATOS ASSÉDIO SEXUAL (confidencial)
    await sql`
      CREATE TABLE IF NOT EXISTS relatos_assedio (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id),
        setor VARCHAR(255),
        respostas JSONB,
        identificacao JSONB,
        visualizado_por JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // LOG DE ACESSO (auditoria)
    await sql`
      CREATE TABLE IF NOT EXISTS log_acesso (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER,
        usuario_id INTEGER,
        perfil VARCHAR(20),
        acao VARCHAR(100),
        detalhes JSONB,
        ip VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Empresa padrão se não existir
    const empresas = await sql`SELECT id FROM empresas LIMIT 1`;
    if (empresas.length === 0) {
      await sql`
        INSERT INTO empresas (nome, cnpj) VALUES ('Minha Empresa', '00.000.000/0000-00')
      `;
    }

    return new Response(JSON.stringify({ ok: true, message: 'Banco inicializado com sucesso' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/api/db-init' };
