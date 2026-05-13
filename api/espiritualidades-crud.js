// espiritualidades-crud.js — CRUD de meditações E sonhos
// GET  ?tipo=meditacoes&email=x  → lista meditações
// GET  ?tipo=sonhos&email=x      → lista sonhos
// POST { tipo, action, email, dados, id }

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
  return { ok: res.ok, data };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { tipo, email } = req.query || {};
    if (!tipo || !email) return res.status(400).json({ error: 'tipo e email obrigatórios.' });
    const tabela = tipo === 'meditacoes' ? 'meditacoes' : 'sonhos';
    const result = await supabaseFetch(`/${tabela}?email=eq.${encodeURIComponent(email)}&order=created_at.desc&select=*`);
    if (!result.ok) return res.status(500).json({ error: 'Erro ao buscar.' });
    return res.status(200).json({ success: true, [tabela]: result.data || [] });
  }

  if (req.method === 'POST') {
    const { tipo, action, email, dados, id } = req.body || {};
    const tabela = tipo === 'meditacoes' ? 'meditacoes' : 'sonhos';

    if (action === 'salvar') {
      if (!email || !dados) return res.status(400).json({ error: 'Dados obrigatórios.' });
      const r = await supabaseFetch(`/${tabela}`, { method: 'POST', body: JSON.stringify({ email, dados }) });
      return res.status(r.ok ? 200 : 500).json(r.ok ? { success: true } : { error: 'Erro ao salvar.' });
    }

    if (action === 'apagar_um') {
      if (!id || !email) return res.status(400).json({ error: 'ID e email obrigatórios.' });
      const r = await supabaseFetch(`/${tabela}?id=eq.${id}&email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' });
      return res.status(r.ok ? 200 : 500).json(r.ok ? { success: true } : { error: 'Erro ao apagar.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
