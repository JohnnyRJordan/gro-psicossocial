const { neon } = require('@netlify/neon');
function decodeToken(t){try{return JSON.parse(Buffer.from(t||'','base64').toString());}catch{return null;}}
exports.handler = async function(event,context){
  const sql=neon(process.env.NETLIFY_DATABASE_URL);
  const method=event.httpMethod;
  const qs=event.queryStringParameters||{};
  const auth=event.headers['authorization']||event.headers['Authorization']||'';
  const p=decodeToken(auth.replace('Bearer ',''));
  if(!p||p.exp<Date.now()) return {statusCode:401,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Não autorizado'})};
  const empresaId=qs.empresaId||p.empresaId;
  if(method==='GET'){const r=await sql`SELECT id,setor,respostas,identificacao,created_at FROM relatos_assedio WHERE empresa_id=${empresaId} ORDER BY created_at DESC`;return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true,relatos:r})};}
  if(method==='DELETE'){const id=qs.id;await sql`DELETE FROM relatos_assedio WHERE id=${id} AND empresa_id=${empresaId}`;return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true})};}
  return {statusCode:405,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Método não permitido'})};
};
