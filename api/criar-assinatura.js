// api/criar-assinatura.js
// Cria uma assinatura recorrente (Preapproval) no Mercado Pago.
// Se o cliente já tiver uma assinatura ativa de outro plano, cancela a antiga
// antes de criar a nova — a troca de plano vale na hora e a cobrança do novo
// plano passa a cair na data de hoje.
// Variáveis de ambiente necessárias na Vercel:
//   MP_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE_KEY

const URL_BASE = 'https://portaldaconscienciauniversal.com';
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
        back_url: `${URL_BASE}/consulta?assinatura=ativada`,
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
      return res.status(500).json({
        erro: 'Falha ao criar assinatura',
        detalhe: dadosMP?.message || dadosMP?.error || dadosMP,
        status_mp: respostaMP.status
      });
    }

    // ciclo_inicio só é gravado quando o webhook confirma status=authorized
    // (é só aí que o Mercado Pago garante que o pagamento foi de fato aprovado).
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
        status: dadosMP.status || 'pending',
        external_reference: referencia,
        pool_usado: 0
      })
    });

    return res.status(200).json({ init_point: dadosMP.init_point, id: dadosMP.id });
  } catch (erro) {
    console.error('Erro em criar-assinatura:', erro);
    return res.status(500).json({ erro: 'Erro interno' });
  }
}
