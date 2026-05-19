export const config = { maxDuration: 120 };

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function sbSalvarTaro(email, dados) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/leituras_taro`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ email, dados: JSON.stringify(dados) })
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('Supabase taro save error:', r.status, err.slice(0,200));
    }
  } catch(e) {
    console.error('sbSalvarTaro error:', e.message);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { nome, sexo, cartas, tiragem, pergunta, email } = req.body || {};
  if (!cartas || !cartas.length) return res.status(400).json({ error: 'Cartas obrigatórias.' });

  const firstName = (nome || 'Alma').trim().split(/\s+/)[0];
  const perguntaReal = pergunta || 'leitura livre';

  const cartasTexto = cartas.map((c, i) =>
    `Carta ${i+1} — Posição "${c.posicao}": ${c.nome}${c.invertida ? ' (INVERTIDA)' : ''}`
  ).join('\n');

  // Chaves planas carta0..cartaN para o parser progressivo do frontend
  const cartasJson = cartas.map((c, i) =>
    `"carta${i}": "[interpretação profunda da carta ${i+1} — ${c.nome}${c.invertida ? ' INVERTIDA' : ''} na posição ${c.posicao}]"`
  ).join(',\n  ');

  const prompt = `Você é um Tarólogo Akáshico de elite. Leitura profunda para ${firstName}.

NAIPES: CHAMAS=Fogo/ação | CÁLICES=Água/emoção/amor | CRISTAIS=Ar/mente/conflito | ESTRELAS=Terra/trabalho/dinheiro | ARCANOS MAIORES=Karma/missão

CONSULENTE: ${firstName} | PERGUNTA: "${perguntaReal}"
CARTAS: ${cartasTexto}

Para cada carta escreva 2 parágrafos fluidos:
§1: Simbolismo e energia desta carta nos Registros Akáshicos + como se manifesta para ${firstName} nesta posição
§2: Mensagem dos Guardiões para ${firstName} — orientação concreta e amorosa

SINTESE: 2 parágrafos — padrão geral das cartas + caminho indicado para ${firstName}
ACAO_SAGRADA: 1 frase com ação concreta para ${firstName} nos próximos 7 dias

Responda APENAS em JSON válido sem markdown:
{
  "titulo": "título poético desta leitura",
  ${cartasJson},
  "sintese": "...",
  "acao_sagrada": "..."
}`;

  try {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      return res.status(500).json({ error: 'Erro na API.', detail: err.slice(0,200) });
    }

    const reader = anthropicRes.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const ev = JSON.parse(raw);
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
            res.write(ev.delta.text);
          }
        } catch {}
      }
    }

    // Salvar no Supabase após stream completo
    if (email) {
      await sbSalvarTaro(email, { tiragem, pergunta }).catch(() => {});
    }

    res.end();

  } catch (err) {
    console.error('taro-leitura error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else try { res.end(); } catch {}
  }
}
