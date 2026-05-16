export const config = { maxDuration: 300 };

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation', ...(options.headers||{}) }
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, data };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET — listar meditações ou sonhos ──
  if (req.method === 'GET') {
    const { tipo, email } = req.query || {};
    if (!tipo || !email) return res.status(400).json({ error: 'tipo e email obrigatórios.' });
    const tabela = tipo === 'meditacoes' ? 'meditacoes' : 'sonhos';
    const r = await sbFetch(`/${tabela}?email=eq.${encodeURIComponent(email)}&order=created_at.desc&select=*`);
    if (!r.ok) return res.status(500).json({ error: 'Erro ao buscar.' });
    return res.status(200).json({ success: true, [tabela]: r.data || [] });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};

  // ── POST action=salvar|apagar_um — CRUD ──
  if (body.action === 'salvar' || body.action === 'apagar_um') {
    const { action, tipo, email, dados, id } = body;
    const tabela = tipo === 'meditacoes' ? 'meditacoes' : 'sonhos';

    if (action === 'salvar') {
      if (!email || !dados) return res.status(400).json({ error: 'Dados obrigatórios.' });
      const r = await sbFetch(`/${tabela}`, { method: 'POST', body: JSON.stringify({ email, dados }) });
      console.log('Supabase salvar:', tabela, r.ok, JSON.stringify(r.data).slice(0,200));
      return res.status(r.ok ? 200 : 500).json(r.ok ? { success: true } : { error: 'Erro ao salvar.', detail: r.data });
    }

    if (action === 'apagar_um') {
      if (!id || !email) return res.status(400).json({ error: 'ID e email obrigatórios.' });
      const r = await sbFetch(`/${tabela}?id=eq.${id}&email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' });
      return res.status(r.ok ? 200 : 500).json(r.ok ? { success: true } : { error: 'Erro ao apagar.' });
    }
  }

  // ── POST — geração de meditação ou sonho ──
  const { tipo, nome, sexo, tema, intencao, sonho, emocao } = body;
  if (!nome) return res.status(400).json({ error: 'Nome obrigatório.' });

  const firstName = nome.trim().split(/\s+/)[0];
  let prompt = '';

  if (tipo === 'meditacao') {
    const semente = Math.floor(Math.random() * 10000);
    const lugares = ['floresta de cristal', 'templo akáshico nas nuvens', 'praia de areia dourada sob estrelas', 'caverna de luz', 'jardim celestial', 'lago espelhado no cosmos', 'montanha sagrada', 'vale de flores luminosas', 'portal entre dimensões', 'ilha flutuante no universo'];
    const guias = ['Aureon', 'Nyrael', 'um ser de luz dourada', 'um ancião sábio', 'um anjo de cristal', 'a própria voz da alma'];
    const elementos = ['luz dourada', 'chamas azuis', 'água cristalina', 'vento sagrado', 'terra fértil', 'névoa prateada', 'raios de sol', 'energia violeta'];
    const lugar = lugares[Math.floor(Math.random() * lugares.length)];
    const guia = guias[Math.floor(Math.random() * guias.length)];
    const elemento = elementos[Math.floor(Math.random() * elementos.length)];

    prompt = `Você é um Guia Akáshico de meditação. Crie uma meditação guiada ÚNICA para ${firstName}.

DADOS:
- Nome: ${firstName}
- Tema: ${tema || 'Paz Interior'}
- Intenção: ${intencao || 'não informada'}
- Lugar sagrado: ${lugar}
- Guia: ${guia}
- Elemento: ${elemento}
- Variação: ${semente}

Responda APENAS em JSON válido sem markdown:
{
  "titulo": "Título poético único",
  "duracao": "12 minutos",
  "preparacao": "2 parágrafos convidando ${firstName} a respirar e se acomodar em ${lugar}",
  "descida": "2 parágrafos conduzindo até ${lugar} com detalhes sensoriais de ${elemento}",
  "encontro": "3 parágrafos — encontro com ${guia} e a mensagem central sobre ${tema || 'Paz Interior'}",
  "mensagem": "2 parágrafos com mensagem dos Guardiões para ${firstName}",
  "retorno": "1 parágrafo trazendo suavemente de volta"
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
  } else if (tipo === 'taro') {
    const { cartas, tiragem, pergunta } = body;
    if (!cartas || !cartas.length) return res.status(400).json({ error: 'Cartas obrigatórias.' });

    const cartasDetalhadas = cartas.map((c, i) => {
      const sig = c.invertida ? c.significadoInvertido : c.significadoNormal;
      return `Posição ${i+1} — "${c.posicao}": ${c.nome}${c.invertida ? ' (INVERTIDA)' : ''}\nSignificado base: ${sig}`;
    }).join('\n\n');

    const perguntaReal = pergunta || 'leitura livre sem pergunta específica';

    prompt = `Você é um tarólogo akáshico experiente. Faça uma leitura profunda, lógica e convincente.

TARÔ AKÁSHICO — NAIPES:
- CHAMAS (Fogo/Paus): ação, criatividade, vontade, projetos, paixão
- CÁLICES (Água/Copas): emoções, amor, relacionamentos, intuição
- CRISTAIS (Ar/Espadas): mente, conflitos, decisões, verdades difíceis
- ESTRELAS (Terra/Ouros): trabalho, dinheiro, manifestação, recursos
- ARCANOS MAIORES: forças kármicas universais da alma

CONSULENTE: ${firstName}${sexo ? ' (' + sexo + ')' : ''}
TIRAGEM: ${tiragem || 'Leitura Livre'}
PERGUNTA: "${perguntaReal}"

CARTAS (com significados base):
${cartasDetalhadas}

INSTRUÇÕES:
Para cada carta escreva 5 a 6 parágrafos SEPARADOS POR \n (quebra de linha):
- Parágrafo 1: O que esta carta é e o que representa no tarô
- Parágrafo 2: A simbologia e arquétipo específico desta carta
- Parágrafo 3: Como sua energia se manifesta na posição que ocupa nesta tiragem
- Parágrafo 4: Conexão direta com a pergunta "${perguntaReal}" de ${firstName}
- Parágrafo 5: O que os Registros Akáshicos revelam para ${firstName} através desta carta
- Parágrafo 6 (opcional): Conselho prático e específico desta carta

REGRAS CRÍTICAS:
- Use \n entre cada parágrafo para separação
- Cada carta deve ter interpretação única e diferente das demais
- Conecte SEMPRE à pergunta específica
- Cartas invertidas = energia bloqueada ou interna
- Use o nome ${firstName} naturalmente
- Seja rico, profundo e convincente — não genérico

Responda APENAS em JSON válido:
{
  "titulo": "Título poético que reflita a pergunta de ${firstName}",
  "cartas": [
    {
      "posicao": "nome da posição",
      "carta": "nome da carta",
      "invertida": false,
      "interpretacao": "Parágrafo 1 completo sobre o significado da carta\n\nParágrafo 2 completo sobre a simbologia\n\nParágrafo 3 completo sobre a posição\n\nParágrafo 4 completo sobre a conexão com a pergunta\n\nParágrafo 5 completo com a mensagem dos Registros\n\nParágrafo 6 com o conselho prático"
    }
  ],
  "sintese": "Parágrafo 1 sobre o padrão geral\n\nParágrafo 2 sobre a verdade central para ${firstName}\n\nParágrafo 3 sobre o caminho indicado",
  "acao_sagrada": "Ação prática específica para ${firstName} baseada nesta leitura"
}\`;`;
  } else {
    return res.status(400).json({ error: 'Tipo inválido.' });
  }

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: tipo === 'taro' ? 3500 : 5000, stream: true, messages: [{ role: 'user', content: prompt }] })
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      console.error('Anthropic error:', err);
      if (anthropicRes.status === 529) return res.status(503).json({ error: 'Os Guardiões estão em alta demanda. Tente novamente em instantes.' });
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
