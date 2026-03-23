import { neon } from '@netlify/neon';
const sql = neon(process.env.NETLIFY_DATABASE_URL);
function decodeToken(t) { try { return JSON.parse(Buffer.from(t,'base64').toString()); } catch { return null; } }
function auth(req) { const p=decodeToken(req.headers.get('authorization')?.replace('Bearer ','')); return p&&p.exp>Date.now()?p:null; }

export default async (req) => {
  const p = auth(req);
  if (!p) return new Response(JSON.stringify({ok:false,error:'Não autorizado'}),{status:401,headers:{'Content-Type':'application/json'}});
  if (!['sst','admin'].includes(p.perfil)) return new Response(JSON.stringify({ok:false,error:'Acesso negado'}),{status:403,headers:{'Content-Type':'application/json'}});

  const url = new URL(req.url);
  const empresaId = url.searchParams.get('empresaId') || p.empresaId;

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM inventario WHERE empresa_id=${empresaId} ORDER BY auto DESC, created_at DESC`;
    return new Response(JSON.stringify({ok:true,inventario:rows}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if (req.method === 'POST') {
    const {perigo,agravos,setor,severidade,probabilidade,medidas} = await req.json();
    await sql`INSERT INTO inventario (empresa_id,perigo,agravos,setor,severidade,probabilidade,medidas,auto) VALUES (${empresaId},${perigo},${agravos},${setor},${severidade},${probabilidade},${medidas},false)`;
    return new Response(JSON.stringify({ok:true}),{status:201,headers:{'Content-Type':'application/json'}});
  }
  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    await sql`DELETE FROM inventario WHERE id=${id} AND empresa_id=${empresaId}`;
    return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  return new Response(JSON.stringify({ok:false,error:'Método não permitido'}),{status:405,headers:{'Content-Type':'application/json'}});
};
export const config = { path: '/api/inventario' };
