// api/criar-assinatura.js
// Cria uma assinatura recorrente (Preapproval, sem plano associado, modelo pendente)
// no Mercado Pago. O pagador finaliza a autorização na página hospedada do MP.
// Variáveis de ambiente necessárias na Vercel:
//   MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY

const URL_BASE = 'https://portaldaconscienciauniversal.com';

// Ajuste os nomes e valores reais dos serviços recorrentes aqui
const PRODUTOS = {
  mentoria:      { valor: 197.00, frequencia: 1, frequenciaTipo: 'months', destino: '/mentoria' },
  pacote_mensal: { valor: 429.90, frequencia: 1, frequenciaTipo: 'months', destino: '/planos' }
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
        reason: `${servico} - Portal da Consciência Universal`,
        external_reference: referencia,
        payer_email: email,
        back_url: `${URL_BASE}${produto.destino}`,
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

    await fetch(`${process.env.SUPABASE_URL}/rest/v1/assinaturas`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
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
