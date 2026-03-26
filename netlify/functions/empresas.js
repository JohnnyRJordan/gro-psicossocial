const bodyData = JSON.parse(event.body || '{}');
  const { neon } = require('@netlify/neon');

const sql = neon(process.env.NETLIFY_DATABASE_URL);

function getToken(req) {
  return (event.headers['authorization'] || event.headers['Authorization'] || '')?.replace('Bearer ', '');
}
function decodeToken(token) {
  try { return JSON.parse(Buffer.from(token, 'base64').toString()); } catch { return null; }
}

exports.handler = async function(event, context) {
  const token = getToken(req);
  const payload = decodeToken(token);
  if (!payload || payload.exp < Date.now()) {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Não autorizado' }) };
  }

  const url = { searchParams: { get: (k) => { const p = new URLSearchParams(event.queryStringParameters || {}); return p.get(k); } } };
  const method = event.httpMethod;

  // Listar todas as empresas (admin vê todas, RH/SST vê só a sua)
  if (method === 'GET') {
    let empresas;
    if (payload.perfil === 'admin') {
      empresas = await sql`SELECT * FROM empresas ORDER BY nome`;
    } else {
      empresas = await sql`SELECT * FROM empresas WHERE id = ${payload.empresaId}`;
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, empresas }) };
  }

  // Criar nova empresa (apenas admin)
  if (method === 'POST' && payload.perfil === 'admin') {
    const bodyData = JSON.parse(event.body || '{}');
  const { nome, cnpj, endereco, setor_atividade, porte, senhaRH, senhaSST } = bodyData;
    if (!nome) return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Nome obrigatório' }) };

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

    return { statusCode: 201, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, empresaId }) };
  }

  // Atualizar empresa
  if (method === 'PUT' && payload.perfil === 'admin') {
    const bodyData = JSON.parse(event.body || '{}');
  const { id, nome, cnpj, endereco, setor_atividade, porte } = bodyData;
    await sql`
      UPDATE empresas SET nome=${nome}, cnpj=${cnpj}, endereco=${endereco},
      setor_atividade=${setor_atividade}, porte=${porte}
      WHERE id=${id}
    `;
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Não permitido' }) };
};

