// api/criar-pagamento.js
// Cria uma preferência de pagamento único (Checkout Pro) no Mercado Pago.
// Variáveis de ambiente necessárias na Vercel:
//   MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY

const URL_BASE = 'https://portaldaconscienciauniversal.com';

// Serviços com preço único
const PRECOS = {
  consulta:      39.00,
  mapa_akashico: 29.00,
  meditacao:     18.00,
  sonho:         19.00,
  iching:        39.00,
  pacote_5:      89.90,
  pacote_15:    229.90
};

// Runas e tarô têm preço por tiragem (número de cartas)
const PRECOS_TIRAGENS = {
  runas: { '1': 10.00, '3': 22.00, '5': 29.00 },
  taro:  { '1': 10.00, '3': 22.00, '5': 27.00, '6': 29.00, '10': 39.00 }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { servico, email, tiragem } = req.body || {};

    // Determina o valor: tiragem para runas/tarô, preço fixo para os demais
    let valor;
    if (PRECOS_TIRAGENS[servico]) {
      if (!tiragem || !PRECOS_TIRAGENS[servico][tiragem]) {
        return res.status(400).json({ erro: 'Selecione a quantidade de cartas.' });
      }
      valor = PRECOS_TIRAGENS[servico][tiragem];
    } else {
      valor = PRECOS[servico];
    }

    if (!valor || !email) {
      return res.status(400).json({ erro: 'Serviço ou email inválido' });
    }

    const referencia = `${servico}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // O id do serviço (?servico=) nem sempre é igual ao nome do arquivo .html real
    const ARQUIVOS_HTML = { mapa_akashico: 'mapa-akashico' };
    const arquivoServico = ARQUIVOS_HTML[servico] || servico;

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
          success: `${URL_BASE}/${arquivoServico}.html?pagamento=sucesso`,
          failure: `${URL_BASE}/${arquivoServico}.html?pagamento=falha`,
          pending: `${URL_BASE}/${arquivoServico}.html?pagamento=pendente`
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
