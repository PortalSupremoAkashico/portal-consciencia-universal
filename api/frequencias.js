export const config = { maxDuration: 60 };

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', 'Prefer': 'return=representation',
      ...(options.headers || {})
    }
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

  if (req.method === 'GET') {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email obrigatório' });
    const path = email === 'all'
      ? '/frequencias_sessoes?order=created_at.desc&select=*'
      : `/frequencias_sessoes?email=eq.${encodeURIComponent(email)}&order=created_at.desc&select=*`;
    const r = await sbFetch(path);
    return res.status(200).json({ success: true, sessoes: r.data || [] });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action, email, nome, estado, intencao, dados, id } = req.body || {};

  if (action === 'salvar') {
    if (!email || !dados) return res.status(400).json({ error: 'Dados obrigatórios.' });
    const r = await sbFetch('/frequencias_sessoes', { method: 'POST', body: JSON.stringify({ email, dados }) });
    if (!r.ok) return res.status(500).json({ error: 'Erro ao salvar.' });
    const reg = Array.isArray(r.data) ? r.data[0] : r.data;
    return res.status(200).json({ success: true, id: reg?.id });
  }

  if (action === 'apagar') {
    if (!id || !email) return res.status(400).json({ error: 'ID e email obrigatórios.' });
    const r = await sbFetch(`/frequencias_sessoes?id=eq.${id}&email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' });
    return res.status(r.ok ? 200 : 500).json(r.ok ? { success: true } : { error: 'Erro.' });
  }

  if (action === 'gerar') {
    if (!nome || !estado) return res.status(400).json({ error: 'Nome e estado obrigatórios.' });
    const firstName = nome.trim().split(/\s+/)[0];

    const prompt = `Você é um especialista em frequências de cura e geometria sagrada. Analise o estado de ${firstName} e selecione a frequência Solfège e a geometria sagrada mais alinhadas com este momento.

CONSULENTE: ${firstName}
ESTADO ATUAL: ${estado}
INTENÇÃO: ${intencao || 'não informada'}

AS 9 FREQUÊNCIAS SOLFÈGE:
174 Hz — Raiz e Segurança: alívio de dor, ancoragem, sensação de proteção
285 Hz — Regeneração: regeneração celular, campo energético, vitalidade
396 Hz — Libertação: liberação de medo, culpa e bloqueios emocionais profundos
417 Hz — Dissolução: dissolução de padrões antigos, abertura radical para a mudança
528 Hz — Amor e Milagres: transformação, reparação do DNA, amor incondicional
639 Hz — Conexão: relacionamentos, comunicação, harmonia interpessoal
741 Hz — Expressão: intuição, limpeza energética, clareza de propósito
852 Hz — Despertar: despertar espiritual, intuição superior, visão ampliada
963 Hz — Unidade Divina: conexão com o cosmos, consciência pura, dissolução do ego

GEOMETRIAS SAGRADAS DISPONÍVEIS:
Flor da Vida, Semente da Vida, Vesica Piscis, Espiral Áurea, Cubo de Metatron, Merkaba, Sri Yantra, Torus, Fruto da Vida

REGRAS:
- Escolha a frequência e a geometria que melhor servem ${firstName} AGORA, não por padrão
- A geometria deve amplificar a frequência para a situação específica
- Seja profundo, específico e genuíno — cada palavra deve fazer sentido para ESTE momento
- Português do Brasil, segunda pessoa direta

Responda APENAS em JSON válido, sem markdown, sem aspas tipográficas, sem quebras de linha dentro dos valores — use \\n para separar parágrafos dentro das strings:
{
  "frequencia_hz": número,
  "frequencia_nome": "nome",
  "geometria": "nome da geometria",
  "leitura": {
    "escolha": "parágrafo 1\\n\\nparágrafo 2\\n\\nparágrafo 3",
    "cura": "parágrafo 1\\n\\nparágrafo 2\\n\\nparágrafo 3",
    "intencao": "parágrafo 1\\n\\nparágrafo 2"
  }
}`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL_SONNET || 'claude-sonnet-4-6', max_tokens: 2500, messages: [{ role: 'user', content: prompt }] })
      });
      if (!resp.ok) { const e = await resp.text(); return res.status(500).json({ error: 'Erro na API.', detail: e }); }
      const data = await resp.json();
      const text = data.content?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return res.status(500).json({ error: 'Resposta inválida.' });

      // Tenta parse direto; se falhar, limpa caracteres problemáticos
      let parsed;
      try {
        parsed = JSON.parse(match[0]);
      } catch(parseErr) {
        // Remove aspas tipográficas, escapa aspas dentro de strings JSON
        let cleaned = match[0]
          .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '\"') // aspas tipográficas duplas
          .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "\'") // aspas tipográficas simples
          .replace(/\r\n/g,'\\n').replace(/\r/g,'\\n').replace(/\n/g,'\\n') // quebras de linha
          .replace(/\t/g,'\\t'); // tabs
        try {
          parsed = JSON.parse(cleaned);
        } catch(e2) {
          // Última tentativa: extrai campos individualmente com regex
          const hz  = text.match(/"frequencia_hz"\s*:\s*(\d+)/)?.[1];
          const nom = text.match(/"frequencia_nome"\s*:\s*"([^"]+)"/)?.[1];
          const geo = text.match(/"geometria"\s*:\s*"([^"]+)"/)?.[1];
          // Para o texto da leitura, pega tudo entre as chaves de leitura
          const leitMatch = text.match(/"leitura"\s*:\s*\{([\s\S]*?)\}\s*\}/);
          const leitTxt = leitMatch ? leitMatch[1] : '';
          const esc = text.match(/"escolha"\s*:\s*"([\s\S]*?)(?=","cura")/)?.[1]?.replace(/"/g,"'")||'';
          const cur = text.match(/"cura"\s*:\s*"([\s\S]*?)(?=","intencao")/)?.[1]?.replace(/"/g,"'")||'';
          const int = text.match(/"intencao"\s*:\s*"([\s\S]*?)(?="\}|$)/)?.[1]?.replace(/"/g,"'")||'';
          if (!hz) return res.status(500).json({ error: 'Não foi possível interpretar a resposta da IA.', raw: text.slice(0,300) });
          parsed = { frequencia_hz: parseInt(hz), frequencia_nome: nom||'', geometria: geo||'Flor da Vida',
            leitura: { escolha: esc, cura: cur, intencao: int } };
        }
      }
      return res.status(200).json({ success: true, ...parsed });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Ação não reconhecida.' });
}
