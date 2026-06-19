// api/verificar-pagamento.js
// Consulta o status de um pagamento direto na API do Mercado Pago.
// Usado pelo /aguardando.html para polling até confirmação.

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function buscarPagamentoLocal(ref) {
  const url = `${SUPABASE_URL}/rest/v1/pagamentos?external_reference=eq.${encodeURIComponent(ref)}&select=email,servico,status,mp_payment_id`;
  const resp = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const rows = await resp.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function buscarPagamentoMP(paymentId) {
  const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
  });
  return resp.ok ? resp.json() : null;
}

async function buscarPagamentoMPPorRef(ref) {
  // Busca pelo external_reference na API de busca do MP
  const resp = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(ref)}&sort=date_created&criteria=desc`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data?.results?.[0] || null;
}

async function jaCreditado(ref) {
  const url = `${SUPABASE_URL}/rest/v1/creditos_movimentos?referencia=eq.${encodeURIComponent(ref)}&select=id`;
  const resp = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const rows = await resp.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function creditarUsuario(email, ref, servico) {
  await fetch(`${SUPABASE_URL}/rest/v1/creditos_movimentos`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ email, quantidade: 1, motivo: `compra_${servico}`, referencia: ref })
  });
}

async function atualizarStatusPagamento(ref, status, mpPaymentId) {
  await fetch(`${SUPABASE_URL}/rest/v1/pagamentos?external_reference=eq.${encodeURIComponent(ref)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ status, mp_payment_id: String(mpPaymentId), atualizado_em: new Date().toISOString() })
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const ref = req.query.ref;
  if (!ref) return res.status(400).json({ erro: 'ref obrigatório' });

  try {
    // 1. Busca registro local
    const local = await buscarPagamentoLocal(ref);

    // 2. Se já está aprovado localmente e creditado, retorna sucesso direto
    if (local?.status === 'approved' && await jaCreditado(ref)) {
      return res.json({ status: 'approved', servico: local.servico, email: local.email });
    }

    // 3. Consulta MP pelo payment_id local (mais rápido) ou pelo external_reference
    let pagamentoMP = null;
    if (local?.mp_payment_id) {
      pagamentoMP = await buscarPagamentoMP(local.mp_payment_id);
    }
    if (!pagamentoMP) {
      pagamentoMP = await buscarPagamentoMPPorRef(ref);
    }

    if (!pagamentoMP) {
      // Ainda não chegou no MP — continua aguardando
      return res.json({ status: 'pending' });
    }

    const statusMP = pagamentoMP.status;

    // 4. Atualiza status local
    if (local) {
      await atualizarStatusPagamento(ref, statusMP, pagamentoMP.id).catch(() => {});
    }

    // 5. Se aprovado, credita se ainda não creditou
    if (statusMP === 'approved') {
      const email = local?.email || pagamentoMP.payer?.email;
      const servico = local?.servico || ref.split('_')[0];
      if (email && !(await jaCreditado(ref))) {
        await creditarUsuario(email, ref, servico);
      }
      return res.json({ status: 'approved', servico: local?.servico || servico, email });
    }

    return res.json({ status: statusMP });

  } catch (err) {
    console.error('verificar-pagamento erro:', err.message);
    return res.status(500).json({ erro: 'Erro ao verificar pagamento' });
  }
}
