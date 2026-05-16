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

  // ── POST — geração de meditação, sonho ou tarô ──
  const { tipo, nome, sexo, tema, intencao, sonho, emocao, cartas, tiragem, pergunta } = body;
  if (!nome && tipo !== 'taro') return res.status(400).json({ error: 'Nome obrigatório.' });

  const firstName = (nome || 'Alma').trim().split(/\s+/)[0];
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
    if (!cartas || !cartas.length) return res.status(400).json({ error: 'Cartas obrigatórias.' });

    const perguntaReal = pergunta || 'leitura livre';
    const cartasTexto = cartas.map((c, i) =>
      `${i+1}. [${c.posicao}] ${c.nome}${c.invertida ? ' (INVERTIDA)' : ''}`
    ).join('\n');

    prompt = `Você é um tarólogo akáshico. Interprete cada carta de forma RICA e DIRETA.

NAIPES: CHAMAS=Fogo/ação/criatividade, CALICES=Água/emoção/amor, CRISTAIS=Ar/mente/conflito, ESTRELAS=Terra/trabalho/dinheiro

CONSULENTE: ${firstName}
PERGUNTA: "${perguntaReal}"
TIRAGEM: ${tiragem || 'Leitura Livre'}

CARTAS:
${cartasTexto}

REGRAS DE RESPOSTA:
- Responda APENAS com JSON puro, sem markdown, sem quebras de linha dentro das strings
- Use o separador |||  entre paragrafos dentro de cada interpretacao
- Cada interpretacao deve ter 3 partes separadas por ||| :
  PARTE 1: O significado desta carta no tarot e seus simbolos
  PARTE 2: Como esta energia afeta ${firstName} nesta posicao em relacao a "${perguntaReal}"
  PARTE 3: Mensagem e conselho dos Registros Akashicos

{"titulo":"titulo poetico da leitura","cartas":[{"posicao":"nome da posicao","carta":"nome da carta","invertida":false,"interpretacao":"significado e simbolos da carta||| como afeta ${firstName} nesta posicao||| mensagem dos Registros"}],"sintese":"padrao geral das cartas||| verdade central para ${firstName}||| caminho indicado","acao_sagrada":"acao concreta para ${firstName}"}`;


  } else {
    return res.status(400).json({ error: 'Tipo inválido.' });
  }

  // Tarô: resposta direta (não streaming) para evitar parse de JSON fragmentado
  if (tipo === 'taro') {
    try {
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2500, stream: false, messages: [{ role: 'user', content: prompt }] })
      });
      if (!anthropicRes.ok) {
        const err = await anthropicRes.text();
        return res.status(500).json({ error: 'Erro na API.', detail: err });
      }
      const data = await anthropicRes.json();
      const texto = data.content?.[0]?.text || '';
      return res.status(200).json({ texto });
    } catch (err) {
      console.error('taro error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // Meditação e sonho: streaming
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 5000, stream: true, messages: [{ role: 'user', content: prompt }] })
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
