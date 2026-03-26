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
  if(method==='GET'){const r=await sql`SELECT * FROM plano_acao WHERE empresa_id=${empresaId} ORDER BY created_at DESC`;return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true,acoes:r})};}
  if(method==='POST'){const{acao,responsavel,prazo,prioridade}=JSON.parse(event.body||'{}');await sql`INSERT INTO plano_acao (empresa_id,acao,responsavel,prazo,prioridade) VALUES (${empresaId},${acao},${responsavel},${prazo||null},${prioridade})`;return {statusCode:201,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true})};}
  if(method==='PUT'){const{id,status,acao,responsavel,prazo,prioridade}=JSON.parse(event.body||'{}');await sql`UPDATE plano_acao SET status=${status},acao=${acao},responsavel=${responsavel},prazo=${prazo||null},prioridade=${prioridade} WHERE id=${id} AND empresa_id=${empresaId}`;return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true})};}
  if(method==='DELETE'){const id=qs.id;await sql`DELETE FROM plano_acao WHERE id=${id} AND empresa_id=${empresaId}`;return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true})};}
  return {statusCode:405,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:'Método não permitido'})};
};
