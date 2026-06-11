export const config = { maxDuration: 300 };

const SYSTEM_PROMPT = `Você é o Mentor Ufológico IA do Portal da Consciência Universal.
Sua missão é informar e debater sobre OVNIs, UAPs e vida extraterrestre.
Fontes: AARO (aaro.mil), Pentágono (defense.gov), NASA, Congresso dos EUA, MUFON, CIA, The Debrief, History Channel.
Não use ## ou ** — use ✦ para separar seções.
Classifique: ✅ FATO | 📄 DOCUMENTO | 📰 REPORTAGEM | 🔬 HIPÓTESE | ⚠️ SUSPEITO | 👤 RELATO | ❓ EM DEBATE
REGRA OBRIGATÓRIA DE LINKS — SIGA EXATAMENTE:
Ao terminar de descrever CADA caso, evento ou informação, coloque IMEDIATAMENTE abaixo (na linha seguinte) os links reais encontrados pela busca para aquele caso específico. Use este formato exato:

Fontes deste caso:
[ARTIGO: https://url-real-encontrada]
[VÍDEO: https://youtube.com/watch?v=xxx]
[FOTO: https://url-da-imagem]
[DOCUMENTO: https://url-do-documento]

NUNCA agrupe todos os links no final. NUNCA invente URLs. Use APENAS links reais retornados pela busca. Se não encontrou link para um caso específico, não coloque marcador.
Ao final, proponha UMA PERGUNTA para debate.
⚠️ Nem todo fenômeno não identificado implica origem extraterrestre.

QUANDO A PERGUNTA ENVOLVER CASOS DA INTERNET (Instagram, Facebook, YouTube, TikTok, X):
- Busque ativamente conteúdos virais recentes nessas plataformas
- Avalie cada caso com um dos selos: ✅ VERIFICADO | 🎭 POSSIVELMENTE FABRICADO | ⚠️ SUSPEITO | ❓ SEM CONCLUSÃO
- SEMPRE inclua no início da resposta este aviso: "⚠️ AVISO: Os casos abaixo circulam nas redes sociais e NÃO foram verificados por fontes oficiais. Analise com ceticismo."
- Indique a plataforma de origem de cada caso
- Se houver sinais de CGI, edição ou encenação, aponte claramente`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API key não configurada.' });

  try {
    const { pergunta, historico = [] } = req.body;
    if (!pergunta || !pergunta.trim()) return res.status(400).json({ error: 'Pergunta obrigatória.' });

    // ── Modo comentário de fórum ──
    const isComentario = req.body?.tipo === 'comentario_forum';
    const postContexto  = req.body?.post_contexto || '';

    const messages = isComentario
      ? [{ role: 'user', content:
          'Você viu este post do fórum Ufológico:\n\n' +
          '--- POST ---\n' + postContexto + '\n---\n\n' +
          'Se tiver uma perspectiva genuinamente relevante a acrescentar — ' +
          'uma informação nova, uma correção importante ou um ângulo diferente — ' +
          'escreva um comentário breve (2-4 frases no máximo), começando SEMPRE com "Mentor Ufológico:" seguido do seu comentário. ' +
          'Se não tiver nada substancial a acrescentar, responda APENAS a palavra: pass'
        }]
      : [
          ...historico.slice(-6),
          { role: 'user', content: pergunta.trim() }
        ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3500,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        ...(isComentario ? {} : { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }] }),
        max_tokens: isComentario ? 300 : 3500,
        messages,
        stream: true
      })
    });

    if (!response.ok) {
      const err = await response.text().catch(() => response.statusText);
      return res.status(500).json({ error: `Anthropic error ${response.status}: ${err.slice(0, 300)}` });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const ev = JSON.parse(raw);
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
            res.write(`data: ${JSON.stringify({ type: 'text', text: ev.delta.text })}\n\n`);
          }
          if (ev.type === 'content_block_start' && ev.content_block?.name === 'web_search') {
            res.write(`data: ${JSON.stringify({ type: 'searching', query: ev.content_block.input?.query || '...' })}\n\n`);
          }
          if (ev.type === 'message_stop') {
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          }
        } catch(_) {}
      }
    }

    res.end();

  } catch(error) {
    console.error('[mentor-ufo] error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      try { res.end(); } catch(_) {}
    }
  }
}
