import { neon } from '@netlify/neon';
import crypto from 'crypto';

const sql = neon(process.env.NETLIFY_DATABASE_URL);

function hashSenha(senha) {
  return crypto.createHash('sha256').update(senha + 'gro_nr1_salt_2026').digest('hex');
}

function gerarToken(userId, perfil, empresaId) {
  const payload = { userId, perfil, empresaId, exp: Date.now() + 8 * 3600000 };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function verificarToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

export default async (req, context) => {
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'login';

  if (req.method === 'POST' && action === 'login') {
    const { senha, perfil, empresaId } = await req.json();

    // Perfil admin fantasma — verificado separadamente
    const ADMIN_SENHA = process.env.ADMIN_SENHA || 'admin_fantasma_2026';
    if (perfil === 'admin' && senha === ADMIN_SENHA) {
      const token = gerarToken(0, 'admin', empresaId || 1);
      await sql`
        INSERT INTO log_acesso (empresa_id, perfil, acao, ip)
        VALUES (${empresaId || 1}, 'admin', 'login', ${context.ip || 'unknown'})
      `;
      return new Response(JSON.stringify({ ok: true, token, perfil: 'admin' }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    // RH e SST — busca no banco
    if (!senha || !perfil || !empresaId) {
      return new Response(JSON.stringify({ ok: false, error: 'Dados incompletos' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const hash = hashSenha(senha);
    const users = await sql`
      SELECT id, nome, perfil, empresa_id FROM usuarios
      WHERE empresa_id = ${empresaId}
      AND perfil = ${perfil}
      AND senha_hash = ${hash}
      AND ativo = true
      LIMIT 1
    `;

    if (users.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Credenciais inválidas' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = users[0];
    const token = gerarToken(user.id, user.perfil, user.empresa_id);

    await sql`
      INSERT INTO log_acesso (empresa_id, usuario_id, perfil, acao, ip)
      VALUES (${user.empresa_id}, ${user.id}, ${user.perfil}, 'login', ${context.ip || 'unknown'})
    `;

    return new Response(JSON.stringify({ ok: true, token, perfil: user.perfil, nome: user.nome }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (req.method === 'GET' && action === 'verify') {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    const payload = verificarToken(token);
    if (!payload) {
      return new Response(JSON.stringify({ ok: false, error: 'Token inválido ou expirado' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ ok: true, ...payload }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }

  // Setup inicial — cria usuários padrão RH e SST
  if (req.method === 'POST' && action === 'setup') {
    const { empresaId, senhaRH, senhaSSTResult } = await req.json();
    const hashRH = hashSenha(senhaRH || 'rh1234');
    const hashSST = hashSenha(senhaSSTResult || 'sst1234');

    await sql`
      INSERT INTO usuarios (empresa_id, nome, perfil, senha_hash)
      VALUES (${empresaId}, 'Gestor RH', 'rh', ${hashRH})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      INSERT INTO usuarios (empresa_id, nome, perfil, senha_hash)
      VALUES (${empresaId}, 'Técnico SST', 'sst', ${hashSST})
      ON CONFLICT DO NOTHING
    `;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ ok: false, error: 'Rota não encontrada' }), {
    status: 404, headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { path: '/api/auth' };
