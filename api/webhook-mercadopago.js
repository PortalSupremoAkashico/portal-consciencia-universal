// api/webhook-mercadopago.js
// Recebe notificações do Mercado Pago (pagamento único e assinatura recorrente),
// valida a assinatura secreta (x-signature) e atualiza o Supabase.
// Variáveis de ambiente necessárias na Vercel:
//   MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY

import crypto from 'crypto';

function validarAssinatura(xSignature, xRequestId, dataId, secret) {
  if (!xSignature || !xRequestId || !dataId || !secret) return false;

  const partes = {};
  xSignature.split(',').forEach((parte) => {
    const [chave, valor] = parte.split('=');
    if (chave) partes[chave.trim()] = valor;
  });

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${partes.ts};`;
  const hashCalculado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  return hashCalculado === partes.v1;
}

async function atualizarSupabase(tabela, colunaFiltro, valorFiltro, dados) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${tabela}?${colunaFiltro}=eq.${encodeURIComponent(valorFiltro)}`;
  await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(dados)
  });
}

// Quantos créditos cada pacote concede quando o pagamento é aprovado
const PACOTES_CREDITOS = { pacote_5: 5, pacote_15: 15 };

// Assinaturas recorrentes que concedem créditos a cada cobrança aprovada
// (mentoria não entra aqui — ela não usa o sistema de créditos)
const ASSINATURAS_CREDITOS_POR_CICLO = { pacote_mensal: 30 };

async function buscarPagamento(externalReference) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/pagamentos?external_reference=eq.${encodeURIComponent(externalReference)}&select=servico,email`;
  const resp = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
    }
  });
  const linhas = await resp.json();
  return Array.isArray(linhas) ? linhas[0] : null;
}

async function buscarAssinatura(preapprovalId) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/assinaturas?mp_preapproval_id=eq.${encodeURIComponent(preapprovalId)}&select=servico,email`;
  const resp = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
    }
  });
  const linhas = await resp.json();
  return Array.isArray(linhas) ? linhas[0] : null;
}

async function jaCreditado(referencia) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/creditos_movimentos?referencia=eq.${encodeURIComponent(referencia)}&select=id`;
  const resp = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
    }
  });
  const linhas = await resp.json();
  return Array.isArray(linhas) && linhas.length > 0;
}

async function creditarPacote(email, quantidade, referencia) {
  await fetch(`${process.env.SUPABASE_URL}/rest/v1/creditos_movimentos`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ email, quantidade, motivo: `compra_pacote_${quantidade}`, referencia })
  });
}

export default async function handler(req, res) {
  // O Mercado Pago espera 200 rapidamente — sempre respondemos 200,
  // mesmo em caso de erro de validação, pra evitar reenvios infinitos.
  if (req.method !== 'POST') return res.status(200).end();

  try {
    const xSignature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];
    const { type, data } = req.body || {};
    const dataId = data?.id || req.query['data.id'] || req.query.id;

    const assinaturaValida = validarAssinatura(
      xSignature,
      xRequestId,
      dataId,
      process.env.MP_WEBHOOK_SECRET
    );

    if (!assinaturaValida) {
      console.warn('Webhook MP: assinatura inválida, ignorando notificação');
      return res.status(200).end();
    }

    if (type === 'payment') {
      const respostaMP = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const pagamento = await respostaMP.json();

      if (pagamento.external_reference) {
        await atualizarSupabase('pagamentos', 'external_reference', pagamento.external_reference, {
          status: pagamento.status,
          mp_payment_id: String(pagamento.id),
          atualizado_em: new Date().toISOString()
        });

        if (pagamento.status === 'approved') {
          const registro = await buscarPagamento(pagamento.external_reference);
          const quantidadeCreditos = registro && PACOTES_CREDITOS[registro.servico];

          if (quantidadeCreditos && !(await jaCreditado(pagamento.external_reference))) {
            await creditarPacote(registro.email, quantidadeCreditos, pagamento.external_reference);
          }
        }
      }
    }

    if (type === 'subscription_preapproval') {
      const respostaMP = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const assinatura = await respostaMP.json();

      await atualizarSupabase('assinaturas', 'mp_preapproval_id', dataId, {
        status: assinatura.status,
        atualizado_em: new Date().toISOString()
      });
    }

    // Dispara a cada cobrança recorrente (todo ciclo, ex: todo mês) — é aqui
    // que o Pacote Mensal recebe os créditos do mês, não na criação da assinatura.
    if (type === 'subscription_authorized_payment') {
      const respostaMP = await fetch(`https://api.mercadopago.com/authorized_payments/${dataId}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const cobranca = await respostaMP.json();

      if (cobranca.preapproval_id && cobranca.payment && cobranca.payment.status === 'approved') {
        const assinaturaRegistro = await buscarAssinatura(cobranca.preapproval_id);
        const creditosPorCiclo = assinaturaRegistro && ASSINATURAS_CREDITOS_POR_CICLO[assinaturaRegistro.servico];

        if (creditosPorCiclo) {
          const referenciaCiclo = `ciclo_${cobranca.payment.id}`;
          if (!(await jaCreditado(referenciaCiclo))) {
            await creditarPacote(assinaturaRegistro.email, creditosPorCiclo, referenciaCiclo);
          }
        }
      }
    }

    return res.status(200).end();
  } catch (erro) {
    console.error('Erro no webhook MP:', erro);
    return res.status(200).end();
  }
}
