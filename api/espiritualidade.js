export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tipo, nome, sexo, tema, intencao, sonho, emocao } = req.body || {};
  if (!nome) return res.status(400).json({ error: 'Nome obrigatório.' });

  const firstName = nome.trim().split(/\s+/)[0];
  let prompt = '';

  if (tipo === 'meditacao') {
    prompt = `Você é um Guia Akáshico de meditação. Crie uma meditação guiada profunda e transformadora para ${firstName}.

DADOS:
- Nome: ${firstName}
- Tema: ${tema || 'Paz Interior'}
- Intenção: ${intencao || 'não informada'}
- Sexo: ${sexo || 'não informado'}

Responda APENAS em JSON válido sem markdown:
{
  "titulo": "Título poético da meditação",
  "duracao": "15 minutos",
  "preparacao": "2-3 parágrafos convidando ${firstName} a se acomodar e respirar",
  "descida": "3-4 parágrafos conduzindo por jornada sensorial para lugar sagrado",
  "encontro": "4-5 parágrafos — núcleo da meditação conectado ao tema ${tema || 'Paz Interior'}",
  "mensagem": "2-3 parágrafos com mensagem dos Guardiões para ${firstName}",
  "retorno": "2-3 parágrafos trazendo suavemente de volta"
}`;
  } else if (tipo === 'sonho') {
    if (!sonho) return res.status(400).json({ error: 'Descreva o sonho.' });
    prompt = `Você é um Intérprete Akáshico de sonhos. Interprete o sonho de ${firstName}.

DADOS:
- Nome: ${firstName}
- Sexo: ${sexo || 'não informado'}
- Sonho: "${sonho}"
- Emoção ao acordar: ${emocao || 'não informada'}

Responda APENAS em JSON válido sem markdown:
{
  "titulo": "Título poético para este sonho",
  "revelacao": "3-4 parágrafos com a mensagem principal do sonho para ${firstName}",
  "simbolos": "3-4 parágrafos interpretando os símbolos do sonho",
  "karma": "2-3 parágrafos sobre padrões kármicos e lições da alma",
  "mensagem": "2 parágrafos de mensagem direta dos Guardiões para ${firstName}",
  "acao": "1-2 parágrafos com ação concreta que ${firstName} deve realizar"
}`;
  } else {
    return res.status(400).json({ error: 'Tipo inválido. Use meditacao ou sonho.' });
  }

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
        model: 'claude-sonnet-4-6',
        max_tokens: 5000,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      console.error('Anthropic error:', err);
      if (anthropicRes.status === 529) {
        return res.status(503).json({ error: 'Os Guardiões estão em alta demanda neste momento. Aguarde alguns instantes e tente novamente.' });
      }
      return res.status(500).json({ error: 'Erro na API.', detail: err });
    }

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
    console.error('espiritualidade error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
}
