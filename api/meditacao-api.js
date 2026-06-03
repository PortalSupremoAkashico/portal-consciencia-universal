export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { nome, sexo, tema, intencao } = req.body || {};
  if (!nome) return res.status(400).json({ error: 'Dados obrigatórios.' });

  const firstName = nome.trim().split(/\s+/)[0];
  let pronome = 'você';
  if (sexo === 'Feminino') pronome = 'você';
  if (sexo === 'Masculino') pronome = 'você';

  const prompt = `Você é um Guia Akáshico de meditação. Crie uma meditação guiada profunda, personalizada e transformadora para ${firstName}.

DADOS:
- Nome: ${firstName}
- Tema escolhido: ${tema || 'Paz Interior'}
- Intenção pessoal: ${intencao || 'não informada'}
- Sexo: ${sexo || 'não informado'}

ESTRUTURA DA MEDITAÇÃO (siga exatamente):
1. **Preparação** (2-3 parágrafos) — convide ${firstName} a se acomodar, respirar e soltar o dia
2. **Descida** (3-4 parágrafos) — conduza por uma jornada sensorial para um lugar sagrado
3. **O Encontro** (4-5 parágrafos) — o núcleo da meditação, conectado ao tema e à intenção
4. **A Mensagem** (2-3 parágrafos) — uma mensagem dos Guardiões especificamente para ${firstName}
5. **O Retorno** (2-3 parágrafos) — traga suavemente de volta, integrando a experiência

ESTILO:
- Use o nome ${firstName} com frequência — cria presença
- Linguagem suave, lenta, contemplativa — como uma voz que guia
- Inclua elementos sensoriais: luz, cores, texturas, sons, aromas
- Conecte com o tema e a intenção em cada seção
- Profundo mas acessível, espiritual mas enraizado
- Português do Brasil impecável, com acentos corretos
- Mínimo 800 palavras, máximo 1200 palavras

Responda APENAS em JSON válido sem markdown:
{
  "titulo": "Título poético da meditação",
  "duracao": "X minutos",
  "preparacao": "texto...",
  "descida": "texto...",
  "encontro": "texto...",
  "mensagem": "texto...",
  "retorno": "texto..."
}`;

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
