// api/criar-pagamento.js
// Cria uma preferência de pagamento único (Checkout Pro) no Mercado Pago.
// Variáveis de ambiente necessárias na Vercel:
//   MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY

const URL_BASE = 'https://portaldaconscienciauniversal.com';

// Ajuste os nomes e valores reais dos serviços aqui
const PRECOS = {
  consulta: 47.00,
  mapa_akashico: 67.00,
  meditacao: 47.00,
  sonho: 47.00,
  runas: 67.00,
  iching: 67.00,
  taro: 67.00,
  pacote_5: 220.00,
  pacote_10: 390.00
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { servico, email } = req.body || {};
    const valor = PRECOS[servico];

    if (!valor || !email) {
      return res.status(400).json({ erro: 'Serviço ou email inválido' });
    }

    const referencia = `${servico}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const respostaMP = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [{
          title: servico,
          quantity: 1,
          unit_price: valor,
          currency_id: 'BRL'
        }],
        payer: { email },
        back_urls: {
          success: `${URL_BASE}/${servico}.html?pagamento=sucesso`,
          failure: `${URL_BASE}/${servico}.html?pagamento=falha`,
          pending: `${URL_BASE}/${servico}.html?pagamento=pendente`
        },
        auto_return: 'approved',
        notification_url: `${URL_BASE}/api/webhook-mercadopago`,
        external_reference: referencia,
        statement_descriptor: 'PORTAL CONSCIENCIA'
      })
    });

    const dadosMP = await respostaMP.json();

    if (!respostaMP.ok) {
      console.error('Erro ao criar preferência MP:', dadosMP);
      return res.status(500).json({ erro: 'Falha ao criar pagamento' });
    }

    // Registra como pendente no Supabase (server-side, com service key)
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/pagamentos`, {
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
        valor,
        mp_preference_id: dadosMP.id,
        status: 'pendente',
        external_reference: referencia
      })
    });

    return res.status(200).json({ init_point: dadosMP.init_point, id: dadosMP.id });
  } catch (erro) {
    console.error('Erro em criar-pagamento:', erro);
    return res.status(500).json({ erro: 'Erro interno' });
  }
}
