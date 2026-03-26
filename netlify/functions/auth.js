const { neon } = require('@netlify/neon');
const crypto = require('crypto');

function hash(s) { return crypto.createHash('sha256').update(s+'gro_nr1_salt_2026').digest('hex'); }
function token(userId, perfil, empresaId) {
  return Buffer.from(JSON.stringify({ userId, perfil, empresaId, exp: Date.now()+8*3600000 })).toString('base64');
}

exports.handler = async function(event, context) {
  const sql = neon(process.env.NETLIFY_DATABASE_URL);
  const qs = event.queryStringParameters || {};
  const action = qs.action || 'login';
  const method = event.httpMethod;

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}, body: '' };
  }

  if (method === 'POST' && action === 'login') {
    const { senha, perfil, empresaId } = JSON.parse(event.body || '{}');
    const ADMIN_SENHA = process.env.ADMIN_SENHA || 'admin_fantasma_2026';
    
    if (perfil === 'admin' && senha === ADMIN_SENHA) {
      return { statusCode: 200, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ok: true, token: token(0,'admin',empresaId||1), perfil: 'admin' }) };
    }

    const h = hash(senha || '');
    const users = await sql`SELECT id, nome, perfil, empresa_id FROM usuarios WHERE empresa_id=${parseInt(empresaId)||1} AND perfil=${perfil} AND senha_hash=${h} AND ativo=true LIMIT 1`;
    
    if (users.length === 0) {
      return { statusCode: 401, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ok: false, error: 'Credenciais inválidas' }) };
    }

    const u = users[0];
    return { statusCode: 200, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ok: true, token: token(u.id, u.perfil, u.empresa_id), perfil: u.perfil, nome: u.nome }) };
  }

  if (method === 'POST' && action === 'setup') {
    const { empresaId, senhaRH, senhaSSTResult } = JSON.parse(event.body || '{}');
    const hRH = hash(senhaRH || 'rh1234');
    const hSST = hash(senhaSSTResult || 'sst1234');
    await sql`INSERT INTO usuarios (empresa_id, nome, perfil, senha_hash) VALUES (${empresaId||1}, 'Gestor RH', 'rh', ${hRH}) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO usuarios (empresa_id, nome, perfil, senha_hash) VALUES (${empresaId||1}, 'Técnico SST', 'sst', ${hSST}) ON CONFLICT DO NOTHING`;
    return { statusCode: 200, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 404, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ok: false, error: 'Rota não encontrada' }) };
};
