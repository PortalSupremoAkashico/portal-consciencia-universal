export const config = { maxDuration: 60 };

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Pool mensal por plano, para os serviços com cota (Consulta, Meditação, Mentoria).
// null = ilimitado (Plano Infinito). Reflexão não usa pool: qualquer assinatura
// ativa dentro do ciclo já libera de graça.
const POOL_POR_PLANO = { plano_despertar: 3, plano_expansao: 9, plano_infinito: null };
const DIAS_CICLO = 30;

async function emailEhLiberado(email) {
  if (!email) return false;
  const url = `${SUPABASE_URL}/rest/v1/emails_liberados?email=eq.${encodeURIComponent(String(email).toLowerCase().trim())}&select=email`;
  const resp = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  const rows = await resp.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function buscarAssinaturaAtiva(email) {
  const url = `${SUPABASE_URL}/rest/v1/assinaturas?email=eq.${encodeURIComponent(email)}&status=eq.authorized&order=id.desc&limit=1&select=id,servico,ciclo_inicio,pool_usado`;
  const resp = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  const rows = await resp.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

function dentroDoCiclo(cicloInicio) {
  if (!cicloInicio) return false;
  return (Date.now() - new Date(cicloInicio).getTime()) < DIAS_CICLO * 24 * 60 * 60 * 1000;
}

async function obterSaldoCreditos(email) {
  const url = `${SUPABASE_URL}/rest/v1/creditos_movimentos?email=eq.${encodeURIComponent(email)}&select=quantidade`;
  const resp = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  const linhas = await resp.json().catch(() => []);
  if (!Array.isArray(linhas)) return 0;
  return linhas.reduce((soma, l) => soma + (Number(l.quantidade) || 0), 0);
}

async function debitarCredito(email, motivo) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/creditos_movimentos`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ email, quantidade: -1, motivo, referencia: `${motivo}_${Date.now()}` })
  });
  if (!resp.ok) {
    const errTxt = await resp.text().catch(() => '');
    console.error('debitarCredito falhou:', resp.status, errTxt.slice(0,300));
  }
}

async function incrementarPool(assinaturaId, poolAtual) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/assinaturas?id=eq.${assinaturaId}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ pool_usado: poolAtual + 1 })
  });
  if (!resp.ok) {
    const errTxt = await resp.text().catch(() => '');
    console.error('incrementarPool falhou:', resp.status, errTxt.slice(0,300));
  }
}

// Verifica acesso e devolve uma função "cobrar" a ser chamada só depois que a
// IA confirmar que vai responder. servicoLimitado=true usa o pool mensal do plano
// (Reflexão sempre chama com false — livre para qualquer assinante no ciclo).
async function verificarAcesso(email, servicoLimitado, motivo) {
  if (!email) return { permitido: false, status: 400, error: 'Email obrigatório.' };

  if (await emailEhLiberado(email)) {
    return { permitido: true, cobrar: async () => {} };
  }

  const assinatura = await buscarAssinaturaAtiva(email);
  if (assinatura && dentroDoCiclo(assinatura.ciclo_inicio)) {
    const limite = POOL_POR_PLANO[assinatura.servico];

    if (!servicoLimitado || limite === null || limite === undefined) {
      return { permitido: true, cobrar: async () => {} };
    }

    if ((assinatura.pool_usado || 0) < limite) {
      return { permitido: true, cobrar: async () => { await incrementarPool(assinatura.id, assinatura.pool_usado || 0); } };
    }

    return { permitido: false, status: 402, error: 'Sua cota deste plano acabou neste ciclo. Faça upgrade em /planos ou aguarde a renovação.' };
  }

  const saldo = await obterSaldoCreditos(email);
  if (saldo >= 1) {
    return { permitido: true, cobrar: async () => { await debitarCredito(email, motivo); } };
  }

  return { permitido: false, status: 402, error: 'Você não tem créditos disponíveis. Assine um plano em /planos para continuar.' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { autores_usados = [], email } = req.body || {};

  // ── Verificação de acesso: email liberado, assinatura ativa no ciclo, ou crédito de trial ──
  const acesso = await verificarAcesso(email, false, 'uso_reflexoes');
  if (!acesso.permitido) {
    return res.status(acesso.status).json({ error: acesso.error });
  }

  const exclusao = autores_usados.length > 0
    ? `AUTORES JA USADOS NOS ULTIMOS 7 DIAS (NAO REPITA NENHUM DESTES): ${autores_usados.join(', ')}.`
    : '';

  const prompt = `Você é um curador de sabedoria universal. Selecione 3 reflexões profundas e inspiradoras de diferentes mestres, filósofos e pensadores da humanidade.

${exclusao}

REGRAS:
- Escolha 3 autores COMPLETAMENTE DIFERENTES entre si, de tradições e épocas variadas
- Seja ALEATÓRIO — escolha autores inesperados a cada chamada
- Varie entre: filósofos gregos, místicos orientais, líderes espirituais, cientistas, poetas, sábios medievais, pensadores modernos, escritores, psicólogos, artistas
- Exemplos (não se limite): Sócrates, Platão, Aristóteles, Marco Aurélio, Lao Tsé, Confúcio, Buda, Jesus Cristo, Rumi, Ibn Arabi, Kahlil Gibran, Gandhi, Madre Teresa, Martin Luther King, Nelson Mandela, Albert Einstein, Carl Jung, Viktor Frankl, Dostoiévski, Nietzsche, Schopenhauer, Tagore, Heráclito, Epicteto, Sêneca, Pitágoras, Leonardo da Vinci, Tolstói, Fernando Pessoa, Clarice Lispector, Osho, Krishnamurti, Alan Watts, Joseph Campbell, Carl Sagan, Marie Curie, Nikola Tesla, Paramahansa Yogananda, Teilhard de Chardin, Thomas Merton, Simone Weil, Meister Eckhart, Santa Teresa de Ávila, São Francisco de Assis, Confúcio, Zhuangzi, Nagarjuna, Ramana Maharshi, Sri Aurobindo, Jiddu Krishnamurti, Simone de Beauvoir, Hannah Arendt, Albert Camus, Jean-Paul Sartre, Friedrich Hölderlin, Rainer Maria Rilke, Pablo Neruda, Jorge Luis Borges, Umberto Eco, Antoine de Saint-Exupéry
- Reflexão genuína, profunda e relevante para a vida interior
- Varie os temas: amor, propósito, superação, sabedoria, alma, universo, silêncio, tempo, liberdade, transformação, morte, beleza, coragem, presença, gratidão, fé, escuridão, luz, criação
- Escreva em português do Brasil fluente
- A reflexão deve ser impactante e memorável

Responda APENAS em JSON válido, sem markdown, sem blocos de código:
{
  "reflexoes": [
    { "autor": "Nome", "origem": "Tradição/Época", "reflexao": "Texto da reflexão..." },
    { "autor": "Nome", "origem": "Tradição/Época", "reflexao": "Texto da reflexão..." },
    { "autor": "Nome", "origem": "Tradição/Época", "reflexao": "Texto da reflexão..." }
  ]
}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL_SONNET || 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Anthropic error reflexoes:', errText);
      if (resp.status === 529) {
        return res.status(503).json({ error: 'Os Guardiões estão em alta demanda neste momento. Aguarde alguns instantes e tente novamente.' });
      }
      return res.status(500).json({ error: 'Erro na API.', detail: errText });
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Resposta invalida.' });

    const parsed = JSON.parse(match[0]);

    // Debita o crédito só depois de confirmar que a resposta da IA é válida
    // Cobra (debita crédito de trial, se for o caso) só depois de confirmar
    // que a resposta da IA é válida.
    await acesso.cobrar().catch(() => {});

    return res.status(200).json({ success: true, reflexoes: parsed.reflexoes });

  } catch (err) {
    console.error('Erro reflexoes:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar reflexoes.' });
  }
}
