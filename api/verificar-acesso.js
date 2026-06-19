// api/verificar-acesso.js
// Verifica se o email tem acesso ao portal (assinatura ativa ou créditos de trial).

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const email = req.query.email;
  if (!email) return res.status(400).json({ acesso: false });

  try {
    // 1. Verifica assinatura ativa
    const urlSub = `${SUPABASE_URL}/rest/v1/assinaturas?email=eq.${encodeURIComponent(email)}&servico=eq.portal_mensal&status=eq.authorized&select=id`;
    const respSub = await fetch(urlSub, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    const sub = await respSub.json().catch(() => []);
    if (Array.isArray(sub) && sub.length > 0) {
      return res.json({ acesso: true, tipo: 'assinante' });
    }

    // 2. Verifica créditos de trial
    const urlCred = `${SUPABASE_URL}/rest/v1/creditos_movimentos?email=eq.${encodeURIComponent(email)}&select=quantidade`;
    const respCred = await fetch(urlCred, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    const linhas = await respCred.json().catch(() => []);
    const saldo = Array.isArray(linhas) ? linhas.reduce((s, l) => s + (Number(l.quantidade) || 0), 0) : 0;

    if (saldo >= 1) return res.json({ acesso: true, tipo: 'trial', saldo });

    return res.json({ acesso: false });
  } catch (err) {
    console.error('verificar-acesso erro:', err.message);
    return res.status(500).json({ acesso: false });
  }
}
