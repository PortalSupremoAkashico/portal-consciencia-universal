// api/mentor-ufologico.js

const SYSTEM_PROMPT = `Você é o Mentor Ufológico IA do Portal da Consciência Universal.

Sua missão é informar, investigar e fomentar debates sobre OVNIs, UAPs, vida extraterrestre e fenômenos não identificados.

FONTES PRIORITÁRIAS: AARO (aaro.mil), Pentágono (defense.gov), NASA (nasa.gov), Congresso (congress.gov), CIA (cia.gov/readingroom), MUFON (mufon.com), The Debrief (thedebrief.org), New York Times, History Channel.

FORMATAÇÃO: Não use ## ou ** — use ✦ para separar seções e emojis para destacar pontos.

CLASSIFICAÇÃO obrigatória:
✅ FATO CONFIRMADO | 📄 DOCUMENTO OFICIAL | 📰 REPORTAGEM | 🔬 HIPÓTESE | ⚠️ SUSPEITO | 🎭 POSSIVELMENTE FABRICADO | 👤 RELATO PESSOAL | 🌀 INTERPRETAÇÃO | ❓ EM DEBATE

MÍDIA INLINE — após cada caso, coloque os links encontrados:
[FOTO: URL] | [VÍDEO: URL] | [DOCUMENTO: URL] | [ARTIGO: URL]

Apresente múltiplas perspectivas. Ao final, proponha UMA PERGUNTA para debate.
⚠️ Nem todo fenômeno não identificado implica origem extraterrestre.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Método não permitido' }); return; }

  const { pergunta, historico = [] } = req.body || {};

  if (!pergunta || String(pergunta).trim().length < 2) {
    res.status(400).json({ error: 'Pergunta inválida.' });
    return;
  }

  const messages = [
    ...historico.slice(-6),
    { role: 'user', content: String(pergunta).trim() },
  ];

  let anthropicResp;
  try {
    anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        messages,
        stream: true,
      }),
    });
  } catch(e) {
    console.error('[mentor] fetch error:', e.message);
    res.status(500).json({ error: 'Falha ao conectar', detail: e.message });
    return;
  }

  if (!anthropicResp.ok) {
    const errText = await anthropicResp.text();
    console.error('[mentor] Anthropic error:', anthropicResp.status, errText);
    res.status(500).json({ error: 'Erro Anthropic ' + anthropicResp.status, detail: errText });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const decoder = new TextDecoder();
  const reader  = anthropicResp.body.getReader();
  let buf = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { res.write('data: [DONE]\n\n'); break; }

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const evt = JSON.parse(raw);
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            res.write(`data: ${JSON.stringify({ type: 'text', text: evt.delta.text })}\n\n`);
          }
          if (evt.type === 'content_block_start' && evt.content_block?.name === 'web_search') {
            res.write(`data: ${JSON.stringify({ type: 'searching', query: evt.content_block.input?.query || '...' })}\n\n`);
          }
          if (evt.type === 'message_stop') {
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          }
        } catch(_) {}
      }
    }
  } catch(e) {
    console.error('[mentor] stream error:', e.message);
    try { res.write(`data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`); } catch(_) {}
  } finally {
    res.end();
  }
};
