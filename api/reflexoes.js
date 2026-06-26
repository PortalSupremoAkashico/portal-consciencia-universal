export const config = { maxDuration: 60 };

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function emailEhLiberado(email) {
  if (!email) return false;
  const url = `${SUPABASE_URL}/rest/v1/emails_liberados?email=eq.${encodeURIComponent(String(email).toLowerCase().trim())}&select=email`;
  const resp = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  const rows = await resp.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function temAssinaturaPortal(email) {
  const url = `${SUPABASE_URL}/rest/v1/assinaturas?email=eq.${encodeURIComponent(email)}&servico=eq.portal_mensal&status=eq.authorized&select=id`;
  const resp = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  const rows = await resp.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { autores_usados = [], email } = req.body || {};

  // ── Verificação de acesso: email liberado, assinante, ou crédito de trial ──
  const emailLiberado = !!email && await emailEhLiberado(email);
  const assinante = !emailLiberado && !!email && await temAssinaturaPortal(email);
  if (!emailLiberado && !assinante) {
    if (!email) return res.status(400).json({ error: 'Email obrigatório.' });
    const saldo = await obterSaldoCreditos(email);
    if (saldo < 1) {
      return res.status(402).json({ error: 'Você não tem créditos disponíveis. Adquira em /planos para continuar.' });
    }
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
    if (!emailLiberado && !assinante && email) {
      await debitarCredito(email, 'uso_reflexoes').catch(() => {});
    }

    return res.status(200).json({ success: true, reflexoes: parsed.reflexoes });

  } catch (err) {
    console.error('Erro reflexoes:', err.message);
    return res.status(500).json({ error: 'Erro ao buscar reflexoes.' });
  }
}
