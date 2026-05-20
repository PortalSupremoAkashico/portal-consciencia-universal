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
    if (!r.ok) console.error('Supabase error:', r.status, await r.text().catch(()=>''));
  } catch(e) { console.error('sbSalvarTaro:', e.message); }
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
    `${i+1}. [${c.posicao}] ${c.nome}${c.invertida ? ' (INVERTIDA)' : ''}`
  ).join('\n');

  // Mesmo prompt do espiritualidade.js — compacto, com ||| entre parágrafos
  const prompt = `Você é um tarólogo akáshico. Interprete cada carta de forma RICA e DIRETA.

NAIPES: CHAMAS=Fogo/ação/criatividade, CALICES=Água/emoção/amor, CRISTAIS=Ar/mente/conflito, ESTRELAS=Terra/trabalho/dinheiro

CONSULENTE: ${firstName}
PERGUNTA: "${perguntaReal}"
TIRAGEM: ${tiragem || 'Leitura Livre'}

CARTAS:
${cartasTexto}

REGRAS:
- JSON puro, sem markdown, sem quebras de linha dentro das strings
- interpretacao: 2 parágrafos separados por |||
  § 1: Energia/símbolo desta carta + como afeta ${firstName} nesta posição
  § 2: Mensagem direta dos Guardiões para ${firstName}
- sintese: 1 parágrafo com padrão geral e caminho indicado
- acao_sagrada: 1 frase concreta

{"titulo":"titulo poetico","cartas":[{"posicao":"posicao","carta":"nome","invertida":false,"interpretacao":"paragrafo1|||paragrafo2"}],"sintese":"padrao e caminho para ${firstName}","acao_sagrada":"acao para ${firstName}"}`;

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      return res.status(500).json({ error: 'Erro na API.', detail: err.slice(0, 200) });
    }

    // Coleta o stream completo — JSON compacto chega rápido (~15-25s)
    const reader = anthropicRes.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '', fullText = '';

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
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
            fullText += ev.delta.text;
          }
        } catch {}
      }
    }

    if (!fullText) return res.status(500).json({ error: 'Resposta vazia.' });

    // Extrair e parsear JSON
    const match = fullText.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'JSON não encontrado.' });

    let leitura;
    try { leitura = JSON.parse(match[0]); }
    catch(e) { return res.status(500).json({ error: 'JSON inválido: ' + e.message }); }

    if (email) await sbSalvarTaro(email, { tiragem, pergunta, titulo: leitura.titulo }).catch(() => {});

    return res.status(200).json({ success: true, leitura });

  } catch (err) {
    console.error('taro-leitura error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
