// api/criar-pagamento-pix.js
// Cria um pagamento via Pix (ÚNICO, NÃO recorrente) para um dos 3 planos.
// Diferente de criar-assinatura.js (Preapproval, cartão, cobrança automática
// todo mês), aqui é um pagamento avulso: dá acesso por 30 dias corridos e,
// se o cliente quiser continuar depois disso, precisa gerar um novo Pix.
// Variáveis de ambiente necessárias na Vercel:
//   MP_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE_KEY

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const PRODUTOS = {
  plano_despertar: { valor: 39.90, nome: 'Portal: Plano Despertar (Pix)' },
  plano_expansao: { valor: 59.90, nome: 'Portal: Plano Expansão (Pix)' },
  plano_infinito: { valor: 89.90, nome: 'Portal: Plano Infinito (Pix)' }
};

async function buscarAssinaturaAtiva(email) {
  const url = `${SUPABASE_URL}/rest/v1/assinaturas?email=eq.${encodeURIComponent(email)}&status=eq.authorized&order=id.desc&limit=1&select=id,servico,mp_preapproval_id`;
  const resp = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const linhas = await resp.json().catch(() => []);
  return Array.isArray(linhas) ? linhas[0] : null;
}

async function cancelarAssinaturaMP(preapprovalId) {
  await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'cancelled' })
  });
}

async function marcarCancelada(id) {
  await fetch(`${SUPABASE_URL}/rest/v1/assinaturas?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ status: 'cancelled', atualizado_em: new Date().toISOString() })
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { servico, email } = req.body || {};
    const produto = PRODUTOS[servico];

    if (!produto || !email) {
      return res.status(400).json({ erro: 'Serviço ou email inválido' });
    }

    // ── Troca de plano: se já existe assinatura ativa (cartão ou Pix), encerra a antiga ──
    const assinaturaAtual = await buscarAssinaturaAtiva(email);
    if (assinaturaAtual) {
      if (assinaturaAtual.servico === servico) {
        return res.status(409).json({ erro: 'Você já está inscrito neste plano.' });
      }
      if (assinaturaAtual.mp_preapproval_id) {
        // Era uma assinatura por cartão (recorrente) — cancela no Mercado Pago também
        await cancelarAssinaturaMP(assinaturaAtual.mp_preapproval_id);
      }
      await marcarCancelada(assinaturaAtual.id);
    }

    const referencia = `${servico}_pix_${Date.now()}`;

    const respostaMP = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': referencia
      },
      body: JSON.stringify({
        transaction_amount: produto.valor,
        description: produto.nome,
        payment_method_id: 'pix',
        external_reference: referencia,
        payer: { email }
      })
    });

    const dadosMP = await respostaMP.json();

    if (!respostaMP.ok) {
      console.error('Erro ao criar pagamento Pix:', respostaMP.status, JSON.stringify(dadosMP));
      return res.status(500).json({
        erro: 'Falha ao gerar o Pix',
        detalhe: dadosMP?.message || dadosMP?.error || dadosMP,
        status_mp: respostaMP.status
      });
    }

    const dadosPix = dadosMP.point_of_interaction?.transaction_data || {};

    if (!dadosPix.qr_code) {
      console.error('Resposta do MP sem QR code Pix:', JSON.stringify(dadosMP));
      return res.status(500).json({ erro: 'Pix criado, mas sem QR code na resposta. Tente novamente.' });
    }

    // Cria a assinatura já como "pending" — o webhook confirma quando o Pix for pago
    // (status=authorized só é gravado ali, igual já acontece no fluxo de cartão).
    await fetch(`${SUPABASE_URL}/rest/v1/assinaturas`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        email,
        servico,
        valor: produto.valor,
        mp_preapproval_id: null,
        status: 'pending',
        external_reference: referencia,
        pool_usado: 0
      })
    });

    return res.status(200).json({
      qr_code: dadosPix.qr_code,
      qr_code_base64: dadosPix.qr_code_base64,
      payment_id: dadosMP.id,
      external_reference: referencia
    });
  } catch (erro) {
    console.error('Erro em criar-pagamento-pix:', erro);
    return res.status(500).json({ erro: 'Erro interno' });
  }
}
