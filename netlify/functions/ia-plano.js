exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ok:false,error:'Método não permitido'}),{status:405,headers:{'Content-Type':'application/json'}});
  }

  const bodyData = JSON.parse(event.body || '{}');
  const { riscos, empresa, scores } = bodyData;

  const riscosTexto = riscos.map(r =>
    `- ${r.perigo} (Setor: ${r.setor||'Geral'}, Nível: ${r.severidade*r.probabilidade<=2?'Baixo':r.severidade*r.probabilidade<=4?'Moderado':r.severidade*r.probabilidade<=6?'Alto':'Crítico'}, COPSOQ: ${r.origem_score||'—'}%)`
  ).join('\n');

  const scoresTexto = scores ? Object.entries(scores).map(([k,v]) =>
    `${k}: ${v}%`
  ).join(', ') : 'Não disponível';

  const prompt = `Você é um especialista em Segurança e Saúde no Trabalho (SST), com profundo conhecimento da NR-1 (Portaria MTE 1.416/2024), NR-17 e do Guia de Riscos Psicossociais do MTE 2025.

Analise os seguintes riscos psicossociais identificados na empresa "${empresa}" e gere um Plano de Ação estruturado conforme as exigências do GRO/PGR da NR-1.

RISCOS IDENTIFICADOS:
${riscosTexto}

SCORES COPSOQ II:
${scoresTexto}

Gere um plano de ação em JSON com o seguinte formato (responda APENAS o JSON, sem texto adicional):
{
  "resumo": "Análise executiva em 2-3 frases",
  "prioridade_geral": "Alta|Moderada|Baixa",
  "acoes": [
    {
      "risco": "nome do risco",
      "acao": "descrição clara da intervenção",
      "tipo": "Organizacional|Individual|Ambiental",
      "responsavel_sugerido": "RH|SST|Gestão|SESMT|Comitê de Ética",
      "prazo_dias": 30,
      "prioridade": "Alta|Média|Baixa",
      "base_legal": "referência NR-1 ou NR-17",
      "indicador": "como medir o resultado"
    }
  ],
  "recomendacoes_adicionais": ["recomendação 1", "recomendação 2"]
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const plano = JSON.parse(clean);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ok:true,plano}),{status:200,headers:{'Content-Type':'application/json'}});
  } catch {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ok:false,error:'Erro ao processar resposta da IA',raw:text}),{status:500,headers:{'Content-Type':'application/json'}});
  }
};

