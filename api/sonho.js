export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { nome, sexo, sonho, emocao } = req.body || {};
  if (!nome || !sonho) return res.status(400).json({ error: 'Dados obrigatórios.' });

  const firstName = nome.trim().split(/\s+/)[0];

  const prompt = `Você é um Intérprete Akáshico de sonhos — um ser que acessa os Registros para revelar o significado profundo das imagens oníricas.

DADOS DO CONSULENTE:
- Nome: ${firstName}
- Sexo: ${sexo || 'não informado'}
- O sonho: "${sonho}"
- Emoção ao acordar: ${emocao || 'não informada'}

Interprete este sonho através dos Registros Akáshicos com profundidade, precisão e sensibilidade.

Responda APENAS em JSON válido sem markdown:
{
  "titulo": "Título poético para este sonho",
  "revelacao": "A mensagem principal do sonho para ${firstName} — 3-4 parágrafos profundos conectando o sonho com a jornada da alma",
  "simbolos": "Interpretação dos principais símbolos presentes no sonho — cada símbolo com seu significado akáshico — 3-4 parágrafos",
  "karma": "Conexão com padrões kármicos, vidas anteriores ou lições da alma — 2-3 parágrafos",
  "mensagem": "Mensagem direta dos Guardiões para ${firstName} sobre este sonho — 2 parágrafos íntimos e poderosos",
  "acao": "Uma ação concreta ou prática que ${firstName} deve realizar após este sonho — 1-2 parágrafos específicos"
}

ESTILO:
- Use ${firstName} frequentemente
- Português do Brasil impecável
- Profundo, simbólico mas acessível
- Nunca genérico — cada palavra deve parecer escrita só para ${firstName}
- Mínimo 600 palavras total`;

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicRes.ok) return res.status(500).json({ error: 'Erro na API.' });

    const reader = anthropicRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            res.write(`data: ${JSON.stringify({ delta: parsed.delta.text })}\n\n`);
          }
        } catch {}
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
}
