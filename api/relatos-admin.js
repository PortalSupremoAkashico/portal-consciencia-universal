// api/relatos-admin.js
// Exclusão de Relatos Pessoais e seus comentários — só o admin pode.
// Antes, a exclusão era feita direto do navegador com a chave publicável, que
// nunca teve (de propósito) permissão de DELETE nessas tabelas — por isso o
// post "sumia" na hora mas voltava ao recarregar a página (o DELETE falhava
// silenciosamente). Agora a exclusão passa por aqui, com a chave protegida
// (service_role), e confirma no servidor que quem pediu é mesmo o admin.
// Variável de ambiente necessária na Vercel: SUPABASE_SERVICE_ROLE_KEY

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const ADMIN_EMAIL = 'raudix5@gmail.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const { action, id, email } = req.body || {};

  if (!email || String(email).toLowerCase().trim() !== ADMIN_EMAIL) {
    return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
  }
  if (!id) return res.status(400).json({ erro: 'id obrigatório' });

  try {
    if (action === 'apagar_relato') {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/relatos_experiencias?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      if (!resp.ok) {
        const errTxt = await resp.text().catch(() => '');
        console.error('Falha ao apagar relato:', resp.status, errTxt.slice(0, 300));
        return res.status(500).json({ erro: 'Falha ao apagar no banco.', detalhe: errTxt.slice(0, 300) });
      }
      return res.status(200).json({ success: true });
    }

    if (action === 'apagar_comentario_relato') {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/comentarios_relatos?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      if (!resp.ok) {
        const errTxt = await resp.text().catch(() => '');
        console.error('Falha ao apagar comentário de relato:', resp.status, errTxt.slice(0, 300));
        return res.status(500).json({ erro: 'Falha ao apagar no banco.', detalhe: errTxt.slice(0, 300) });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ erro: 'Ação desconhecida' });
  } catch (erro) {
    console.error('Erro em relatos-admin:', erro);
    return res.status(500).json({ erro: 'Erro interno' });
  }
}
