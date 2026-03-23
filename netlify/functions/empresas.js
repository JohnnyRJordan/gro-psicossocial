import { neon } from '@netlify/neon';

const sql = neon(process.env.NETLIFY_DATABASE_URL);

function getToken(req) {
  return req.headers.get('authorization')?.replace('Bearer ', '');
}
function decodeToken(token) {
  try { return JSON.parse(Buffer.from(token, 'base64').toString()); } catch { return null; }
}

export default async (req, context) => {
  const token = getToken(req);
  const payload = decodeToken(token);
  if (!payload || payload.exp < Date.now()) {
    return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(req.url);
  const method = req.method;

  // Listar todas as empresas (admin vê todas, RH/SST vê só a sua)
  if (method === 'GET') {
    let empresas;
    if (payload.perfil === 'admin') {
      empresas = await sql`SELECT * FROM empresas ORDER BY nome`;
    } else {
      empresas = await sql`SELECT * FROM empresas WHERE id = ${payload.empresaId}`;
    }
    return new Response(JSON.stringify({ ok: true, empresas }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }

  // Criar nova empresa (apenas admin)
  if (method === 'POST' && payload.perfil === 'admin') {
    const { nome, cnpj, endereco, setor_atividade, porte, senhaRH, senhaSST } = await req.json();
    if (!nome) return new Response(JSON.stringify({ ok: false, error: 'Nome obrigatório' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });

    const result = await sql`
      INSERT INTO empresas (nome, cnpj, endereco, setor_atividade, porte)
      VALUES (${nome}, ${cnpj}, ${endereco}, ${setor_atividade}, ${porte})
      RETURNING id
    `;
    const empresaId = result[0].id;

    // Cria usuários padrão para a nova empresa
    const crypto = await import('crypto');
    const hashRH = crypto.createHash('sha256').update((senhaRH || 'rh1234') + 'gro_nr1_salt_2026').digest('hex');
    const hashSST = crypto.createHash('sha256').update((senhaSST || 'sst1234') + 'gro_nr1_salt_2026').digest('hex');

    await sql`INSERT INTO usuarios (empresa_id, nome, perfil, senha_hash) VALUES (${empresaId}, 'Gestor RH', 'rh', ${hashRH})`;
    await sql`INSERT INTO usuarios (empresa_id, nome, perfil, senha_hash) VALUES (${empresaId}, 'Técnico SST', 'sst', ${hashSST})`;

    return new Response(JSON.stringify({ ok: true, empresaId }), {
      status: 201, headers: { 'Content-Type': 'application/json' }
    });
  }

  // Atualizar empresa
  if (method === 'PUT' && payload.perfil === 'admin') {
    const { id, nome, cnpj, endereco, setor_atividade, porte } = await req.json();
    await sql`
      UPDATE empresas SET nome=${nome}, cnpj=${cnpj}, endereco=${endereco},
      setor_atividade=${setor_atividade}, porte=${porte}
      WHERE id=${id}
    `;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ ok: false, error: 'Não permitido' }), {
    status: 403, headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { path: '/api/empresas' };
