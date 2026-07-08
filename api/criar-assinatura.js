// api/criar-assinatura.js
// Cria uma assinatura recorrente (Preapproval) no Mercado Pago usando
// CHECKOUT TRANSPARENTE: o cartão é tokenizado no próprio site (via
// Secure Fields do Mercado Pago, no planos.html) e aqui só recebemos o
// token pronto — nunca vemos o número do cartão. Isso substitui o modelo
// antigo de redirecionar o cliente pra página hospedada do Mercado Pago
// (que estava travando o botão "Confirmar" para vários clientes).
//
// Se o cliente já tiver uma assinatura ativa de outro plano, cancela a
// antiga antes de criar a nova — a troca de plano vale na hora.
//
// Variáveis de ambiente necessárias na Vercel:
//   MP_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE_KEY

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const PRODUTOS = {
  plano_despertar: { valor: 39.90, frequencia: 1, frequenciaTipo: 'months', nome: 'Portal: Plano Despertar' },
  plano_expansao: { valor: 59.90, frequencia: 1, frequenciaTipo: 'months', nome: 'Portal: Plano Expansão' },
  plano_infinito: { valor: 89.90, frequencia: 1, frequenciaTipo: 'months', nome: 'Portal: Plano Infinito' },
  portal_mensal: { valor: 49.90, frequencia: 1, frequenciaTipo: 'months', nome: 'Portal: Acesso Mensal' }
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

async function marcarCancelada(preapprovalId) {
  await fetch(`${SUPABASE_URL}/rest/v1/assinaturas?mp_preapproval_id=eq.${encodeURIComponent(preapprovalId)}`, {
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

// Mensagens de recusa mais amigáveis pros motivos mais comuns do Mercado Pago
function traduzirRecusa(statusDetail) {
  const mapa = {
    cc_rejected_insufficient_amount: 'Saldo ou limite insuficiente no cartão.',
    cc_rejected_bad_filled_security_code: 'Código de segurança (CVV) incorreto.',
    cc_rejected_bad_filled_date: 'Data de validade incorreta.',
    cc_rejected_bad_filled_card_number: 'Número do cartão incorreto.',
    cc_rejected_bad_filled_other: 'Algum dado do cartão está incorreto.',
    cc_rejected_call_for_authorize: 'O banco pediu para autorizar esse pagamento diretamente com você. Ligue pro seu banco ou tente outro cartão.',
    cc_rejected_card_disabled: 'Cartão desabilitado. Entre em contato com o banco ou tente outro cartão.',
    cc_rejected_duplicated_payment: 'Já existe um pagamento igual a esse recente. Se precisar mesmo pagar de novo, aguarde alguns minutos.',
    cc_rejected_high_risk: 'O pagamento foi recusado por segurança. Tente outro cartão ou use o Pix.',
    cc_rejected_max_attempts: 'Limite de tentativas atingido. Tente novamente mais tarde ou use outro cartão.',
    cc_rejected_other_reason: 'O banco recusou o pagamento sem informar o motivo. Tente outro cartão ou use o Pix.'
  };
  return mapa[statusDetail] || 'O pagamento foi recusado pelo banco. Tente outro cartão ou use o Pix.';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { servico, email, card_token_id } = req.body || {};
    const produto = PRODUTOS[servico];

    if (!produto || !email) {
      return res.status(400).json({ erro: 'Serviço ou email inválido' });
    }
    if (!card_token_id) {
      return res.status(400).json({ erro: 'Token do cartão não recebido. Recarregue a página e tente de novo.' });
    }

    // ── Troca de plano: se já existe assinatura ativa, cancela a antiga ──
    const assinaturaAtual = await buscarAssinaturaAtiva(email);
    if (assinaturaAtual) {
      if (assinaturaAtual.servico === servico) {
        return res.status(409).json({ erro: 'Você já está inscrito neste plano.' });
      }
      if (assinaturaAtual.mp_preapproval_id) {
        await cancelarAssinaturaMP(assinaturaAtual.mp_preapproval_id);
        await marcarCancelada(assinaturaAtual.mp_preapproval_id);
      }
    }

    const referencia = `${servico}_assinatura_${Date.now()}`;

    // Checkout transparente: manda o token do cartão direto e pede status
    // "authorized" — o Mercado Pago valida e responde na hora, sem
    // precisar redirecionar o cliente pra nenhuma outra página.
    const respostaMP = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reason: produto.nome,
        external_reference: referencia,
        payer_email: email,
        card_token_id,
        status: 'authorized',
        auto_recurring: {
          frequency: produto.frequencia,
          frequency_type: produto.frequenciaTipo,
          transaction_amount: produto.valor,
          currency_id: 'BRL'
        }
      })
    });

    const dadosMP = await respostaMP.json();

    if (!respostaMP.ok) {
      console.error('Erro ao criar assinatura MP:', respostaMP.status, JSON.stringify(dadosMP));
      const detalhe = dadosMP?.cause?.[0]?.description || dadosMP?.message || 'Não foi possível processar o cartão.';
      return res.status(422).json({ erro: detalhe, detalhe: dadosMP });
    }

    // Grava a assinatura no banco com o status que o Mercado Pago já retornou
    // (não depende mais só do webhook pra saber se deu certo).
    const statusFinal = dadosMP.status || 'pending';
    const agora = new Date().toISOString();

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
        mp_preapproval_id: dadosMP.id,
        status: statusFinal,
        external_reference: referencia,
        ciclo_inicio: statusFinal === 'authorized' ? agora : null,
        usos_consulta: 0,
        usos_meditacao: 0,
        usos_mentoria: 0
      })
    });

    if (statusFinal === 'authorized') {
      return res.status(200).json({ success: true, status: statusFinal });
    }

    // Não autorizado de cara — o cartão foi recusado pelo banco.
    return res.status(200).json({
      success: false,
      status: statusFinal,
      erro: traduzirRecusa(dadosMP.status_detail)
    });
  } catch (erro) {
    console.error('Erro em criar-assinatura:', erro);
    return res.status(500).json({ erro: 'Erro interno' });
  }
}
