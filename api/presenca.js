// api/presenca.js
// Registra e lista presença online dos consulentes.
// A chave service_role fica só aqui no servidor (variável de ambiente),
// nunca é enviada ao navegador — diferente do presenca.js antigo, que
// chamava o Supabase direto do cliente com a chave exposta.
// Variável de ambiente necessária na Vercel: SUPABASE_SERVICE_ROLE_KEY

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET — usado pelo painel admin pra listar quem está online ──
  if (req.method === 'GET') {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/presencas_online?select=email,nome,pagina,last_seen`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      const data = await r.json().catch(() => []);
      return res.status(200).json({ success: true, presencas: Array.isArray(data) ? data : [] });
    } catch (e) {
      return res.status(200).json({ success: true, presencas: [] });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, nome, pagina } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email obrigatório' });
  const emailNorm = String(email).toLowerCase().trim();

  // ── Remove a presença (chamado ao sair da página) ──
  if (action === 'remover') {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/presencas_online?email=eq.${encodeURIComponent(emailNorm)}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
    } catch (e) {}
    return res.status(200).json({ success: true });
  }

  // ── Heartbeat (upsert por email) ──
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/presencas_online?on_conflict=email`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal,resolution=merge-duplicates'
      },
      body: JSON.stringify({
        email: emailNorm,
        nome: nome || '',
        pagina: pagina || '',
        last_seen: new Date().toISOString()
      })
    });
    if (!r.ok) {
      const errTxt = await r.text().catch(() => '');
      console.error('presenca heartbeat falhou:', r.status, errTxt.slice(0, 300));
    }
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao registrar presença' });
  }
}
