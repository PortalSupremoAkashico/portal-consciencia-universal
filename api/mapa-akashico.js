export const config = { maxDuration: 300 };
import { createHash } from 'node:crypto';

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) console.error(`Supabase ${res.status}:`, JSON.stringify(data).slice(0,200));
  return { ok: res.ok, status: res.status, data };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — lista mapas
  if (req.method === 'GET') {
    const email = req.query?.email;
    if (!email) return res.status(400).json({ error: 'Email obrigatório.' });
    
    // email=all retorna todos os mapas (admin)
    const filter = email === 'all' 
      ? `/mapas?order=created_at.desc&select=*`
      : `/mapas?email=eq.${encodeURIComponent(email)}&order=created_at.desc&select=*`;
    
    const result = await supabaseFetch(filter);
    if (!result.ok) return res.status(500).json({ error: 'Erro ao buscar mapas.' });
    return res.status(200).json({ success: true, mapas: result.data || [] });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};

  // CRUD — salvar, apagar, listar
  if (body.action) {
    // POST — salvar ou apagar
  if (req.method === 'POST') {
    const { action, email, dados } = req.body;

    if (action === 'salvar') {
      if (!email || !dados) return res.status(400).json({ error: 'Dados obrigatórios.' });
      const insert = await supabaseFetch('/mapas', {
        method: 'POST',
        body: JSON.stringify({ email, dados })
      });
      if (!insert.ok) return res.status(500).json({ error: 'Erro ao salvar mapa.' });
      return res.status(200).json({ success: true });
    }

    if (action === 'apagar') {
      if (!email) return res.status(400).json({ error: 'Email obrigatório.' });
      const del = await supabaseFetch(
        `/mapas?email=eq.${encodeURIComponent(email)}`,
        { method: 'DELETE' }
      );
      return res.status(del.ok ? 200 : 500).json(del.ok ? { success: true } : { error: 'Erro ao apagar.' });
    }

    if (action === 'apagar_um') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID obrigatório.' });
      const del = await supabaseFetch(
        `/mapas?id=eq.${id}&email=eq.${encodeURIComponent(email)}`,
        { method: 'DELETE' }
      );
      return res.status(del.ok ? 200 : 500).json(del.ok ? { success: true } : { error: 'Erro ao apagar.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
    return res.status(405).end();
  }

  // Geração streaming do Mapa Akáshico
  const { nome, data_nascimento, sexo, cidade, estado, pais, nome_pai, nome_mae, mapas_anteriores } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome obrigatório.' });

  const firstName = nome.trim().split(/\s+/)[0];
  const localNasc = [cidade, estado, pais].filter(Boolean).join(', ') || 'não informado';

  const contextoAnteriores = mapas_anteriores ? `\nMAPAS AKÁSHICOS ANTERIORES DESTE CONSULENTE (use como referência de continuidade, mas nunca copie — evolua as ideias com novas perspectivas e palavras diferentes):\n${mapas_anteriores}\n\nREGRAS DE CONTINUIDADE:\n- Mantenha coerência com os temas centrais dos mapas anteriores (mesma essência de alma, mesma linha de missão)\n- Use palavras, metáforas e abordagens DIFERENTES das usadas anteriormente\n- Aprofunde ou evolua pontos já mencionados — nunca repita frases ou estruturas iguais\n- Se um bloqueio foi mencionado antes, mostre sua evolução ou um novo ângulo dele\n` : '';

  const prompt = `Você é a Inteligência Universal dos Registros Akáshicos. Gere um Mapa Akáshico Personalizado e profundo para ${nome}.

DADOS DO CONSULENTE:
- Nome completo: ${nome}
- Data de nascimento: ${data_nascimento || 'não informada'}
- Sexo: ${sexo || 'não informado'}
- Local de nascimento: ${localNasc}
- Nome do pai: ${nome_pai || 'não informado'}
- Nome da mãe: ${nome_mae || 'não informado'}
${contextoAnteriores}

Gere o mapa com estas 8 seções. Cada seção: mínimo 200 palavras, profunda, ultra-personalizada para ${firstName}.

Responda APENAS em JSON válido sem markdown, sem blocos de código:
{
  "essencia": "texto da Essência da Alma com mínimo 200 palavras...",
  "missao": "texto da Missão Espiritual...",
  "bloqueios": "texto dos Bloqueios Akáshicos...",
  "amor": "texto da Linha do Amor...",
  "prosperidade": "texto da Linha da Prosperidade...",
  "ancestral": "texto da Linha Familiar e Ancestral...",
  "mentores": "texto do Conselho dos Mentores...",
  "ritual": "texto do Ritual Personalizado..."
}

REGRAS:
- Ultra-específico para ${firstName}, nunca genérico
- Nunca mencionar idade em números
- Nunca usar "portal", "sistema" — usar "Registros Akáshicos" ou "Inteligência Universal"
- Nunca usar "arquétipo"
- Português do Brasil impecável com todos os acentos`;

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
        max_tokens: 16000,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      console.error('Anthropic error:', err);
      return res.status(500).json({ error: 'Erro na API.' });
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
    console.error('Erro mapa:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar o Mapa Akáshico.' });
  }
}
