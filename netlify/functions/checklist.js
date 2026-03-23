import { neon } from '@netlify/neon';
const sql = neon(process.env.NETLIFY_DATABASE_URL);
function decodeToken(t) { try { return JSON.parse(Buffer.from(t,'base64').toString()); } catch { return null; } }
function auth(req) { const p=decodeToken(req.headers.get('authorization')?.replace('Bearer ','')); return p&&p.exp>Date.now()?p:null; }

export default async (req) => {
  const p = auth(req);
  if (!p) return new Response(JSON.stringify({ok:false,error:'Não autorizado'}),{status:401,headers:{'Content-Type':'application/json'}});
  if (!['sst','admin'].includes(p.perfil)) return new Response(JSON.stringify({ok:false,error:'Acesso negado — apenas SST'}),{status:403,headers:{'Content-Type':'application/json'}});

  const url = new URL(req.url);
  const empresaId = url.searchParams.get('empresaId') || p.empresaId;

  if (req.method === 'GET') {
    const rows = await sql`SELECT item_id, concluido FROM checklist WHERE empresa_id=${empresaId}`;
    const checklist = {};
    rows.forEach(r => { checklist[r.item_id] = r.concluido; });
    return new Response(JSON.stringify({ok:true,checklist}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if (req.method === 'POST') {
    const {itemId, concluido} = await req.json();
    await sql`INSERT INTO checklist (empresa_id,item_id,concluido) VALUES (${empresaId},${itemId},${concluido}) ON CONFLICT (empresa_id,item_id) DO UPDATE SET concluido=${concluido},updated_at=NOW()`;
    return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  return new Response(JSON.stringify({ok:false,error:'Método não permitido'}),{status:405,headers:{'Content-Type':'application/json'}});
};
export const config = { path: '/api/checklist' };
