const { neon } = require('@netlify/neon');
function decodeToken(t){try{return JSON.parse(Buffer.from(t||'','base64').toString());}catch{return null;}}
exports.handler = async function(event,context){
  const sql=neon(process.env.NETLIFY_DATABASE_URL);
  const method=event.httpMethod;
  const qs=event.queryStringParameters||{};
  const auth=event.headers['authorization']||event.headers['Authorization']||'';
  const p=decodeToken(auth.replace('Bearer ',''));
  if(!p||p.exp<Date.now()) return {statusCode:401,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Não autorizado'})};
  if(!['sst','admin'].includes(p.perfil)) return {statusCode:403,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Acesso negado'})};
  const empresaId=qs.empresaId||p.empresaId;
  if(method==='GET'){const r=await sql`SELECT item_id,concluido FROM checklist WHERE empresa_id=${empresaId}`;const cl={};r.forEach(x=>{cl[x.item_id]=x.concluido;});return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true,checklist:cl})};}
  if(method==='POST'){const{itemId,concluido}=JSON.parse(event.body||'{}');await sql`INSERT INTO checklist (empresa_id,item_id,concluido) VALUES (${empresaId},${itemId},${concluido}) ON CONFLICT (empresa_id,item_id) DO UPDATE SET concluido=${concluido}`;return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true})};}
  return {statusCode:405,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Método não permitido'})};
};
