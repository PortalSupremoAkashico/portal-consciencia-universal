// api/criar-assinatura.js
// Cria uma assinatura recorrente (Preapproval) no Mercado Pago.
// Variáveis de ambiente necessárias na Vercel:
//   MP_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE_KEY

const URL_BASE = 'https://portaldaconscienciauniversal.com';
const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const PRODUTOS = {
  plano_despertar: { valor: 39.90, frequencia: 1, frequenciaTipo: 'months', nome: 'Portal da Consciência Universal — Plano Despertar' },
  plano_expansao: { valor: 59.90, frequencia: 1, frequenciaTipo: 'months', nome: 'Portal da Consciência Universal — Plano Expansão' },
  plano_infinito: { valor: 89.90, frequencia: 1, frequenciaTipo: 'months', nome: 'Portal da Consciência Universal — Plano Infinito' },
  portal_mensal: { valor: 49.90, frequencia: 1, frequenciaTipo: 'months', nome: 'Portal da Consciência Universal — Acesso Mensal' },
  pacote_mensal: { valor: 429.90, frequencia: 1, frequenciaTipo: 'months', nome: 'Pacote Mensal' }
};

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
      console.error('Erro ao criar assinatura MP:', dadosMP);
      return res.status(500).json({ erro: 'Falha ao criar assinatura' });
    }

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
        external_reference: referencia
      })
    });

    return res.status(200).json({ init_point: dadosMP.init_point, id: dadosMP.id });
  } catch (erro) {
    console.error('Erro em criar-assinatura:', erro);
    return res.status(500).json({ erro: 'Erro interno' });
  }
}
