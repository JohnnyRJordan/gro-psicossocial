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
  if(method==='GET'){const r=await sql`SELECT * FROM inventario WHERE empresa_id=${empresaId} ORDER BY auto DESC,created_at DESC`;return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true,inventario:r})};}
  if(method==='POST'){const{perigo,agravos,setor,severidade,probabilidade,medidas}=JSON.parse(event.body||'{}');await sql`INSERT INTO inventario (empresa_id,perigo,agravos,setor,severidade,probabilidade,medidas,auto) VALUES (${empresaId},${perigo},${agravos},${setor},${severidade},${probabilidade},${medidas},false)`;return {statusCode:201,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true})};}
  if(method==='DELETE'){const id=qs.id;await sql`DELETE FROM inventario WHERE id=${id} AND empresa_id=${empresaId}`;return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true})};}
  return {statusCode:405,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Método não permitido'})};
};
