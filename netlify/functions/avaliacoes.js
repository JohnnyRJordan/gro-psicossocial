const { neon } = require('@netlify/neon');

const DIM_RISK_MAP = {
  demandas: { perigo:'Excesso de demandas / sobrecarga', agravos:'Transtornos mentais, burnout, DORT', medidas:'Redistribuição de tarefas; revisão de metas; pausas obrigatórias', sev:3, prob:2 },
  organizacao: { perigo:'Baixa autonomia e falta de controle', agravos:'Transtornos mentais, desmotivação', medidas:'Participação dos trabalhadores; enriquecimento do trabalho', sev:2, prob:2 },
  relacoes: { perigo:'Déficit de relações sociais e liderança inadequada', agravos:'Transtornos mentais, conflitos, assédio moral', medidas:'Capacitação de lideranças; gestão de conflitos', sev:3, prob:2 },
  suporte: { perigo:'Falta de suporte social e apoio', agravos:'Transtornos mentais, isolamento, burnout', medidas:'Redes de apoio; supervisão; feedback regular', sev:2, prob:2 },
  interface: { perigo:'Desequilíbrio trabalho-vida e insegurança', agravos:'Transtornos mentais, conflito família-trabalho', medidas:'Flexibilização; respeito a horários', sev:2, prob:2 },
  saude: { perigo:'Esgotamento emocional e estresse crônico', agravos:'Burnout, depressão, ansiedade, distúrbios do sono', medidas:'Programa de saúde mental; apoio psicológico', sev:3, prob:2 },
  assedio: { perigo:'Assédio moral e violência no trabalho', agravos:'Transtornos mentais graves, PTSD', medidas:'Política tolerância zero; canal de denúncias; Comitê de Ética', sev:4, prob:1 },
};

function decodeToken(t) { try { return JSON.parse(Buffer.from(t||'','base64').toString()); } catch { return null; } }

exports.handler = async function(event, context) {
  const sql = neon(process.env.NETLIFY_DATABASE_URL);
  const method = event.httpMethod;
  const qs = event.queryStringParameters || {};

  if (method === 'OPTIONS') return { statusCode:200, headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}, body:'' };

  if (method === 'POST') {
    const { empresaId, setor, respostas, scores, scoreGeral, relatoAssedio } = JSON.parse(event.body || '{}');
    if (!empresaId || !scores) return { statusCode:400, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ok:false,error:'Dados incompletos'}) };

    await sql`INSERT INTO avaliacoes (empresa_id,setor,respostas,scores,score_geral) VALUES (${empresaId},${setor},${JSON.stringify(respostas)},${JSON.stringify(scores)},${scoreGeral})`;

    for (const [dimId, score] of Object.entries(scores)) {
      if (score >= 40) {
        const m = DIM_RISK_MAP[dimId]; if (!m) continue;
        let sev=m.sev, prob=m.prob;
        if (score>=70){sev=Math.min(4,m.sev+1);prob=Math.min(3,m.prob+1);}
        else if (score>=55){prob=Math.min(3,m.prob+1);}
        const ex = await sql`SELECT id FROM inventario WHERE empresa_id=${empresaId} AND origem=${dimId} AND setor=${setor} LIMIT 1`;
        if (ex.length===0) await sql`INSERT INTO inventario (empresa_id,perigo,agravos,setor,severidade,probabilidade,medidas,origem,origem_score,auto) VALUES (${empresaId},${m.perigo},${m.agravos},${setor},${sev},${prob},${m.medidas},${dimId},${score},true)`;
        else await sql`UPDATE inventario SET severidade=${sev},probabilidade=${prob},origem_score=${score} WHERE id=${ex[0].id}`;
      }
    }

    if (relatoAssedio) {
      await sql`INSERT INTO relatos_assedio (empresa_id,setor,respostas,identificacao) VALUES (${empresaId},${setor},${JSON.stringify(relatoAssedio.respostas)},${JSON.stringify(relatoAssedio.identificacao||null)})`;
      const hasOc = Object.values(relatoAssedio.respostas||{}).some(v=>v>0);
      if (hasOc) {
        const exA = await sql`SELECT id FROM inventario WHERE empresa_id=${empresaId} AND origem='assedio_sexual' AND setor=${setor} LIMIT 1`;
        if (exA.length===0) await sql`INSERT INTO inventario (empresa_id,perigo,agravos,setor,severidade,probabilidade,medidas,origem,origem_score,auto) VALUES (${empresaId},'Assédio sexual no trabalho','Transtornos mentais graves, PTSD, trauma',${setor},4,3,'Investigação sigilosa; suporte psicológico; Comitê de Ética','assedio_sexual',100,true)`;
      }
    }
    return { statusCode:201, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ok:true}) };
  }

  if (method === 'GET') {
    const auth = event.headers['authorization']||event.headers['Authorization']||'';
    const p = decodeToken(auth.replace('Bearer ',''));
    if (!p||p.exp<Date.now()) return { statusCode:401, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ok:false,error:'Não autorizado'}) };
    const empresaId = qs.empresaId || p.empresaId;
    const rows = await sql`SELECT id,setor,scores,score_geral,created_at FROM avaliacoes WHERE empresa_id=${empresaId} ORDER BY created_at DESC`;
    return { statusCode:200, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ok:true,avaliacoes:rows}) };
  }

  return { statusCode:405, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ok:false,error:'Método não permitido'}) };
};
