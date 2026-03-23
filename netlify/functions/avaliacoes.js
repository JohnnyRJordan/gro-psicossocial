import { neon } from '@netlify/neon';

const sql = neon(process.env.NETLIFY_DATABASE_URL);

function decodeToken(token) {
  try { return JSON.parse(Buffer.from(token, 'base64').toString()); } catch { return null; }
}

const DIM_RISK_MAP = {
  demandas: { perigo: 'Excesso de demandas / sobrecarga', agravos: 'Transtornos mentais, burnout, DORT', medidas: 'Redistribuição de tarefas; revisão de metas; pausas obrigatórias', sev: 3, prob: 2 },
  organizacao: { perigo: 'Baixa autonomia e falta de controle', agravos: 'Transtornos mentais, desmotivação', medidas: 'Participação dos trabalhadores; enriquecimento do trabalho', sev: 2, prob: 2 },
  relacoes: { perigo: 'Déficit de relações sociais e liderança inadequada', agravos: 'Transtornos mentais, conflitos, assédio moral', medidas: 'Capacitação de lideranças; gestão de conflitos', sev: 3, prob: 2 },
  suporte: { perigo: 'Falta de suporte social e apoio', agravos: 'Transtornos mentais, isolamento, burnout', medidas: 'Redes de apoio; supervisão; feedback regular', sev: 2, prob: 2 },
  interface: { perigo: 'Desequilíbrio trabalho-vida e insegurança', agravos: 'Transtornos mentais, conflito família-trabalho', medidas: 'Flexibilização; respeito a horários', sev: 2, prob: 2 },
  saude: { perigo: 'Esgotamento emocional e estresse crônico', agravos: 'Burnout, depressão, ansiedade, distúrbios do sono', medidas: 'Programa de saúde mental; apoio psicológico', sev: 3, prob: 2 },
  assedio: { perigo: 'Assédio moral e violência no trabalho', agravos: 'Transtornos mentais graves, PTSD', medidas: 'Política tolerância zero; canal de denúncias; Comitê de Ética', sev: 4, prob: 1 },
};

export default async (req, context) => {
  const method = req.method;
  const url = new URL(req.url);

  // POST público — colaborador envia avaliação (sem autenticação)
  if (method === 'POST') {
    const { empresaId, setor, respostas, scores, scoreGeral, relatoAssedio } = await req.json();

    if (!empresaId || !scores) {
      return new Response(JSON.stringify({ ok: false, error: 'Dados incompletos' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Salva avaliação
    await sql`
      INSERT INTO avaliacoes (empresa_id, setor, respostas, scores, score_geral)
      VALUES (${empresaId}, ${setor}, ${JSON.stringify(respostas)}, ${JSON.stringify(scores)}, ${scoreGeral})
    `;

    // Auto-inventário
    for (const [dimId, score] of Object.entries(scores)) {
      if (score >= 40) {
        const m = DIM_RISK_MAP[dimId];
        if (!m) continue;
        let sev = m.sev, prob = m.prob;
        if (score >= 70) { sev = Math.min(4, m.sev + 1); prob = Math.min(3, m.prob + 1); }
        else if (score >= 55) { prob = Math.min(3, m.prob + 1); }

        const exists = await sql`
          SELECT id FROM inventario WHERE empresa_id=${empresaId} AND origem=${dimId} AND setor=${setor} LIMIT 1
        `;
        if (exists.length === 0) {
          await sql`
            INSERT INTO inventario (empresa_id, perigo, agravos, setor, severidade, probabilidade, medidas, origem, origem_score, auto)
            VALUES (${empresaId}, ${m.perigo}, ${m.agravos}, ${setor}, ${sev}, ${prob}, ${m.medidas}, ${dimId}, ${score}, true)
          `;
        } else {
          await sql`
            UPDATE inventario SET severidade=${sev}, probabilidade=${prob}, origem_score=${score}, updated_at=NOW()
            WHERE id=${exists[0].id}
          `;
        }
      }
    }

    // Relato assédio sexual
    if (relatoAssedio) {
      const hasOcorrencia = Object.values(relatoAssedio.respostas || {}).some(v => v > 0);
      await sql`
        INSERT INTO relatos_assedio (empresa_id, setor, respostas, identificacao)
        VALUES (${empresaId}, ${setor}, ${JSON.stringify(relatoAssedio.respostas)}, ${JSON.stringify(relatoAssedio.identificacao || null)})
      `;
      if (hasOcorrencia) {
        const exA = await sql`SELECT id FROM inventario WHERE empresa_id=${empresaId} AND origem='assedio_sexual' AND setor=${setor} LIMIT 1`;
        if (exA.length === 0) {
          await sql`
            INSERT INTO inventario (empresa_id, perigo, agravos, setor, severidade, probabilidade, medidas, origem, origem_score, auto)
            VALUES (${empresaId}, 'Assédio sexual no trabalho', 'Transtornos mentais graves, PTSD, trauma', ${setor}, 4, 3,
            'Investigação sigilosa; suporte psicológico; Comitê de Ética', 'assedio_sexual', 100, true)
          `;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 201, headers: { 'Content-Type': 'application/json' }
    });
  }

  // GET — RH/SST/Admin busca avaliações
  if (method === 'GET') {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    const payload = decodeToken(token);
    if (!payload || payload.exp < Date.now()) {
      return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    const empresaId = url.searchParams.get('empresaId') || payload.empresaId;
    const avaliacoes = await sql`
      SELECT id, setor, scores, score_geral, created_at
      FROM avaliacoes WHERE empresa_id=${empresaId}
      ORDER BY created_at DESC
    `;

    return new Response(JSON.stringify({ ok: true, avaliacoes }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ ok: false, error: 'Método não permitido' }), {
    status: 405, headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { path: '/api/avaliacoes' };
